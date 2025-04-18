import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import FarcasterUserSearch from '../components/FarcasterUserSearch';
import '../styles/HomePage.css';
import { NFTProvider } from '../contexts/NFTContext';

/**
 * HomePage Component
 * Using the original FarcasterUserSearch component that correctly uses the Zapper API
 */
const HomePage = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  
  const handleSearch = (query) => {
    setSearchQuery(query);
    setHasSearched(true);
  };
  
  return (
    <div className="home-container home-container-compact">
      <div className="search-section">
        <h1 className="search-title">Enter a Farcaster username to explore their NFT collection</h1>
        {!hasSearched ? (
          // Simple search component with minimal dependencies
          <FarcasterUserSearch />
        ) : (
          // Use the original FarcasterUserSearch component wrapped in NFTProvider
          <NFTProvider>
            <FarcasterUserSearch initialUsername={searchQuery} />
          </NFTProvider>
        )}
      </div>
    </div>
  );
};

export default HomePage; 