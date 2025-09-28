import React from 'react';
import { motion } from 'framer-motion';
import { CheckIcon } from '@heroicons/react/24/outline';

const MEMBERSHIP_TIERS = [
  {
    id: 'basic',
    name: 'Basic',
    price: 'Free',
    description: 'Perfect for personal use',
    features: [
      'Basic messaging',
      '5MB file uploads',
      '1GB storage',
      '5 conversations',
      'Basic encryption'
    ],
    buttonText: 'Get Started',
    highlighted: false
  },
  {
    id: 'standard',
    name: 'Standard',
    price: '$9.99',
    period: '/month',
    description: 'Ideal for professionals',
    features: [
      'All Basic features',
      'File sharing & vaults',
      'Video calls (1-to-1)',
      'Destruction protocols',
      '50MB files, 10GB storage',
      'Priority support'
    ],
    buttonText: 'Choose Standard',
    highlighted: true
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '$19.99',
    period: '/month',
    description: 'Maximum security features',
    features: [
      'All Standard features',
      'Biometric authentication',
      'Group video calls',
      '200MB files, 50GB storage',
      'Advanced destruction protocols',
      'Forensic resistance',
      'Custom security policies'
    ],
    buttonText: 'Go Premium',
    highlighted: false
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 'Custom',
    description: 'For organizations',
    features: [
      'All Premium features',
      'Unlimited storage',
      'Admin controls',
      'SSO integration',
      'Compliance reports',
      'Dedicated support',
      'Custom deployment'
    ],
    buttonText: 'Contact Sales',
    highlighted: false
  }
];

const Pricing: React.FC = () => {
  return (
    <section className="py-20 px-4 bg-gradient-to-b from-black to-circle-dark">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-gradient mb-6">
            Choose Your Level of Protection
          </h2>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            From personal privacy to enterprise security, find the perfect tier for your needs.
          </p>
        </motion.div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {MEMBERSHIP_TIERS.map((tier, index) => (
            <motion.div
              key={tier.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: index * 0.1 }}
              viewport={{ once: true }}
              className={`relative rounded-2xl p-8 transition-all duration-300 hover:scale-105 ${
                tier.highlighted
                  ? 'bg-gradient-to-b from-circle-blue/20 to-circle-purple/20 border-2 border-circle-blue shadow-2xl shadow-circle-blue/20'
                  : 'glass-effect hover:bg-white/10'
              }`}
            >
              {tier.highlighted && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-circle-blue to-circle-purple text-white px-4 py-2 rounded-full text-sm font-semibold">
                  Most Popular
                </div>
              )}
              
              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-white mb-2">{tier.name}</h3>
                <p className="text-gray-400 mb-4">{tier.description}</p>
                <div className="mb-4">
                  <span className="text-4xl font-bold text-white">{tier.price}</span>
                  {tier.period && <span className="text-gray-400">{tier.period}</span>}
                </div>
              </div>
              
              <ul className="space-y-4 mb-8">
                {tier.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start">
                    <CheckIcon className="h-5 w-5 text-circle-green mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-300">{feature}</span>
                  </li>
                ))}
              </ul>
              
              <a
                href={`/register?tier=${tier.id}`}
                className={`block w-full text-center py-3 px-6 rounded-lg font-semibold transition-all duration-200 ${
                  tier.highlighted
                    ? 'bg-gradient-to-r from-circle-blue to-circle-purple text-white hover:shadow-lg'
                    : 'border-2 border-circle-blue text-circle-blue hover:bg-circle-blue hover:text-white'
                }`}
              >
                {tier.buttonText}
              </a>
            </motion.div>
          ))}
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          viewport={{ once: true }}
          className="text-center mt-16"
        >
          <p className="text-gray-400 mb-4">
            All plans include 30-day money-back guarantee
          </p>
          <div className="flex justify-center items-center space-x-8 text-sm text-gray-500">
            <span>• 256-bit AES Encryption</span>
            <span>• Zero-knowledge Architecture</span>
            <span>• 24/7 Security Monitoring</span>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Pricing;