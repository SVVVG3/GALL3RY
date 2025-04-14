import React from 'react';
import { NFTProvider } from '../contexts/NFTContext';
import FarcasterUserSearch from '../components/FarcasterUserSearch';

/**
 * HomePage Component
 * The main landing page of the application that displays the Farcaster user search
 */
const HomePage = () => {
  return (
    <div className="home-container">
      <div className="content-wrapper">
        <h2>Search Farcaster users to explore their NFT collections</h2>
        <NFTProvider>
          <FarcasterUserSearch />
        </NFTProvider>
      </div>
    </div>
  );
};

export default HomePage; 