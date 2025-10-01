import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useWebSocketStore, Conversation } from '../../services/websocket';
import ConversationShare from './ConversationShare';
import { 
  ChatBubbleLeftRightIcon, 
  UsersIcon, 
  LockClosedIcon,
  EllipsisVerticalIcon,
  ShareIcon,
  UserPlusIcon
} from '@heroicons/react/24/outline';

interface ConversationListProps {
  onSelectConversation: (conversationId: string) => void;
  selectedConversationId: string | null;
}

const ConversationList: React.FC<ConversationListProps> = ({ 
  onSelectConversation, 
  selectedConversationId 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showNewConversationModal, setShowNewConversationModal] = useState(false);
  const [shareConversationId, setShareConversationId] = useState<string | null>(null);
  const { conversations, messages, userPresence, createConversation } = useWebSocketStore();

  const filteredConversations = conversations.filter(conv =>
    conv.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getLastMessagePreview = (conversation: Conversation): string => {
    const conversationMessages = messages[conversation.id] || [];
    if (conversationMessages.length === 0) return 'No messages yet';
    
    const lastMessage = conversationMessages[conversationMessages.length - 1];
    
    // Truncate long messages
    const content = lastMessage.content || '[Encrypted Message]';
    return content.length > 50 ? content.substring(0, 50) + '...' : content;
  };

  const getUnreadCount = (conversationId: string): number => {
    const conversationMessages = messages[conversationId] || [];
    // This would normally check against current user's read status
    return conversationMessages.filter(msg => 
      msg.senderId !== 'current_user' && // Should be actual current user ID
      !msg.readBy.includes('current_user') // Should be actual current user ID
    ).length;
  };

  const formatLastMessageTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const getConversationIcon = (conversation: Conversation) => {
    switch (conversation.type) {
      case 'direct':
        return <ChatBubbleLeftRightIcon className="h-5 w-5" />;
      case 'group':
        return <UsersIcon className="h-5 w-5" />;
      default:
        return <LockClosedIcon className="h-5 w-5" />;
    }
  };

  const getOnlineParticipantsCount = (conversation: Conversation): number => {
    return conversation.participants.filter(participantId => 
      userPresence[participantId]?.status === 'online'
    ).length;
  };

  const handleNewConversation = () => {
    // For now, create a simple test conversation
    const testConversationName = `Test Conversation ${Date.now()}`;
    createConversation(testConversationName, ['test@example.com']);
    setShowNewConversationModal(false);
  };

  const handleShareConversation = (conversationId: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent conversation selection
    setShareConversationId(conversationId);
  };

  const startDirectChat = () => {
    const email = prompt('Enter email address for direct chat:');
    if (email && email.trim()) {
      createConversation("", [email.trim()]);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-circle-gray to-circle-dark border-r border-gray-700">
      {/* Header */}
      <div className="p-4 border-b border-gray-700">
        <h2 className="text-xl font-bold text-white mb-4">Messages</h2>
        
        {/* Search */}
        <input
          type="text"
          placeholder="Search conversations..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 bg-circle-dark border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-circle-blue"
        />
      </div>

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <ChatBubbleLeftRightIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No conversations yet</p>
            <p className="text-sm">Start a secure conversation</p>
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {filteredConversations.map((conversation) => {
              const unreadCount = getUnreadCount(conversation.id);
              const isSelected = selectedConversationId === conversation.id;
              const onlineCount = getOnlineParticipantsCount(conversation);

              return (
                <motion.div
                  key={conversation.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  whileHover={{ x: 4 }}
                  onClick={() => onSelectConversation(conversation.id)}
                  className={`group p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                    isSelected
                      ? 'bg-circle-blue/20 border border-circle-blue'
                      : 'hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    {/* Conversation Icon */}
                    <div className={`p-2 rounded-full ${
                      isSelected ? 'bg-circle-blue' : 'bg-gray-600'
                    }`}>
                      {getConversationIcon(conversation)}
                    </div>

                    {/* Conversation Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-white truncate">
                          {conversation.name || `Conversation ${conversation.id.slice(0, 8)}`}
                        </h3>
                        
                        {conversation.lastMessage && (
                          <span className="text-xs text-gray-400">
                            {formatLastMessageTime(conversation.lastMessage.createdAt)}
                          </span>
                        )}
                      </div>

                      {/* Last message preview */}
                      <p className="text-sm text-gray-400 truncate mt-1">
                        {getLastMessagePreview(conversation)}
                      </p>

                      {/* Status indicators */}
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center space-x-2">
                          {/* Online indicator for group chats */}
                          {conversation.type === 'group' && onlineCount > 0 && (
                            <div className="flex items-center space-x-1">
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span className="text-xs text-green-400">
                                {onlineCount} online
                              </span>
                            </div>
                          )}

                          {/* Encryption indicator */}
                          <LockClosedIcon className="h-3 w-3 text-circle-green" title="End-to-end encrypted" />
                        </div>

                        {/* Unread count */}
                        {unreadCount > 0 && (
                          <div className="bg-circle-blue text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                            {unreadCount > 99 ? '99+' : unreadCount}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Share button - appears on hover */}
                    <button 
                      onClick={(e) => handleShareConversation(conversation.id, e)}
                      className="p-1 text-gray-400 hover:text-circle-blue opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Share conversation"
                    >
                      <ShareIcon className="h-4 w-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-700 space-y-2">
        <button 
          onClick={handleNewConversation}
          className="w-full py-2 bg-circle-blue hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors"
        >
          + New Group Chat
        </button>
        
        <button 
          onClick={startDirectChat}
          className="w-full py-2 bg-circle-green hover:bg-green-700 text-white rounded-lg font-semibold transition-colors flex items-center justify-center"
        >
          <UserPlusIcon className="h-4 w-4 mr-2" />
          Start Direct Chat
        </button>
      </div>

      {/* Conversation Share Modal */}
      {shareConversationId && (
        <ConversationShare
          isOpen={true}
          onClose={() => setShareConversationId(null)}
          conversationId={shareConversationId}
          conversationName={conversations.find(c => c.id === shareConversationId)?.name}
        />
      )}
    </div>
  );
};

export default ConversationList;