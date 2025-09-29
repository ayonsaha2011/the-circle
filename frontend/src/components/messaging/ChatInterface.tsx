import React, { useState, useEffect, useRef } from 'react';
import { useWebSocketStore } from '../../services/websocket';
import { useAuthStore } from '../../stores/authStore';
import { PaperAirplaneIcon, PaperClipIcon } from '@heroicons/react/24/outline';
import { motion, AnimatePresence } from 'framer-motion';

interface ChatInterfaceProps {
  conversationId: string;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ conversationId }) => {
  const [messageInput, setMessageInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const { user } = useAuthStore();
  const {
    messages,
    typingUsers,
    sendMessage,
    startTyping,
    stopTyping,
    markMessageRead,
  } = useWebSocketStore();

  const conversationMessages = messages[conversationId] || [];
  const currentTypingUsers = typingUsers[conversationId] || [];

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversationMessages]);

  // Mark messages as read when conversation changes
  useEffect(() => {
    if (conversationMessages.length > 0 && user) {
      const lastMessage = conversationMessages[conversationMessages.length - 1];
      if (lastMessage.senderId !== user.id && !lastMessage.readBy.includes(user.id)) {
        markMessageRead(lastMessage.id, conversationId);
      }
    }
  }, [conversationMessages, conversationId, user, markMessageRead]);

  const handleSendMessage = () => {
    if (messageInput.trim() && user) {
      sendMessage(conversationId, messageInput.trim());
      setMessageInput('');
      handleStopTyping();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value);
    
    if (!isTyping) {
      setIsTyping(true);
      startTyping(conversationId);
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing
    typingTimeoutRef.current = setTimeout(() => {
      handleStopTyping();
    }, 3000);
  };

  const handleStopTyping = () => {
    if (isTyping) {
      setIsTyping(false);
      stopTyping(conversationId);
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isConsecutiveMessage = (currentMsg: any, prevMsg: any) => {
    if (!prevMsg) return false;
    return (
      currentMsg.senderId === prevMsg.senderId &&
      new Date(currentMsg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() < 300000 // 5 minutes
    );
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-circle-gray to-circle-dark">
      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence>
          {conversationMessages.map((message, index) => {
            const isOwnMessage = message.senderId === user?.id;
            const prevMessage = conversationMessages[index - 1];
            const isConsecutive = isConsecutiveMessage(message, prevMessage);

            return (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                    isOwnMessage
                      ? 'bg-circle-blue text-white'
                      : 'glass-effect text-gray-100'
                  } ${isConsecutive ? 'mt-1' : 'mt-4'}`}
                >
                  {!isConsecutive && !isOwnMessage && (
                    <div className="text-xs text-gray-400 mb-1">
                      {message.senderId || 'Unknown User'}
                    </div>
                  )}
                  
                  <div className="break-words">{message.content}</div>
                  
                  <div className={`text-xs mt-1 ${
                    isOwnMessage ? 'text-blue-100' : 'text-gray-500'
                  }`}>
                    {formatMessageTime(message.createdAt)}
                    {isOwnMessage && message.readBy.length > 1 && (
                      <span className="ml-2">✓✓</span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Typing Indicator */}
        {currentTypingUsers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex justify-start"
          >
            <div className="glass-effect px-4 py-2 rounded-2xl">
              <div className="flex space-x-1">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-circle-blue rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-circle-blue rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                  <div className="w-2 h-2 bg-circle-blue rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                </div>
                <span className="text-xs text-gray-400 ml-2">
                  {currentTypingUsers.length === 1 ? 'Someone is typing...' : `${currentTypingUsers.length} people are typing...`}
                </span>
              </div>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-gray-700">
        <div className="flex items-center space-x-2">
          <button className="p-2 text-gray-400 hover:text-white transition-colors">
            <PaperClipIcon className="h-5 w-5" />
          </button>
          
          <div className="flex-1 relative">
            <input
              type="text"
              value={messageInput}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              onBlur={handleStopTyping}
              placeholder="Type your secure message..."
              className="w-full px-4 py-3 bg-circle-gray border border-gray-600 rounded-full text-white placeholder-gray-400 focus:outline-none focus:border-circle-blue focus:ring-2 focus:ring-circle-blue focus:ring-opacity-50"
              maxLength={1000}
            />
          </div>
          
          <button
            onClick={handleSendMessage}
            disabled={!messageInput.trim()}
            className="p-2 bg-circle-blue hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-full transition-colors"
          >
            <PaperAirplaneIcon className="h-5 w-5 text-white" />
          </button>
        </div>

        {/* Security Notice */}
        <div className="text-xs text-center text-gray-500 mt-2">
          🔒 End-to-end encrypted • Messages auto-destruct
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;