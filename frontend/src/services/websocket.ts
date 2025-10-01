import { create } from 'zustand';
import ClientEncryptionService from './encryption';
import ApiService from './api';

// Message interfaces
export interface Message {
  id: string;
  conversationId: string;
  senderId?: string;
  content: string; // Decrypted content for display
  content_encrypted?: string; // Raw encrypted content from backend
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
  isConnecting: boolean;
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
  isConnecting: false,
  conversations: [],
  messages: {},
  userPresence: {},
  typingUsers: {},

  connect: (token: string) => {
    const { socket, isConnected, isConnecting } = get();
    
    // Avoid creating duplicate connections
    if (isConnecting || (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING))) {
      console.log('WebSocket already connected or connecting, skipping...');
      return;
    }

    console.log('🔌 Connecting to WebSocket with token:', token ? token.substring(0, 20) + '...' : 'null');
    set({ isConnecting: true });
    
    const socketUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:8000/ws';
    console.log('🔌 Connecting to:', socketUrl);
    const newSocket = new WebSocket(socketUrl);

    // Connection events
    newSocket.onopen = () => {
      console.log('🔗 WebSocket connected');
      set({ isConnected: true, isConnecting: false, socket: newSocket });
      
      // Authenticate immediately
      const authMessage = {
        type: 'Authenticate',
        token: token
      };
      console.log('🔐 Sending authentication message...');
      newSocket.send(JSON.stringify(authMessage));
    };

    newSocket.onclose = (event) => {
      console.log('💔 WebSocket disconnected. Code:', event.code, 'Reason:', event.reason);
      set({ isConnected: false, isAuthenticated: false, isConnecting: false, socket: null });
      
      // Auto-reconnect if it was an unexpected disconnect
      if (event.code !== 1000) {
        console.log('🔄 Attempting to reconnect in 3 seconds...');
        setTimeout(() => {
          const currentState = get();
          if (!currentState.isConnected && !currentState.isConnecting) {
            const storedToken = localStorage.getItem('access_token');
            if (storedToken && storedToken !== 'undefined' && storedToken !== 'null') {
              console.log('🔄 Auto-reconnecting...');
              get().connect(storedToken);
            }
          }
        }, 3000);
      }
    };

    newSocket.onerror = (error) => {
      console.error('❌ WebSocket connection error:', error);
      set({ isConnected: false, isAuthenticated: false, isConnecting: false });
    };

    newSocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('📨 WebSocket message received:', message);
        
        switch (message.type) {
          case 'AuthResult':
            if (message.success) {
              console.log('✅ WebSocket authenticated successfully');
              set({ isAuthenticated: true });
            } else {
              console.error('❌ WebSocket authentication failed:', message.message);
              set({ isAuthenticated: false });
            }
            break;
            
          case 'MessageReceived':
            // Process the received message and decrypt content
            const receivedMessage = {
              id: message.message.id,
              conversationId: message.message.conversation_id || '',
              senderId: message.message.sender_id,
              content: message.message.content_encrypted, // For now, treat as plaintext (in production, decrypt this)
              content_encrypted: message.message.content_encrypted,
              messageType: message.message.message_type || 'text',
              replyToId: message.message.reply_to_id,
              createdAt: message.message.created_at,
              editedAt: message.message.edited_at,
              readBy: message.message.read_by || [],
              reactions: message.message.reactions || {},
            };
            get().handleMessageReceived(receivedMessage);
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
            // Show user-friendly error notification
            if (message.message?.includes('Failed to send message')) {
              alert('Failed to send message. Please check that the conversation exists and try again.');
            } else {
              alert(`WebSocket Error: ${message.message}`);
            }
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
    const { socket, isConnected } = get();
    
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      console.log('🔌 Disconnecting WebSocket...');
      socket.close(1000, 'Client disconnecting');
    }
    
    set({ 
      socket: null, 
      isConnected: false, 
      isAuthenticated: false,
      isConnecting: false,
      conversations: [],
      messages: {},
      userPresence: {},
      typingUsers: {},
    });
  },

  sendMessage: (conversationId: string, content: string, messageType = 'text') => {
    const { socket, isAuthenticated, isConnected } = get();
    
    console.log('🔍 SendMessage check:', {
      socketExists: !!socket,
      socketState: socket?.readyState,
      isAuthenticated,
      isConnected,
      conversationId
    });
    
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.error('🚨 Cannot send message: WebSocket not connected');
      console.error('Socket state:', socket?.readyState);
      alert('Connection lost. Please refresh the page to reconnect.');
      return false;
    }
    
    if (!isAuthenticated) {
      console.error('🚨 Cannot send message: WebSocket not authenticated');
      alert('Authentication failed. Please refresh the page and try again.');
      return false;
    }
    
    try {
      const messageData = {
        type: 'SendMessage',
        conversationId,
        content,
        messageType,
      };
      
      console.log('📤 Sending message:', messageData);
      socket.send(JSON.stringify(messageData));
      console.log('📤 Message sent successfully to conversation:', conversationId);
      return true;
    } catch (error) {
      console.error('🚨 WebSocket error: Failed to send message', error);
      alert('Failed to send message. Please try again.');
      return false;
    }
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
    // Use HTTP API instead of WebSocket for creating conversations
    const requestData = {
      name,
      participant_emails: participantIds,
      conversation_type: participantIds.length > 1 ? 'group' : 'direct',
    };
    
    ApiService.post('/api/conversations', requestData)
    .then(response => {
      const conversation = response.data;
      console.log('✅ Conversation created:', conversation);
      // Add the new conversation to the store
      const state = get();
      const newConversation = {
        id: conversation.id,
        name: conversation.name,
        type: conversation.conversation_type,
        participants: conversation.participants,
        unreadCount: 0,
        updatedAt: conversation.created_at,
      };
      set({
        conversations: [...state.conversations, newConversation],
      });
    })
    .catch(error => {
      console.error('❌ Failed to create conversation:', error);
      const errorMessage = error.response?.data?.error || error.message || 'Failed to create conversation';
      alert(`Failed to create conversation: ${errorMessage}`);
    });
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