import React from 'react';

/**
 * About page component with information about the app
 */
const AboutPage = () => {
  return (
    <div className="about-page">
      <h1>About GALL3RY</h1>
      <p>A decentralized NFT collection manager for Farcaster users.</p>
      
      <div className="about-content">
        <h2>Our Mission</h2>
        <p>
          GALL3RY helps Farcaster users showcase and manage their NFT collections
          in both web and Mini App environments.
        </p>
        
        <h2>Features</h2>
        <ul>
          <li>Seamless Farcaster authentication with Privy</li>
          <li>Browse your NFT collection</li>
          <li>Discover other users' collections</li>
          <li>Share your NFTs on Farcaster</li>
        </ul>
      </div>
    </div>
  );
};

export default AboutPage; 