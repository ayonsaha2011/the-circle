import { create } from 'zustand';
import ClientEncryptionService from './encryption';

// Message interfaces
export interface Message {
  id: string;
  conversationId: string;
  senderId?: string;
  content: string; // Decrypted content
  messageType: string;
  replyToId?: string;
  createdAt: string;
  editedAt?: string;
  readBy: string[];
  reactions: Record<string, any>;
}

export interface Conversation {
  id: string;
  name?: string;
  type: string;
  participants: string[];
  lastMessage?: Message;
  unreadCount: number;
  updatedAt: string;
  encryptionKey?: string; // Client-side only
}

export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export interface UserPresence {
  userId: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  customStatus?: string;
  lastSeen: string;
}

// WebSocket Store
interface WebSocketState {
  socket: WebSocket | null;
  isConnected: boolean;
  isAuthenticated: boolean;
  conversations: Conversation[];
  messages: Record<string, Message[]>; // conversationId -> messages
  userPresence: Record<string, UserPresence>;
  typingUsers: Record<string, string[]>; // conversationId -> typing user IDs
  
  // Actions
  connect: (token: string) => void;
  disconnect: () => void;
  sendMessage: (conversationId: string, content: string, messageType?: string) => void;
  markMessageRead: (messageId: string, conversationId: string) => void;
  startTyping: (conversationId: string) => void;
  stopTyping: (conversationId: string) => void;
  createConversation: (name: string, participantIds: string[]) => void;
  
  // Message handlers
  handleMessageReceived: (message: Message) => void;
  handleTypingStart: (conversationId: string, userId: string) => void;
  handleTypingStop: (conversationId: string, userId: string) => void;
  handlePresenceUpdate: (userId: string, presence: UserPresence) => void;
}

export const useWebSocketStore = create<WebSocketState>((set, get) => ({
  socket: null,
  isConnected: false,
  isAuthenticated: false,
  conversations: [],
  messages: {},
  userPresence: {},
  typingUsers: {},

  connect: (token: string) => {
    const { socket, isConnected } = get();
    
    // Avoid creating duplicate connections
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      console.log('WebSocket already connected or connecting');
      return;
    }

    const socketUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:8000/ws';
    console.log('🔌 Connecting to WebSocket:', socketUrl);
    const newSocket = new WebSocket(socketUrl);

    // Connection events
    newSocket.onopen = () => {
      console.log('🔗 WebSocket connected');
      set({ isConnected: true, socket: newSocket });
      
      // Authenticate immediately
      const authMessage = {
        type: 'Authenticate',
        token: token
      };
      newSocket.send(JSON.stringify(authMessage));
    };

    newSocket.onclose = () => {
      console.log('💔 WebSocket disconnected');
      set({ isConnected: false, isAuthenticated: false, socket: null });
    };

    newSocket.onerror = (error) => {
      console.error('❌ WebSocket connection error:', error);
      set({ isConnected: false, isAuthenticated: false });
    };

    newSocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('📨 WebSocket message received:', message);
        
        switch (message.type) {
          case 'AuthResult':
            if (message.success) {
              console.log('✅ WebSocket authenticated');
              set({ isAuthenticated: true });
            } else {
              console.error('❌ WebSocket authentication failed');
              set({ isAuthenticated: false });
            }
            break;
            
          case 'MessageReceived':
            get().handleMessageReceived(message.message);
            break;
            
          case 'MessageRead':
            const state = get();
            const updatedMessages = { ...state.messages };
            
            // Update read status for all conversations
            Object.keys(updatedMessages).forEach(conversationId => {
              updatedMessages[conversationId] = updatedMessages[conversationId].map(msg => 
                msg.id === message.messageId 
                  ? { ...msg, readBy: [...msg.readBy, message.userId] }
                  : msg
              );
            });
            
            set({ messages: updatedMessages });
            break;
            
          case 'TypingStart':
            get().handleTypingStart(message.conversationId, message.userId);
            break;
            
          case 'TypingStop':
            get().handleTypingStop(message.conversationId, message.userId);
            break;
            
          case 'UserOnline':
            const currentState = get();
            set({
              userPresence: {
                ...currentState.userPresence,
                [message.userId]: {
                  ...currentState.userPresence[message.userId],
                  status: 'online',
                  lastSeen: new Date().toISOString(),
                } as UserPresence,
              },
            });
            break;
            
          case 'UserOffline':
            const offlineState = get();
            set({
              userPresence: {
                ...offlineState.userPresence,
                [message.userId]: {
                  ...offlineState.userPresence[message.userId],
                  status: 'offline',
                  lastSeen: new Date().toISOString(),
                } as UserPresence,
              },
            });
            break;
            
          case 'Error':
            console.error('🚨 WebSocket error:', message.message);
            break;
            
          default:
            console.log('Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    set({ socket: newSocket });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket && socket.readyState === WebSocket.OPEN) {
      console.log('Disconnecting WebSocket...');
      socket.close();
    }
    set({ 
      socket: null, 
      isConnected: false, 
      isAuthenticated: false,
      conversations: [],
      messages: {},
      userPresence: {},
      typingUsers: {},
    });
  },

  sendMessage: (conversationId: string, content: string, messageType = 'text') => {
    const { socket, isAuthenticated } = get();
    if (!socket || !isAuthenticated || socket.readyState !== WebSocket.OPEN) return;

    const messageData = {
      type: 'SendMessage',
      conversationId,
      content,
      messageType,
    };

    socket.send(JSON.stringify(messageData));
  },

  markMessageRead: (messageId: string, conversationId: string) => {
    const { socket, isAuthenticated } = get();
    if (!socket || !isAuthenticated || socket.readyState !== WebSocket.OPEN) return;

    const messageData = {
      type: 'MessageRead',
      messageId,
      conversationId,
    };

    socket.send(JSON.stringify(messageData));
  },

  startTyping: (conversationId: string) => {
    const { socket, isAuthenticated } = get();
    if (!socket || !isAuthenticated || socket.readyState !== WebSocket.OPEN) return;

    const messageData = {
      type: 'TypingStart',
      conversationId,
    };

    socket.send(JSON.stringify(messageData));
  },

  stopTyping: (conversationId: string) => {
    const { socket, isAuthenticated } = get();
    if (!socket || !isAuthenticated || socket.readyState !== WebSocket.OPEN) return;

    const messageData = {
      type: 'TypingStop',
      conversationId,
    };

    socket.send(JSON.stringify(messageData));
  },

  createConversation: (name: string, participantIds: string[]) => {
    const { socket, isAuthenticated } = get();
    if (!socket || !isAuthenticated || socket.readyState !== WebSocket.OPEN) return;

    const messageData = {
      type: 'CreateConversation',
      name,
      participantIds,
    };

    socket.send(JSON.stringify(messageData));
  },

  handleMessageReceived: (message: Message) => {
    const state = get();
    const conversationId = message.conversationId;
    const currentMessages = state.messages[conversationId] || [];
    
    set({
      messages: {
        ...state.messages,
        [conversationId]: [...currentMessages, message],
      },
    });
  },

  handleTypingStart: (conversationId: string, userId: string) => {
    const state = get();
    const currentTyping = state.typingUsers[conversationId] || [];
    
    if (!currentTyping.includes(userId)) {
      set({
        typingUsers: {
          ...state.typingUsers,
          [conversationId]: [...currentTyping, userId],
        },
      });
    }
  },

  handleTypingStop: (conversationId: string, userId: string) => {
    const state = get();
    const currentTyping = state.typingUsers[conversationId] || [];
    
    set({
      typingUsers: {
        ...state.typingUsers,
        [conversationId]: currentTyping.filter(id => id !== userId),
      },
    });
  },

  handlePresenceUpdate: (userId: string, presence: UserPresence) => {
    const state = get();
    set({
      userPresence: {
        ...state.userPresence,
        [userId]: presence,
      },
    });
  },
}));