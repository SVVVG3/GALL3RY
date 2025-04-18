import React from 'react';
import FarcasterUserSearch from '../components/FarcasterUserSearch';
import '../styles/HomePage.css';
import { NFTProvider } from '../contexts/NFTContext';

/**
 * Simple HomePage Component with minimal dependencies
 */
const HomePage = () => {
  return (
    <div className="home-container home-container-compact">
      <div className="search-section">
        <NFTProvider>
          <FarcasterUserSearch />
        </NFTProvider>
      </div>
    </div>
  );
};

export default HomePage; 