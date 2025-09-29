import { create } from 'zustand';
import { useWebSocketStore } from './websocket';

// WebRTC Interfaces
export interface CallParticipant {
  id: string;
  name: string;
  avatarUrl?: string;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  stream?: MediaStream;
}

export interface CallState {
  callId: string | null;
  isInCall: boolean;
  isInitiator: boolean;
  localStream: MediaStream | null;
  remoteStreams: Record<string, MediaStream>;
  participants: CallParticipant[];
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  isScreenSharing: boolean;
  callStatus: 'idle' | 'calling' | 'ringing' | 'connected' | 'disconnected';
  error: string | null;
}

export interface WebRTCStore extends CallState {
  // Actions
  initializeCall: (participantIds: string[]) => Promise<void>;
  answerCall: (callId: string) => Promise<void>;
  rejectCall: (callId: string) => Promise<void>;
  endCall: () => Promise<void>;
  toggleAudio: () => void;
  toggleVideo: () => void;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => void;
  addParticipant: (participantId: string) => Promise<void>;
  removeParticipant: (participantId: string) => void;
  setRemoteStream: (participantId: string, stream: MediaStream) => void;
  setCallStatus: (status: CallState['callStatus']) => void;
}

class WebRTCService {
  private peerConnections: Record<string, RTCPeerConnection> = {};
  private localStream: MediaStream | null = null;
  private configuration: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  };

  constructor() {
    this.setupWebSocketHandlers();
  }

  private setupWebSocketHandlers() {
    // Set up WebSocket event handlers for signaling
    const wsStore = useWebSocketStore.getState();
    
    if (wsStore.socket) {
      wsStore.socket.on('call_offer', this.handleCallOffer.bind(this));
      wsStore.socket.on('call_answer', this.handleCallAnswer.bind(this));
      wsStore.socket.on('ice_candidate', this.handleIceCandidate.bind(this));
      wsStore.socket.on('call_ended', this.handleCallEnded.bind(this));
      wsStore.socket.on('participant_joined', this.handleParticipantJoined.bind(this));
      wsStore.socket.on('participant_left', this.handleParticipantLeft.bind(this));
    }
  }

  async initializeLocalMedia(video: boolean = true, audio: boolean = true): Promise<MediaStream> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: video ? { width: 1280, height: 720 } : false,
        audio: audio ? { echoCancellation: true, noiseSuppression: true } : false,
      });

      this.localStream = stream;
      return stream;
    } catch (error) {
      console.error('Error accessing media devices:', error);
      throw new Error('Failed to access camera/microphone');
    }
  }

  async createPeerConnection(participantId: string): Promise<RTCPeerConnection> {
    const peerConnection = new RTCPeerConnection(this.configuration);
    
    // Add local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, this.localStream!);
      });
    }

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      const remoteStream = event.streams[0];
      useWebRTCStore.getState().setRemoteStream(participantId, remoteStream);
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignalingMessage('ice_candidate', {
          candidate: event.candidate,
          participantId,
        });
      }
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log(`Connection state with ${participantId}:`, peerConnection.connectionState);
      
      if (peerConnection.connectionState === 'failed') {
        this.handleConnectionFailure(participantId);
      }
    };

    this.peerConnections[participantId] = peerConnection;
    return peerConnection;
  }

  async createOffer(participantId: string): Promise<void> {
    const peerConnection = await this.createPeerConnection(participantId);
    
    try {
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      this.sendSignalingMessage('call_offer', {
        offer,
        participantId,
        callId: useWebRTCStore.getState().callId,
      });
    } catch (error) {
      console.error('Error creating offer:', error);
      throw error;
    }
  }

  async handleCallOffer(data: { offer: RTCSessionDescriptionInit; participantId: string; callId: string }) {
    const { offer, participantId, callId } = data;
    
    try {
      const peerConnection = await this.createPeerConnection(participantId);
      await peerConnection.setRemoteDescription(offer);
      
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      this.sendSignalingMessage('call_answer', {
        answer,
        participantId,
        callId,
      });
      
      // Update store state
      useWebRTCStore.getState().setCallStatus('connected');
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  }

  async handleCallAnswer(data: { answer: RTCSessionDescriptionInit; participantId: string }) {
    const { answer, participantId } = data;
    
    try {
      const peerConnection = this.peerConnections[participantId];
      if (peerConnection) {
        await peerConnection.setRemoteDescription(answer);
        useWebRTCStore.getState().setCallStatus('connected');
      }
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  }

  async handleIceCandidate(data: { candidate: RTCIceCandidate; participantId: string }) {
    const { candidate, participantId } = data;
    
    try {
      const peerConnection = this.peerConnections[participantId];
      if (peerConnection) {
        await peerConnection.addIceCandidate(candidate);
      }
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  }

  handleCallEnded(data: { callId: string; participantId?: string }) {
    const { participantId } = data;
    
    if (participantId) {
      // Remove specific participant
      this.removePeerConnection(participantId);
      useWebRTCStore.getState().removeParticipant(participantId);
    } else {
      // End entire call
      this.cleanup();
      useWebRTCStore.getState().endCall();
    }
  }

  handleParticipantJoined(data: { participantId: string; participantInfo: any }) {
    // Create peer connection for new participant
    this.createOffer(data.participantId);
  }

  handleParticipantLeft(data: { participantId: string }) {
    this.removePeerConnection(data.participantId);
    useWebRTCStore.getState().removeParticipant(data.participantId);
  }

  private handleConnectionFailure(participantId: string) {
    console.error(`Connection failed with participant: ${participantId}`);
    this.removePeerConnection(participantId);
    useWebRTCStore.getState().removeParticipant(participantId);
  }

  private removePeerConnection(participantId: string) {
    const peerConnection = this.peerConnections[participantId];
    if (peerConnection) {
      peerConnection.close();
      delete this.peerConnections[participantId];
    }
  }

  private sendSignalingMessage(type: string, data: any) {
    const wsStore = useWebSocketStore.getState();
    if (wsStore.socket && wsStore.isConnected) {
      wsStore.socket.emit('webrtc_signal', { type, ...data });
    }
  }

  async startScreenShare(): Promise<MediaStream> {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });

      // Replace video track in all peer connections
      const videoTrack = screenStream.getVideoTracks()[0];
      
      Object.values(this.peerConnections).forEach(async (peerConnection) => {
        const sender = peerConnection.getSenders().find(s => 
          s.track && s.track.kind === 'video'
        );
        
        if (sender) {
          await sender.replaceTrack(videoTrack);
        }
      });

      // Handle screen share end
      videoTrack.onended = () => {
        useWebRTCStore.getState().stopScreenShare();
      };

      return screenStream;
    } catch (error) {
      console.error('Error starting screen share:', error);
      throw error;
    }
  }

  async stopScreenShare() {
    try {
      // Get camera stream back
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      const videoTrack = cameraStream.getVideoTracks()[0];

      // Replace screen share track with camera track
      Object.values(this.peerConnections).forEach(async (peerConnection) => {
        const sender = peerConnection.getSenders().find(s => 
          s.track && s.track.kind === 'video'
        );
        
        if (sender) {
          await sender.replaceTrack(videoTrack);
        }
      });

      // Update local stream
      if (this.localStream) {
        const oldVideoTrack = this.localStream.getVideoTracks()[0];
        if (oldVideoTrack) {
          this.localStream.removeTrack(oldVideoTrack);
          oldVideoTrack.stop();
        }
        this.localStream.addTrack(videoTrack);
      }
    } catch (error) {
      console.error('Error stopping screen share:', error);
    }
  }

  cleanup() {
    // Close all peer connections
    Object.values(this.peerConnections).forEach(pc => pc.close());
    this.peerConnections = {};

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
  }
}

// Zustand store
export const useWebRTCStore = create<WebRTCStore>((set, get) => ({
  callId: null,
  isInCall: false,
  isInitiator: false,
  localStream: null,
  remoteStreams: {},
  participants: [],
  isAudioMuted: false,
  isVideoMuted: false,
  isScreenSharing: false,
  callStatus: 'idle',
  error: null,

  initializeCall: async (participantIds: string[]) => {
    const webrtcService = new WebRTCService();
    
    try {
      set({ callStatus: 'calling', isInitiator: true, error: null });
      
      // Initialize local media
      const localStream = await webrtcService.initializeLocalMedia();
      set({ localStream });
      
      // Generate call ID
      const callId = Math.random().toString(36).substring(2);
      set({ callId, isInCall: true });
      
      // Create offers for all participants
      for (const participantId of participantIds) {
        await webrtcService.createOffer(participantId);
      }
      
      // Send call invitation through WebSocket
      const wsStore = useWebSocketStore.getState();
      if (wsStore.socket) {
        wsStore.socket.emit('initiate_call', {
          callId,
          participantIds,
          callType: 'video',
        });
      }
      
    } catch (error: any) {
      set({ error: error.message, callStatus: 'idle' });
    }
  },

  answerCall: async (callId: string) => {
    const webrtcService = new WebRTCService();
    
    try {
      set({ callStatus: 'connected', callId, isInCall: true, error: null });
      
      // Initialize local media
      const localStream = await webrtcService.initializeLocalMedia();
      set({ localStream });
      
      // Send answer through WebSocket
      const wsStore = useWebSocketStore.getState();
      if (wsStore.socket) {
        wsStore.socket.emit('answer_call', { callId });
      }
      
    } catch (error: any) {
      set({ error: error.message, callStatus: 'idle' });
    }
  },

  rejectCall: async (callId: string) => {
    const wsStore = useWebSocketStore.getState();
    if (wsStore.socket) {
      wsStore.socket.emit('reject_call', { callId });
    }
    
    set({ callStatus: 'idle', callId: null });
  },

  endCall: async () => {
    const { callId } = get();
    const webrtcService = new WebRTCService();
    
    if (callId) {
      const wsStore = useWebSocketStore.getState();
      if (wsStore.socket) {
        wsStore.socket.emit('end_call', { callId });
      }
    }
    
    webrtcService.cleanup();
    
    set({
      callId: null,
      isInCall: false,
      isInitiator: false,
      localStream: null,
      remoteStreams: {},
      participants: [],
      isAudioMuted: false,
      isVideoMuted: false,
      isScreenSharing: false,
      callStatus: 'idle',
      error: null,
    });
  },

  toggleAudio: () => {
    const { localStream, isAudioMuted } = get();
    
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = isAudioMuted;
      });
      
      set({ isAudioMuted: !isAudioMuted });
    }
  },

  toggleVideo: () => {
    const { localStream, isVideoMuted } = get();
    
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = isVideoMuted;
      });
      
      set({ isVideoMuted: !isVideoMuted });
    }
  },

  startScreenShare: async () => {
    const webrtcService = new WebRTCService();
    
    try {
      await webrtcService.startScreenShare();
      set({ isScreenSharing: true });
    } catch (error: any) {
      set({ error: error.message });
    }
  },

  stopScreenShare: () => {
    const webrtcService = new WebRTCService();
    webrtcService.stopScreenShare();
    set({ isScreenSharing: false });
  },

  addParticipant: async (participantId: string) => {
    const { participants } = get();
    
    // Add participant to local state
    const newParticipant: CallParticipant = {
      id: participantId,
      name: `User ${participantId}`, // TODO: Get actual name
      isAudioMuted: false,
      isVideoMuted: false,
    };
    
    set({ participants: [...participants, newParticipant] });
  },

  removeParticipant: (participantId: string) => {
    const { participants, remoteStreams } = get();
    
    // Remove from participants
    const updatedParticipants = participants.filter(p => p.id !== participantId);
    
    // Remove remote stream
    const updatedStreams = { ...remoteStreams };
    delete updatedStreams[participantId];
    
    set({ 
      participants: updatedParticipants,
      remoteStreams: updatedStreams 
    });
  },

  // Helper method to set remote stream (called by WebRTCService)
  setRemoteStream: (participantId: string, stream: MediaStream) => {
    const { remoteStreams } = get();
    set({ remoteStreams: { ...remoteStreams, [participantId]: stream } });
  },

  // Helper method to set call status
  setCallStatus: (status: CallState['callStatus']) => {
    set({ callStatus: status });
  },
});