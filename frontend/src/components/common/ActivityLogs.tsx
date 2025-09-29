import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XCircleIcon,
  EyeIcon,
  KeyIcon,
  LockClosedIcon,
  ClockIcon,
  UserIcon,
  DocumentIcon,
  ChatBubbleLeftIcon,
  ArrowRightOnRectangleIcon,
  ArrowLeftOnRectangleIcon,
  TrashIcon
} from '@heroicons/react/24/outline';

export interface ActivityLog {
  id: string;
  userId?: string;
  userName?: string;
  eventType: string;
  description: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  timestamp: string;
  category: 'auth' | 'messaging' | 'vault' | 'system' | 'security';
}

interface ActivityLogsProps {
  logs: ActivityLog[];
  isLoading?: boolean;
  onRefresh?: () => void;
  onClearLogs?: () => void;
}

const ActivityLogs: React.FC<ActivityLogsProps> = ({ 
  logs, 
  isLoading = false,
  onRefresh,
  onClearLogs 
}) => {
  const [filter, setFilter] = useState<ActivityLog['category'] | 'all'>('all');
  const [severityFilter, setSeverityFilter] = useState<ActivityLog['severity'] | 'all'>('all');
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const getEventIcon = (eventType: string, category: ActivityLog['category']) => {
    const iconMap: Record<string, React.ComponentType<any>> = {
      // Auth events
      login: ArrowRightOnRectangleIcon,
      logout: ArrowLeftOnRectangleIcon,
      login_failed: XCircleIcon,
      registration: UserIcon,
      password_change: KeyIcon,
      
      // Messaging events
      message_sent: ChatBubbleLeftIcon,
      message_received: ChatBubbleLeftIcon,
      conversation_created: ChatBubbleLeftIcon,
      
      // Vault events
      file_uploaded: DocumentIcon,
      file_downloaded: EyeIcon,
      file_deleted: TrashIcon,
      
      // Security events
      security_alert: ExclamationTriangleIcon,
      encryption_key_rotated: KeyIcon,
      access_denied: LockClosedIcon,
      
      // System events
      system_startup: InformationCircleIcon,
      cleanup_completed: InformationCircleIcon,
      backup_created: InformationCircleIcon,
    };

    return iconMap[eventType] || InformationCircleIcon;
  };

  const getSeverityColor = (severity: ActivityLog['severity']) => {
    switch (severity) {
      case 'info': return 'text-blue-400 bg-blue-900/20';
      case 'warning': return 'text-yellow-400 bg-yellow-900/20';
      case 'error': return 'text-red-400 bg-red-900/20';
      case 'critical': return 'text-red-500 bg-red-900/40';
      default: return 'text-gray-400 bg-gray-900/20';
    }
  };

  const getCategoryColor = (category: ActivityLog['category']) => {
    switch (category) {
      case 'auth': return 'text-green-400 bg-green-900/20';
      case 'messaging': return 'text-blue-400 bg-blue-900/20';
      case 'vault': return 'text-purple-400 bg-purple-900/20';
      case 'system': return 'text-gray-400 bg-gray-900/20';
      case 'security': return 'text-red-400 bg-red-900/20';
      default: return 'text-gray-400 bg-gray-900/20';
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const filteredLogs = logs.filter(log => {
    if (filter !== 'all' && log.category !== filter) return false;
    if (severityFilter !== 'all' && log.severity !== severityFilter) return false;
    return true;
  });

  const getCategoryCount = (category: ActivityLog['category']) => {
    return logs.filter(log => log.category === category).length;
  };

  const getSeverityCount = (severity: ActivityLog['severity']) => {
    return logs.filter(log => log.severity === severity).length;
  };

  return (
    <div className="bg-gray-800/50 rounded-lg border border-gray-700">
      {/* Header */}
      <div className="p-6 border-b border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-xl font-bold text-white flex items-center space-x-2">
              <ShieldCheckIcon className="h-6 w-6 text-circle-blue" />
              <span>Activity & Security Logs</span>
            </h3>
            <p className="text-gray-400 mt-1">
              Real-time monitoring of system events and security activities
            </p>
          </div>
          
          <div className="flex space-x-3">
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isLoading}
                className="btn-secondary px-4 py-2 flex items-center space-x-2"
              >
                <ClockIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            )}
            
            {onClearLogs && (
              <button
                onClick={onClearLogs}
                className="btn-danger px-4 py-2 flex items-center space-x-2"
              >
                <TrashIcon className="h-4 w-4" />
                <span>Clear</span>
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-3">
          {/* Category Filter */}
          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">Category</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  filter === 'all'
                    ? 'bg-circle-blue text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                All ({logs.length})
              </button>
              
              {(['auth', 'messaging', 'vault', 'system', 'security'] as const).map(category => (
                <button
                  key={category}
                  onClick={() => setFilter(category)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    filter === category
                      ? 'bg-circle-blue text-white'
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
                >
                  {category.charAt(0).toUpperCase() + category.slice(1)} ({getCategoryCount(category)})
                </button>
              ))}
            </div>
          </div>

          {/* Severity Filter */}
          <div>
            <label className="text-sm font-medium text-gray-300 mb-2 block">Severity</label>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSeverityFilter('all')}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  severityFilter === 'all'
                    ? 'bg-circle-blue text-white'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                }`}
              >
                All
              </button>
              
              {(['info', 'warning', 'error', 'critical'] as const).map(severity => (
                <button
                  key={severity}
                  onClick={() => setSeverityFilter(severity)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    severityFilter === severity
                      ? 'bg-circle-blue text-white'
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
                >
                  {severity.charAt(0).toUpperCase() + severity.slice(1)} ({getSeverityCount(severity)})
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Logs List */}
      <div className="max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-circle-blue"></div>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-12">
            <InformationCircleIcon className="h-12 w-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">No activity logs found</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            <AnimatePresence>
              {filteredLogs.map((log, index) => {
                const IconComponent = getEventIcon(log.eventType, log.category);
                const isExpanded = expandedLog === log.id;
                
                return (
                  <motion.div
                    key={log.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-4 hover:bg-gray-700/30 transition-colors cursor-pointer"
                    onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                  >
                    <div className="flex items-start space-x-3">
                      {/* Event Icon */}
                      <div className={`p-2 rounded-full ${getSeverityColor(log.severity)}`}>
                        <IconComponent className="h-4 w-4" />
                      </div>

                      {/* Event Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <h4 className="text-sm font-medium text-white truncate">
                              {log.description}
                            </h4>
                            
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(log.category)}`}>
                              {log.category}
                            </span>
                            
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(log.severity)}`}>
                              {log.severity}
                            </span>
                          </div>
                          
                          <span className="text-xs text-gray-500">
                            {formatTimestamp(log.timestamp)}
                          </span>
                        </div>

                        {log.userName && (
                          <p className="text-xs text-gray-400 mt-1">
                            by {log.userName}
                          </p>
                        )}

                        {/* Expanded Details */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="mt-3 overflow-hidden"
                            >
                              <div className="bg-gray-900/50 rounded-lg p-3 space-y-2">
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                  <div>
                                    <span className="text-gray-400">Event Type:</span>
                                    <span className="text-white ml-2">{log.eventType}</span>
                                  </div>
                                  
                                  <div>
                                    <span className="text-gray-400">Timestamp:</span>
                                    <span className="text-white ml-2">
                                      {new Date(log.timestamp).toLocaleString()}
                                    </span>
                                  </div>
                                  
                                  {log.ipAddress && (
                                    <div>
                                      <span className="text-gray-400">IP Address:</span>
                                      <span className="text-white ml-2">{log.ipAddress}</span>
                                    </div>
                                  )}
                                  
                                  {log.userId && (
                                    <div>
                                      <span className="text-gray-400">User ID:</span>
                                      <span className="text-white ml-2">{log.userId}</span>
                                    </div>
                                  )}
                                </div>

                                {log.metadata && Object.keys(log.metadata).length > 0 && (
                                  <div>
                                    <span className="text-gray-400 text-xs">Metadata:</span>
                                    <pre className="text-xs text-gray-300 mt-1 bg-black/30 p-2 rounded overflow-x-auto">
                                      {JSON.stringify(log.metadata, null, 2)}
                                    </pre>
                                  </div>
                                )}

                                {log.userAgent && (
                                  <div>
                                    <span className="text-gray-400 text-xs">User Agent:</span>
                                    <p className="text-xs text-gray-300 mt-1 break-all">
                                      {log.userAgent}
                                    </p>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-gray-700 bg-gray-900/30">
        <div className="flex justify-between items-center text-xs text-gray-500">
          <span>
            Showing {filteredLogs.length} of {logs.length} events
          </span>
          <span>
            Auto-refresh enabled • Retention: 30 days
          </span>
        </div>
      </div>
    </div>
  );
};

export default ActivityLogs;