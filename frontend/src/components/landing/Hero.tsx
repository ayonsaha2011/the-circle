import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheckIcon, LockClosedIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

const Hero: React.FC = () => {
  return (
    <section className="min-h-screen flex items-center justify-center bg-gradient-to-br from-circle-dark via-gray-900 to-black relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-circle-blue/10 rounded-full blur-3xl animate-pulse-slow"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-circle-purple/10 rounded-full blur-3xl animate-pulse-slow delay-1000"></div>
      </div>
      
      <div className="max-w-6xl mx-auto px-4 text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-8"
        >
          <h1 className="text-6xl md:text-8xl font-bold mb-6 text-gradient leading-tight">
            The Circle
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-300 mb-8 max-w-4xl mx-auto leading-relaxed">
            Secure communication with advanced containment protocols. 
            <br />
            <span className="text-circle-blue font-semibold">Your privacy, protected by design.</span>
          </p>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12"
        >
          <div className="glass-effect p-6 rounded-xl">
            <ShieldCheckIcon className="h-12 w-12 text-circle-blue mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Military-Grade Security</h3>
            <p className="text-gray-400">End-to-end encryption with auto-destruction protocols</p>
          </div>
          
          <div className="glass-effect p-6 rounded-xl">
            <LockClosedIcon className="h-12 w-12 text-circle-green mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Zero Trust Architecture</h3>
            <p className="text-gray-400">Every communication verified and protected</p>
          </div>
          
          <div className="glass-effect p-6 rounded-xl">
            <EyeSlashIcon className="h-12 w-12 text-circle-purple mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Forensic Resistance</h3>
            <p className="text-gray-400">No traces left behind after destruction</p>
          </div>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="space-y-4 md:space-y-0 md:space-x-4 md:flex md:justify-center"
        >
          <a 
            href="/register" 
            className="btn-primary inline-block px-8 py-4 text-lg font-semibold transform hover:scale-105 transition-all duration-200"
          >
            Join The Circle
          </a>
          <a 
            href="/login" 
            className="btn-secondary inline-block px-8 py-4 text-lg font-semibold"
          >
            Access Portal
          </a>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-16 text-sm text-gray-500"
        >
          <p>Trusted by security professionals worldwide</p>
          <div className="flex justify-center items-center space-x-8 mt-4 opacity-50">
            <div className="w-16 h-8 bg-gray-600 rounded"></div>
            <div className="w-16 h-8 bg-gray-600 rounded"></div>
            <div className="w-16 h-8 bg-gray-600 rounded"></div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;