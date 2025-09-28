import React from 'react';
import Hero from '../components/landing/Hero';
import Pricing from '../components/landing/Pricing';

const Landing: React.FC = () => {
  return (
    <div className="min-h-screen">
      <Hero />
      <Pricing />
    </div>
  );
};

export default Landing;