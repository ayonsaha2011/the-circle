import { io, Socket } from 'socket.io-client';
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
  socket: Socket | null;
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
    const socketUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:8000';
    const socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket'],
    });

    // Connection events
    socket.on('connect', () => {
      console.log('🔗 WebSocket connected');
      set({ isConnected: true, socket });
      
      // Authenticate immediately
      socket.emit('authenticate', { token });
    });

    socket.on('disconnect', () => {
      console.log('💔 WebSocket disconnected');
      set({ isConnected: false, isAuthenticated: false });
    });

    socket.on('connect_error', (error) => {
      console.error('❌ WebSocket connection error:', error);
      set({ isConnected: false, isAuthenticated: false });
    });

    // Authentication
    socket.on('auth_result', (data: { success: boolean; user_id?: string }) => {
      if (data.success) {
        console.log('✅ WebSocket authenticated');
        set({ isAuthenticated: true });
      } else {
        console.error('❌ WebSocket authentication failed');
        set({ isAuthenticated: false });
      }
    });

    // Message events
    socket.on('message_received', (message: any) => {
      console.log('📨 Message received:', message);
      get().handleMessageReceived(message);
    });

    socket.on('message_read', (data: { messageId: string; userId: string }) => {
      const state = get();
      const updatedMessages = { ...state.messages };
      
      // Update read status for all conversations
      Object.keys(updatedMessages).forEach(conversationId => {
        updatedMessages[conversationId] = updatedMessages[conversationId].map(msg => 
          msg.id === data.messageId 
            ? { ...msg, readBy: [...msg.readBy, data.userId] }
            : msg
        );
      });
      
      set({ messages: updatedMessages });
    });

    // Typing events
    socket.on('typing_start', (data: { conversationId: string; userId: string }) => {
      get().handleTypingStart(data.conversationId, data.userId);
    });

    socket.on('typing_stop', (data: { conversationId: string; userId: string }) => {
      get().handleTypingStop(data.conversationId, data.userId);
    });

    // Presence events
    socket.on('user_online', (data: { userId: string }) => {
      const state = get();
      set({
        userPresence: {
          ...state.userPresence,
          [data.userId]: {
            ...state.userPresence[data.userId],
            status: 'online',
            lastSeen: new Date().toISOString(),
          } as UserPresence,
        },
      });
    });

    socket.on('user_offline', (data: { userId: string }) => {
      const state = get();
      set({
        userPresence: {
          ...state.userPresence,
          [data.userId]: {
            ...state.userPresence[data.userId],
            status: 'offline',
            lastSeen: new Date().toISOString(),
          } as UserPresence,
        },
      });
    });

    // Error handling
    socket.on('error', (error: { message: string }) => {
      console.error('🚨 WebSocket error:', error.message);
    });

    set({ socket });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ 
        socket: null, 
        isConnected: false, 
        isAuthenticated: false,
        conversations: [],
        messages: {},
        userPresence: {},
        typingUsers: {},
      });
    }
  },

  sendMessage: (conversationId: string, content: string, messageType = 'text') => {
    const { socket, isAuthenticated } = get();
    if (!socket || !isAuthenticated) return;

    // Find conversation to get encryption key
    const conversation = get().conversations.find(c => c.id === conversationId);
    if (!conversation?.encryptionKey) {
      console.error('❌ No encryption key for conversation:', conversationId);
      return;
    }

    try {
      // Encrypt message content
      const encryptedContent = ClientEncryptionService.encryptMessage(content, conversation.encryptionKey);
      
      const message = {
        conversationId,
        content_encrypted: encryptedContent,
        message_type: messageType,
        expires_in_minutes: null, // No expiration for now
      };

      socket.emit('message_sent', { message });
      
      // Add to local state immediately for optimistic updates
      const tempMessage: Message = {
        id: `temp-${Date.now()}`,
        conversationId,
        senderId: 'current_user', // Should be current user ID
        content,
        messageType,
        createdAt: new Date().toISOString(),
        readBy: [],
        reactions: {},
      };
      
      get().handleMessageReceived(tempMessage);
      
    } catch (error) {
      console.error('❌ Failed to encrypt and send message:', error);
    }
  },

  markMessageRead: (messageId: string, conversationId: string) => {
    const { socket, isAuthenticated } = get();
    if (!socket || !isAuthenticated) return;

    socket.emit('message_read', { 
      message_id: messageId, 
      user_id: 'current_user' // Should be current user ID
    });
  },

  startTyping: (conversationId: string) => {
    const { socket, isAuthenticated } = get();
    if (!socket || !isAuthenticated) return;

    socket.emit('typing_start', { 
      conversation_id: conversationId, 
      user_id: 'current_user' 
    });
  },

  stopTyping: (conversationId: string) => {
    const { socket, isAuthenticated } = get();
    if (!socket || !isAuthenticated) return;

    socket.emit('typing_stop', { 
      conversation_id: conversationId, 
      user_id: 'current_user' 
    });
  },

  createConversation: (name: string, participantIds: string[]) => {
    // This would typically make an API call to create conversation
    // then the server would notify via WebSocket
    console.log('Creating conversation:', name, participantIds);
  },

  handleMessageReceived: (message: Message) => {
    const state = get();
    const conversationMessages = state.messages[message.conversationId] || [];
    
    // Check if message already exists (avoid duplicates)
    const existingIndex = conversationMessages.findIndex(m => m.id === message.id);
    
    let updatedMessages;
    if (existingIndex >= 0) {
      // Update existing message
      updatedMessages = [...conversationMessages];
      updatedMessages[existingIndex] = message;
    } else {
      // Add new message
      updatedMessages = [...conversationMessages, message].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
    }

    set({
      messages: {
        ...state.messages,
        [message.conversationId]: updatedMessages,
      },
    });

    // Update conversation last message
    const conversations = state.conversations.map(conv => 
      conv.id === message.conversationId
        ? { ...conv, lastMessage: message, updatedAt: message.createdAt }
        : conv
    );
    
    set({ conversations });
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

export default useWebSocketStore;