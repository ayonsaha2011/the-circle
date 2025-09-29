import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ScaleIcon,
  ChartBarIcon,
  ClockIcon,
  UserGroupIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  PlusIcon,
  EyeIcon
} from '@heroicons/react/24/outline';

// Types
interface Proposal {
  id: string;
  title: string;
  description: string;
  proposalType: string;
  proposerId: string;
  status: 'draft' | 'active' | 'passed' | 'rejected' | 'executed';
  votingStart?: string;
  votingEnd?: string;
  minimumQuorum: number;
  approvalThreshold: number;
  proposalData: any;
  createdAt: string;
}

interface Vote {
  id: string;
  proposalId: string;
  voterId: string;
  voteChoice: 'for' | 'against' | 'abstain';
  votingPower: number;
  voteReason?: string;
  votedAt: string;
}

interface ProposalResults {
  proposalId: string;
  totalVotes: number;
  votesFor: number;
  votesAgainst: number;
  votesAbstain: number;
  totalVotingPower: number;
  approvalPercentage: number;
  quorumMet: boolean;
  passed: boolean;
}

interface GovernanceStats {
  totalProposals: number;
  activeProposals: number;
  totalVoters: number;
  totalVotingPower: number;
  passedProposals: number;
  participationRate: number;
}

const GovernanceDashboard: React.FC = () => {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [proposalResults, setProposalResults] = useState<Record<string, ProposalResults>>({});
  const [stats, setStats] = useState<GovernanceStats | null>(null);
  const [userVotes, setUserVotes] = useState<Record<string, Vote>>({});
  const [filter, setFilter] = useState<'all' | 'active' | 'draft' | 'completed'>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadGovernanceData();
  }, []);

  const loadGovernanceData = async () => {
    setIsLoading(true);
    try {
      // Mock data - in production, fetch from API
      const mockProposals: Proposal[] = [
        {
          id: '1',
          title: 'Increase Message Retention Period',
          description: 'Proposal to increase the default message retention period from 90 days to 180 days for enhanced user experience.',
          proposalType: 'parameter_change',
          proposerId: 'user-1',
          status: 'active',
          votingStart: new Date(Date.now() - 86400000).toISOString(),
          votingEnd: new Date(Date.now() + 86400000 * 6).toISOString(),
          minimumQuorum: 100,
          approvalThreshold: 0.6,
          proposalData: { parameter: 'message_retention_days', oldValue: 90, newValue: 180 },
          createdAt: new Date(Date.now() - 86400000).toISOString(),
        },
        {
          id: '2',
          title: 'Treasury Allocation for Security Audit',
          description: 'Allocate $50,000 from the treasury for a comprehensive third-party security audit of the platform.',
          proposalType: 'treasury_spend',
          proposerId: 'user-2',
          status: 'active',
          votingStart: new Date(Date.now() - 172800000).toISOString(),
          votingEnd: new Date(Date.now() + 86400000 * 5).toISOString(),
          minimumQuorum: 150,
          approvalThreshold: 0.7,
          proposalData: { amount: 50000, purpose: 'security_audit', recipient: 'CyberSec Solutions Inc.' },
          createdAt: new Date(Date.now() - 172800000).toISOString(),
        },
        {
          id: '3',
          title: 'Enable Advanced Encryption Features',
          description: 'Activate quantum-resistant encryption protocols for all new conversations.',
          proposalType: 'feature_request',
          proposerId: 'user-3',
          status: 'passed',
          votingStart: new Date(Date.now() - 864000000).toISOString(),
          votingEnd: new Date(Date.now() - 432000000).toISOString(),
          minimumQuorum: 120,
          approvalThreshold: 0.5,
          proposalData: { feature: 'quantum_encryption', rollout: 'gradual' },
          createdAt: new Date(Date.now() - 864000000).toISOString(),
        },
      ];

      const mockResults: Record<string, ProposalResults> = {
        '1': {
          proposalId: '1',
          totalVotes: 87,
          votesFor: 1250,
          votesAgainst: 340,
          votesAbstain: 110,
          totalVotingPower: 1700,
          approvalPercentage: 78.6,
          quorumMet: false,
          passed: false,
        },
        '2': {
          proposalId: '2',
          totalVotes: 156,
          votesFor: 1850,
          votesAgainst: 520,
          votesAbstain: 230,
          totalVotingPower: 2600,
          approvalPercentage: 78.1,
          quorumMet: true,
          passed: true,
        },
        '3': {
          proposalId: '3',
          totalVotes: 203,
          votesFor: 2100,
          votesAgainst: 450,
          votesAbstain: 150,
          totalVotingPower: 2700,
          approvalPercentage: 82.4,
          quorumMet: true,
          passed: true,
        },
      };

      const mockStats: GovernanceStats = {
        totalProposals: 12,
        activeProposals: 2,
        totalVoters: 1247,
        totalVotingPower: 15420,
        passedProposals: 8,
        participationRate: 67.3,
      };

      setProposals(mockProposals);
      setProposalResults(mockResults);
      setStats(mockStats);
    } catch (error) {
      console.error('Failed to load governance data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: Proposal['status']) => {
    switch (status) {
      case 'draft': return 'text-gray-400 bg-gray-900/20';
      case 'active': return 'text-blue-400 bg-blue-900/20';
      case 'passed': return 'text-green-400 bg-green-900/20';
      case 'rejected': return 'text-red-400 bg-red-900/20';
      case 'executed': return 'text-purple-400 bg-purple-900/20';
      default: return 'text-gray-400 bg-gray-900/20';
    }
  };

  const getStatusIcon = (status: Proposal['status']) => {
    switch (status) {
      case 'active': return ClockIcon;
      case 'passed': return CheckCircleIcon;
      case 'rejected': return XCircleIcon;
      case 'executed': return CheckCircleIcon;
      default: return ClockIcon;
    }
  };

  const getProposalTypeColor = (type: string) => {
    switch (type) {
      case 'parameter_change': return 'text-blue-400 bg-blue-900/20';
      case 'treasury_spend': return 'text-yellow-400 bg-yellow-900/20';
      case 'feature_request': return 'text-purple-400 bg-purple-900/20';
      case 'emergency': return 'text-red-400 bg-red-900/20';
      default: return 'text-gray-400 bg-gray-900/20';
    }
  };

  const filteredProposals = proposals.filter(proposal => {
    switch (filter) {
      case 'active': return proposal.status === 'active';
      case 'draft': return proposal.status === 'draft';
      case 'completed': return ['passed', 'rejected', 'executed'].includes(proposal.status);
      default: return true;
    }
  });

  const formatTimeRemaining = (endTime: string) => {
    const end = new Date(endTime);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    
    if (diff <= 0) return 'Voting ended';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h remaining`;
    return `${hours}h remaining`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-circle-dark via-gray-900 to-black">
      {/* Header */}
      <div className="glass-effect border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gradient flex items-center space-x-3">
                <ScaleIcon className="h-8 w-8 text-circle-blue" />
                <span>Governance Dashboard</span>
              </h1>
              <p className="text-gray-400 mt-1">Decentralized decision making for The Circle</p>
            </div>
            
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary px-6 py-3 flex items-center space-x-2"
            >
              <PlusIcon className="h-5 w-5" />
              <span>Create Proposal</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-circle-blue"></div>
          </div>
        ) : (
          <>
            {/* Statistics Grid */}
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-effect p-6 rounded-lg border border-gray-700"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm">Total Proposals</p>
                      <p className="text-2xl font-bold text-white">{stats.totalProposals}</p>
                    </div>
                    <ChartBarIcon className="h-8 w-8 text-circle-blue" />
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="glass-effect p-6 rounded-lg border border-gray-700"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm">Active Proposals</p>
                      <p className="text-2xl font-bold text-white">{stats.activeProposals}</p>
                    </div>
                    <ClockIcon className="h-8 w-8 text-yellow-400" />
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="glass-effect p-6 rounded-lg border border-gray-700"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm">Total Voters</p>
                      <p className="text-2xl font-bold text-white">{stats.totalVoters.toLocaleString()}</p>
                    </div>
                    <UserGroupIcon className="h-8 w-8 text-green-400" />
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="glass-effect p-6 rounded-lg border border-gray-700"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm">Participation Rate</p>
                      <p className="text-2xl font-bold text-white">{stats.participationRate}%</p>
                    </div>
                    <ArrowUpIcon className="h-8 w-8 text-circle-purple" />
                  </div>
                </motion.div>
              </div>
            )}

            {/* Filter Tabs */}
            <div className="flex space-x-1 mb-6 bg-gray-800/50 p-1 rounded-lg w-fit">
              {[
                { key: 'all', label: 'All Proposals' },
                { key: 'active', label: 'Active' },
                { key: 'draft', label: 'Draft' },
                { key: 'completed', label: 'Completed' },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key as any)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    filter === tab.key
                      ? 'bg-circle-blue text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Proposals List */}
            <div className="space-y-4">
              <AnimatePresence>
                {filteredProposals.map((proposal, index) => {
                  const StatusIcon = getStatusIcon(proposal.status);
                  const results = proposalResults[proposal.id];
                  
                  return (
                    <motion.div
                      key={proposal.id}
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ delay: index * 0.1 }}
                      className="glass-effect p-6 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors cursor-pointer"
                      onClick={() => setSelectedProposal(proposal)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="text-lg font-semibold text-white">{proposal.title}</h3>
                            
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(proposal.status)}`}>
                              <StatusIcon className="h-3 w-3 inline mr-1" />
                              {proposal.status}
                            </span>
                            
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getProposalTypeColor(proposal.proposalType)}`}>
                              {proposal.proposalType.replace('_', ' ')}
                            </span>
                          </div>
                          
                          <p className="text-gray-400 mb-4 line-clamp-2">{proposal.description}</p>
                          
                          {/* Voting Progress */}
                          {results && (
                            <div className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-400">
                                  {results.totalVotes} votes • {results.approvalPercentage.toFixed(1)}% approval
                                </span>
                                {proposal.votingEnd && proposal.status === 'active' && (
                                  <span className="text-yellow-400">
                                    {formatTimeRemaining(proposal.votingEnd)}
                                  </span>
                                )}
                              </div>
                              
                              <div className="w-full bg-gray-700 rounded-full h-2">
                                <div className="flex h-2 rounded-full overflow-hidden">
                                  <div 
                                    className="bg-green-500" 
                                    style={{ width: `${(results.votesFor / results.totalVotingPower) * 100}%` }}
                                  />
                                  <div 
                                    className="bg-red-500" 
                                    style={{ width: `${(results.votesAgainst / results.totalVotingPower) * 100}%` }}
                                  />
                                  <div 
                                    className="bg-gray-500" 
                                    style={{ width: `${(results.votesAbstain / results.totalVotingPower) * 100}%` }}
                                  />
                                </div>
                              </div>
                              
                              <div className="flex justify-between text-xs text-gray-500">
                                <span>For: {results.votesFor}</span>
                                <span>Against: {results.votesAgainst}</span>
                                <span>Abstain: {results.votesAbstain}</span>
                              </div>
                              
                              {!results.quorumMet && proposal.status === 'active' && (
                                <div className="flex items-center space-x-2 text-yellow-400 text-sm">
                                  <ExclamationTriangleIcon className="h-4 w-4" />
                                  <span>Quorum not yet met ({results.totalVotes}/{proposal.minimumQuorum})</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        
                        <button className="text-circle-blue hover:text-circle-blue/80 transition-colors">
                          <EyeIcon className="h-5 w-5" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {filteredProposals.length === 0 && (
              <div className="text-center py-12">
                <ScaleIcon className="h-12 w-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No proposals found for the selected filter</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Proposal Detail Modal */}
      <AnimatePresence>
        {selectedProposal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
            onClick={() => setSelectedProposal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="glass-effect max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded-lg border border-gray-700 p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">{selectedProposal.title}</h2>
                  <div className="flex items-center space-x-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedProposal.status)}`}>
                      {selectedProposal.status}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getProposalTypeColor(selectedProposal.proposalType)}`}>
                      {selectedProposal.proposalType.replace('_', ' ')}
                    </span>
                  </div>
                </div>
                
                <button
                  onClick={() => setSelectedProposal(null)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <XCircleIcon className="h-6 w-6" />
                </button>
              </div>

              <div className="prose prose-invert max-w-none mb-6">
                <p className="text-gray-300 text-lg leading-relaxed">{selectedProposal.description}</p>
              </div>

              {/* Proposal Data */}
              <div className="bg-gray-900/50 rounded-lg p-4 mb-6">
                <h3 className="text-lg font-semibold text-white mb-3">Proposal Details</h3>
                <pre className="text-sm text-gray-300 overflow-x-auto">
                  {JSON.stringify(selectedProposal.proposalData, null, 2)}
                </pre>
              </div>

              {/* Voting Interface */}
              {selectedProposal.status === 'active' && (
                <div className="border-t border-gray-700 pt-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Cast Your Vote</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <button className="btn-primary bg-green-600 hover:bg-green-700 py-3">
                      Vote For
                    </button>
                    <button className="btn-primary bg-red-600 hover:bg-red-700 py-3">
                      Vote Against
                    </button>
                    <button className="btn-secondary py-3">
                      Abstain
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GovernanceDashboard;