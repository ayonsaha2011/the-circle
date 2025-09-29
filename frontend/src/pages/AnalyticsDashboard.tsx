import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChartBarIcon,
  BoltIcon,
  UserGroupIcon,
  ChatBubbleLeftRightIcon,
  ShieldCheckIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  EyeIcon,
  CpuChipIcon,
  GlobeAltIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

// Types for analytics data
interface MetricCard {
  id: string;
  title: string;
  value: string | number;
  change: number;
  changeType: 'increase' | 'decrease' | 'neutral';
  icon: React.ComponentType<any>;
  color: string;
  subtitle?: string;
}

interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    borderColor: string;
    backgroundColor: string;
  }>;
}

interface AiInsight {
  id: string;
  type: 'opportunity' | 'warning' | 'info' | 'success';
  title: string;
  description: string;
  confidence: number;
  recommendation: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

interface PerformanceMetric {
  component: string;
  metric: string;
  value: number;
  unit: string;
  status: 'normal' | 'warning' | 'critical';
  threshold_warning: number;
  threshold_critical: number;
}

const AnalyticsDashboard: React.FC = () => {
  const [selectedTimeRange, setSelectedTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [metrics, setMetrics] = useState<MetricCard[]>([]);
  const [aiInsights, setAiInsights] = useState<AiInsight[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetric[]>([]);
  const [engagementData, setEngagementData] = useState<ChartData | null>(null);
  const [securityData, setSecurityData] = useState<ChartData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    loadAnalyticsData();
    
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(loadAnalyticsData, 30000); // Refresh every 30 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [selectedTimeRange, autoRefresh]);

  const loadAnalyticsData = async () => {
    try {
      setIsLoading(true);
      
      // Mock data - in production, fetch from API
      const mockMetrics: MetricCard[] = [
        {
          id: 'active_users',
          title: 'Active Users',
          value: '2,847',
          change: 12.5,
          changeType: 'increase',
          icon: UserGroupIcon,
          color: 'text-blue-400',
          subtitle: 'Last 24 hours'
        },
        {
          id: 'messages_sent',
          title: 'Messages Sent',
          value: '45,231',
          change: 8.3,
          changeType: 'increase',
          icon: ChatBubbleLeftRightIcon,
          color: 'text-green-400',
          subtitle: 'Today'
        },
        {
          id: 'threat_blocked',
          title: 'Threats Blocked',
          value: '127',
          change: -15.2,
          changeType: 'decrease',
          icon: ShieldCheckIcon,
          color: 'text-red-400',
          subtitle: 'AI Detection'
        },
        {
          id: 'avg_response_time',
          title: 'Avg Response Time',
          value: '23ms',
          change: -5.7,
          changeType: 'decrease',
          icon: BoltIcon,
          color: 'text-purple-400',
          subtitle: 'API Performance'
        },
        {
          id: 'ai_accuracy',
          title: 'AI Accuracy',
          value: '97.8%',
          change: 2.1,
          changeType: 'increase',
          icon: CpuChipIcon,
          color: 'text-yellow-400',
          subtitle: 'ML Models'
        },
        {
          id: 'uptime',
          title: 'System Uptime',
          value: '99.97%',
          change: 0.03,
          changeType: 'increase',
          icon: CheckCircleIcon,
          color: 'text-emerald-400',
          subtitle: 'Last 30 days'
        }
      ];

      const mockInsights: AiInsight[] = [
        {
          id: '1',
          type: 'opportunity',
          title: 'Peak Usage Pattern Detected',
          description: 'User activity peaks at 2-4 PM daily. Consider optimizing server resources during this window.',
          confidence: 0.89,
          recommendation: 'Scale infrastructure during peak hours to improve performance',
          priority: 'medium'
        },
        {
          id: '2',
          type: 'warning',
          title: 'Anomalous Login Pattern',
          description: 'Detected 23% increase in failed login attempts from new geographic regions.',
          confidence: 0.94,
          recommendation: 'Review geographic access patterns and consider additional security measures',
          priority: 'high'
        },
        {
          id: '3',
          type: 'success',
          title: 'Content Moderation Efficiency',
          description: 'AI content moderation accuracy improved to 97.8% with 34% fewer false positives.',
          confidence: 0.96,
          recommendation: 'Continue current model training approach',
          priority: 'low'
        },
        {
          id: '4',
          type: 'info',
          title: 'User Engagement Trend',
          description: 'Average session duration increased by 18% following UI personalization features.',
          confidence: 0.87,
          recommendation: 'Expand personalization to more interface elements',
          priority: 'medium'
        }
      ];

      const mockPerformanceMetrics: PerformanceMetric[] = [
        {
          component: 'API Gateway',
          metric: 'Response Time',
          value: 23.4,
          unit: 'ms',
          status: 'normal',
          threshold_warning: 50,
          threshold_critical: 100
        },
        {
          component: 'Database',
          metric: 'Query Time',
          value: 8.7,
          unit: 'ms',
          status: 'normal',
          threshold_warning: 20,
          threshold_critical: 50
        },
        {
          component: 'AI Models',
          metric: 'Inference Time',
          value: 145.2,
          unit: 'ms',
          status: 'warning',
          threshold_warning: 150,
          threshold_critical: 300
        },
        {
          component: 'Memory Usage',
          metric: 'System RAM',
          value: 68.3,
          unit: '%',
          status: 'normal',
          threshold_warning: 80,
          threshold_critical: 95
        },
        {
          component: 'CPU Usage',
          metric: 'System CPU',
          value: 34.7,
          unit: '%',
          status: 'normal',
          threshold_warning: 70,
          threshold_critical: 90
        }
      ];

      // Mock chart data
      const mockEngagementData: ChartData = {
        labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
        datasets: [
          {
            label: 'Active Users',
            data: [1200, 800, 1500, 2800, 3200, 2100],
            borderColor: '#3B82F6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)'
          },
          {
            label: 'Messages/Hour',
            data: [800, 400, 1200, 2200, 2800, 1600],
            borderColor: '#10B981',
            backgroundColor: 'rgba(16, 185, 129, 0.1)'
          }
        ]
      };

      const mockSecurityData: ChartData = {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [
          {
            label: 'Threats Detected',
            data: [45, 62, 38, 51, 73, 29, 41],
            borderColor: '#EF4444',
            backgroundColor: 'rgba(239, 68, 68, 0.1)'
          },
          {
            label: 'Blocked Attempts',
            data: [12, 18, 9, 15, 24, 8, 11],
            borderColor: '#F59E0B',
            backgroundColor: 'rgba(245, 158, 11, 0.1)'
          }
        ]
      };

      setMetrics(mockMetrics);
      setAiInsights(mockInsights);
      setPerformanceMetrics(mockPerformanceMetrics);
      setEngagementData(mockEngagementData);
      setSecurityData(mockSecurityData);
      
    } catch (error) {
      console.error('Failed to load analytics data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getChangeIcon = (changeType: string) => {
    switch (changeType) {
      case 'increase': return ArrowTrendingUpIcon;
      case 'decrease': return ArrowTrendingDownIcon;
      default: return ClockIcon;
    }
  };

  const getChangeColor = (changeType: string) => {
    switch (changeType) {
      case 'increase': return 'text-green-400';
      case 'decrease': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'opportunity': return ArrowTrendingUpIcon;
      case 'warning': return ExclamationTriangleIcon;
      case 'success': return CheckCircleIcon;
      default: return EyeIcon;
    }
  };

  const getInsightColor = (type: string) => {
    switch (type) {
      case 'opportunity': return 'text-blue-400 bg-blue-900/20';
      case 'warning': return 'text-yellow-400 bg-yellow-900/20';
      case 'success': return 'text-green-400 bg-green-900/20';
      default: return 'text-gray-400 bg-gray-900/20';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      default: return 'bg-blue-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal': return 'text-green-400';
      case 'warning': return 'text-yellow-400';
      case 'critical': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-circle-dark via-gray-900 to-black">
      {/* Header */}
      <div className="glass-effect border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gradient flex items-center space-x-3">
                <ChartBarIcon className="h-8 w-8 text-circle-blue" />
                <span>AI Analytics Dashboard</span>
              </h1>
              <p className="text-gray-400 mt-1">Intelligent insights and real-time monitoring</p>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Time Range Selector */}
              <div className="flex space-x-1 bg-gray-800/50 p-1 rounded-lg">
                {[
                  { key: '1h', label: '1H' },
                  { key: '24h', label: '24H' },
                  { key: '7d', label: '7D' },
                  { key: '30d', label: '30D' },
                ].map(range => (
                  <button
                    key={range.key}
                    onClick={() => setSelectedTimeRange(range.key as any)}
                    className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                      selectedTimeRange === range.key
                        ? 'bg-circle-blue text-white'
                        : 'text-gray-400 hover:text-white hover:bg-gray-700'
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
              
              {/* Auto Refresh Toggle */}
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`flex items-center space-x-2 px-3 py-1 rounded-lg text-sm ${
                  autoRefresh ? 'bg-green-900/20 text-green-400' : 'bg-gray-800/50 text-gray-400'
                }`}
              >
                <ArrowPathIcon className={`h-4 w-4 ${autoRefresh ? 'animate-spin' : ''}`} />
                <span>Auto Refresh</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-circle-blue"></div>
          </div>
        )}

        {!isLoading && (
          <>
            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
              {metrics.map((metric, index) => {
                const ChangeIcon = getChangeIcon(metric.changeType);
                const IconComponent = metric.icon;
                
                return (
                  <motion.div
                    key={metric.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="glass-effect p-6 rounded-lg border border-gray-700"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <IconComponent className={`h-8 w-8 ${metric.color}`} />
                      <div className={`flex items-center space-x-1 text-sm ${getChangeColor(metric.changeType)}`}>
                        <ChangeIcon className="h-4 w-4" />
                        <span>{Math.abs(metric.change)}%</span>
                      </div>
                    </div>
                    
                    <h3 className="text-2xl font-bold text-white mb-1">{metric.value}</h3>
                    <p className="text-gray-400 text-sm">{metric.title}</p>
                    {metric.subtitle && (
                      <p className="text-gray-500 text-xs mt-1">{metric.subtitle}</p>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* AI Insights Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
              {/* AI Insights */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="glass-effect p-6 rounded-lg border border-gray-700"
              >
                <h2 className="text-xl font-bold text-white mb-6 flex items-center space-x-2">
                  <CpuChipIcon className="h-6 w-6 text-circle-purple" />
                  <span>AI Insights</span>
                </h2>
                
                <div className="space-y-4">
                  {aiInsights.map(insight => {
                    const InsightIcon = getInsightIcon(insight.type);
                    
                    return (
                      <motion.div
                        key={insight.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-4 bg-gray-800/30 rounded-lg border border-gray-700"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center space-x-3">
                            <div className={`p-2 rounded-lg ${getInsightColor(insight.type)}`}>
                              <InsightIcon className="h-4 w-4" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-white">{insight.title}</h3>
                              <div className="flex items-center space-x-2 mt-1">
                                <div className={`w-2 h-2 rounded-full ${getPriorityColor(insight.priority)}`}></div>
                                <span className="text-xs text-gray-400">{insight.confidence * 100}% confidence</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <p className="text-gray-300 text-sm mb-2">{insight.description}</p>
                        <p className="text-circle-blue text-sm">💡 {insight.recommendation}</p>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>

              {/* Performance Monitoring */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="glass-effect p-6 rounded-lg border border-gray-700"
              >
                <h2 className="text-xl font-bold text-white mb-6 flex items-center space-x-2">
                  <BoltIcon className="h-6 w-6 text-yellow-400" />
                  <span>System Performance</span>
                </h2>
                
                <div className="space-y-4">
                  {performanceMetrics.map(metric => (
                    <div key={`${metric.component}-${metric.metric}`} className="flex items-center justify-between p-3 bg-gray-800/30 rounded-lg">
                      <div>
                        <h4 className="text-white font-medium">{metric.component}</h4>
                        <p className="text-gray-400 text-sm">{metric.metric}</p>
                      </div>
                      
                      <div className="text-right">
                        <div className={`text-lg font-bold ${getStatusColor(metric.status)}`}>
                          {metric.value}{metric.unit}
                        </div>
                        <div className="text-xs text-gray-500">
                          Warn: {metric.threshold_warning}{metric.unit}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* User Engagement Chart */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-effect p-6 rounded-lg border border-gray-700"
              >
                <h2 className="text-xl font-bold text-white mb-6 flex items-center space-x-2">
                  <UserGroupIcon className="h-6 w-6 text-blue-400" />
                  <span>User Engagement Trends</span>
                </h2>
                
                <div className="h-64 flex items-center justify-center bg-gray-800/30 rounded-lg">
                  <p className="text-gray-400">
                    📊 Interactive chart would be rendered here<br />
                    (Chart.js or similar charting library)
                  </p>
                </div>
              </motion.div>

              {/* Security Analytics Chart */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="glass-effect p-6 rounded-lg border border-gray-700"
              >
                <h2 className="text-xl font-bold text-white mb-6 flex items-center space-x-2">
                  <ShieldCheckIcon className="h-6 w-6 text-red-400" />
                  <span>Security Analytics</span>
                </h2>
                
                <div className="h-64 flex items-center justify-center bg-gray-800/30 rounded-lg">
                  <p className="text-gray-400">
                    🛡️ Security metrics visualization<br />
                    (Real-time threat detection data)
                  </p>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AnalyticsDashboard;