import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  UserCircleIcon, 
  CheckCircleIcon,
  ClockIcon,
  MinusCircleIcon,
  XCircleIcon
} from '@heroicons/react/24/outline';

export interface UserPresence {
  userId: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  customStatus?: string;
  lastSeen: string;
  isTyping?: boolean;
}

interface MemberStatusProps {
  userId: string;
  name: string;
  email: string;
  avatarUrl?: string;
  presence: UserPresence;
  showLastSeen?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const MemberStatus: React.FC<MemberStatusProps> = ({
  userId,
  name,
  email,
  avatarUrl,
  presence,
  showLastSeen = true,
  size = 'md'
}) => {
  const getStatusColor = (status: UserPresence['status']) => {
    switch (status) {
      case 'online': return 'bg-green-500 shadow-green-500/50';
      case 'away': return 'bg-yellow-500 shadow-yellow-500/50';
      case 'busy': return 'bg-red-500 shadow-red-500/50';
      case 'offline': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: UserPresence['status']) => {
    switch (status) {
      case 'online': return CheckCircleIcon;
      case 'away': return ClockIcon;
      case 'busy': return MinusCircleIcon;
      case 'offline': return XCircleIcon;
      default: return XCircleIcon;
    }
  };

  const getStatusText = (status: UserPresence['status']) => {
    switch (status) {
      case 'online': return 'Online';
      case 'away': return 'Away';
      case 'busy': return 'Busy';
      case 'offline': return 'Offline';
      default: return 'Unknown';
    }
  };

  const formatLastSeen = (lastSeen: string) => {
    const date = new Date(lastSeen);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (presence.status === 'online') return 'Active now';
    if (diffMins < 5) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm': return {
        avatar: 'w-8 h-8',
        status: 'w-2.5 h-2.5 -bottom-0.5 -right-0.5',
        text: 'text-sm',
        subtext: 'text-xs'
      };
      case 'lg': return {
        avatar: 'w-16 h-16',
        status: 'w-4 h-4 -bottom-1 -right-1',
        text: 'text-lg',
        subtext: 'text-sm'
      };
      default: return {
        avatar: 'w-12 h-12',
        status: 'w-3 h-3 -bottom-0.5 -right-0.5',
        text: 'text-base',
        subtext: 'text-sm'
      };
    }
  };

  const sizeClasses = getSizeClasses();
  const StatusIconComponent = getStatusIcon(presence.status);

  return (
    <div className="flex items-center space-x-3">
      {/* Avatar with Status Indicator */}
      <div className="relative">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={name}
            className={`${sizeClasses.avatar} rounded-full object-cover border-2 border-gray-600`}
          />
        ) : (
          <div className={`${sizeClasses.avatar} rounded-full bg-gradient-to-r from-circle-blue to-circle-purple flex items-center justify-center border-2 border-gray-600`}>
            <span className="text-white font-semibold">
              {name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        
        {/* Status Indicator */}
        <motion.div
          className={`absolute ${sizeClasses.status} rounded-full border-2 border-gray-800 ${getStatusColor(presence.status)}`}
          animate={presence.status === 'online' ? { 
            boxShadow: ['0 0 0 rgba(34, 197, 94, 0)', '0 0 10px rgba(34, 197, 94, 0.5)', '0 0 0 rgba(34, 197, 94, 0)']
          } : {}}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </div>

      {/* User Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2">
          <h4 className={`font-medium text-white truncate ${sizeClasses.text}`}>
            {name}
          </h4>
          
          {presence.isTyping && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center space-x-1 text-circle-blue"
            >
              <div className="flex space-x-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1 h-1 bg-circle-blue rounded-full"
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      delay: i * 0.2
                    }}
                  />
                ))}
              </div>
              <span className="text-xs">typing...</span>
            </motion.div>
          )}
        </div>
        
        <div className="flex items-center space-x-2 mt-1">
          <StatusIconComponent className={`h-3 w-3 ${
            presence.status === 'online' ? 'text-green-400' :
            presence.status === 'away' ? 'text-yellow-400' :
            presence.status === 'busy' ? 'text-red-400' :
            'text-gray-400'
          }`} />
          
          <span className={`${sizeClasses.subtext} ${
            presence.status === 'online' ? 'text-green-400' :
            presence.status === 'away' ? 'text-yellow-400' :
            presence.status === 'busy' ? 'text-red-400' :
            'text-gray-400'
          }`}>
            {getStatusText(presence.status)}
          </span>
          
          {presence.customStatus && (
            <>
              <span className="text-gray-500">•</span>
              <span className={`${sizeClasses.subtext} text-gray-400 truncate`}>
                {presence.customStatus}
              </span>
            </>
          )}
        </div>
        
        {showLastSeen && presence.status !== 'online' && (
          <p className={`${sizeClasses.subtext} text-gray-500 mt-0.5`}>
            {formatLastSeen(presence.lastSeen)}
          </p>
        )}
      </div>
    </div>
  );
};

interface MemberListProps {
  members: Array<{
    id: string;
    name: string;
    email: string;
    avatarUrl?: string;
    presence: UserPresence;
  }>;
  title?: string;
  showOffline?: boolean;
}

const MemberList: React.FC<MemberListProps> = ({ 
  members, 
  title = "Members", 
  showOffline = true 
}) => {
  const [filter, setFilter] = useState<'all' | 'online' | 'away' | 'busy'>('all');

  const filteredMembers = members.filter(member => {
    if (!showOffline && member.presence.status === 'offline') return false;
    if (filter === 'all') return true;
    return member.presence.status === filter;
  });

  const sortedMembers = filteredMembers.sort((a, b) => {
    // Sort by status priority: online > away > busy > offline
    const statusPriority = { online: 4, away: 3, busy: 2, offline: 1 };
    const aPriority = statusPriority[a.presence.status];
    const bPriority = statusPriority[b.presence.status];
    
    if (aPriority !== bPriority) {
      return bPriority - aPriority;
    }
    
    // If same status, sort by name
    return a.name.localeCompare(b.name);
  });

  const getStatusCount = (status: UserPresence['status']) => {
    return members.filter(m => m.presence.status === status).length;
  };

  return (
    <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <div className="flex items-center space-x-1 text-sm">
          <span className="text-green-400">{getStatusCount('online')}</span>
          <span className="text-gray-500">/</span>
          <span className="text-gray-400">{members.length}</span>
        </div>
      </div>

      {/* Status Filter */}
      <div className="flex space-x-2 mb-4">
        {(['all', 'online', 'away', 'busy'] as const).map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              filter === status
                ? 'bg-circle-blue text-white'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
            {status !== 'all' && (
              <span className="ml-1 opacity-75">
                ({getStatusCount(status)})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Member List */}
      <div className="space-y-4">
        {sortedMembers.length === 0 ? (
          <div className="text-center py-8">
            <UserCircleIcon className="h-12 w-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No members found</p>
          </div>
        ) : (
          sortedMembers.map(member => (
            <motion.div
              key={member.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-3 rounded-lg hover:bg-gray-700/50 transition-colors"
            >
              <MemberStatus
                userId={member.id}
                name={member.name}
                email={member.email}
                avatarUrl={member.avatarUrl}
                presence={member.presence}
              />
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
};

export { MemberStatus, MemberList };
export default MemberStatus;