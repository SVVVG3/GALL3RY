import React, { useState } from 'react';
import SimpleSearch from '../components/SimpleSearch';
import FarcasterUserSearch from '../components/FarcasterUserSearch';
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
    <div className="home-container">
      <div className="content-wrapper">
        {!hasSearched ? (
          // Simple search component with minimal dependencies
          <SimpleSearch onSearch={handleSearch} />
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