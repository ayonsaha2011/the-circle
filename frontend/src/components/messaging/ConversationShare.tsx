import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  UserPlusIcon,
  LinkIcon,
  PaperAirplaneIcon,
  ClipboardIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { useWebSocketStore } from '../../services/websocket';
import ApiService from '../../services/api';

interface ConversationShareProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  conversationName?: string;
}

const ConversationShare: React.FC<ConversationShareProps> = ({
  isOpen,
  onClose,
  conversationId,
  conversationName,
}) => {
  const [inviteEmails, setInviteEmails] = useState<string>('');
  const [inviteLink, setInviteLink] = useState<string>('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'invite' | 'link'>('invite');

  const { conversations } = useWebSocketStore();
  const conversation = conversations.find(c => c.id === conversationId);

  const handleInviteByEmail = async () => {
    if (!inviteEmails.trim()) return;

    setLoading(true);
    try {
      const emails = inviteEmails.split(',').map(email => email.trim()).filter(Boolean);
      
      const response = await ApiService.post(`/api/conversations/${conversationId}/participants`, {
        participant_emails: emails,
      });

      if (response.status === 200) {
        alert('Participants invited successfully!');
        setInviteEmails('');
        onClose();
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to invite participants';
      alert(`Error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateInviteLink = async () => {
    setLoading(true);
    try {
      const response = await ApiService.post(`/api/conversations/${conversationId}/invite`);
      
      if (response.data.invite_link) {
        setInviteLink(response.data.invite_link);
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || 'Failed to generate invite link';
      alert(`Error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (inviteLink) {
      try {
        await navigator.clipboard.writeText(inviteLink);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      } catch (error) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = inviteLink;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
      }
    }
  };

  const startDirectChat = async (email: string) => {
    const { createConversation } = useWebSocketStore.getState();
    createConversation("", [email]); // Empty name for direct chat
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-circle-dark border border-gray-700 rounded-xl p-6 w-full max-w-md mx-4"
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-white">
              Share Conversation
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Conversation Info */}
          <div className="mb-6 p-4 bg-gray-800/50 rounded-lg">
            <h4 className="font-semibold text-white">
              {conversationName || 'Unnamed Conversation'}
            </h4>
            <p className="text-sm text-gray-400">
              {conversation?.participants.length || 0} participants
            </p>
          </div>

          {/* Tabs */}
          <div className="flex mb-6 bg-gray-800 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('invite')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'invite'
                  ? 'bg-circle-blue text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <UserPlusIcon className="h-4 w-4 inline mr-2" />
              Invite by Email
            </button>
            <button
              onClick={() => setActiveTab('link')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'link'
                  ? 'bg-circle-blue text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <LinkIcon className="h-4 w-4 inline mr-2" />
              Invite Link
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'invite' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Email Addresses (comma-separated)
                </label>
                <textarea
                  value={inviteEmails}
                  onChange={(e) => setInviteEmails(e.target.value)}
                  placeholder="friend@example.com, colleague@work.com"
                  className="w-full px-4 py-3 bg-circle-gray border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-circle-blue focus:ring-2 focus:ring-circle-blue focus:ring-opacity-50 resize-none"
                  rows={3}
                />
              </div>
              
              <button
                onClick={handleInviteByEmail}
                disabled={loading || !inviteEmails.trim()}
                className="w-full py-3 bg-circle-blue hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors flex items-center justify-center"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <>
                    <PaperAirplaneIcon className="h-5 w-5 mr-2" />
                    Send Invites
                  </>
                )}
              </button>

              <div className="text-center">
                <p className="text-gray-400 text-sm mb-2">Or start a one-to-one chat:</p>
                <input
                  type="email"
                  placeholder="Enter email for direct chat"
                  className="w-full px-4 py-2 bg-circle-gray border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-circle-green focus:ring-2 focus:ring-circle-green focus:ring-opacity-50"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      const email = e.currentTarget.value.trim();
                      if (email) {
                        startDirectChat(email);
                        e.currentTarget.value = '';
                      }
                    }
                  }}
                />
              </div>
            </div>
          )}

          {activeTab === 'link' && (
            <div className="space-y-4">
              <p className="text-gray-400 text-sm">
                Generate a shareable invite link that expires in 24 hours.
              </p>
              
              {!inviteLink ? (
                <button
                  onClick={handleGenerateInviteLink}
                  disabled={loading}
                  className="w-full py-3 bg-circle-green hover:bg-green-700 disabled:opacity-50 text-white font-semibold rounded-lg transition-colors flex items-center justify-center"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <LinkIcon className="h-5 w-5 mr-2" />
                      Generate Invite Link
                    </>
                  )}
                </button>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 bg-gray-800 rounded-lg border border-gray-600">
                    <p className="text-sm text-gray-400 mb-2">Invite Link:</p>
                    <p className="text-white text-sm break-all">{inviteLink}</p>
                  </div>
                  
                  <button
                    onClick={handleCopyLink}
                    className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center"
                  >
                    {linkCopied ? (
                      <>
                        <CheckIcon className="h-5 w-5 mr-2 text-green-400" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <ClipboardIcon className="h-5 w-5 mr-2" />
                        Copy Link
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Security Notice */}
          <div className="mt-6 p-3 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
            <p className="text-yellow-400 text-xs text-center">
              🔒 All conversations are end-to-end encrypted. New participants will only see messages sent after they join.
            </p>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ConversationShare;