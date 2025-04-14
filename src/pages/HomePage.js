import React, { useState } from 'react';
import SimpleSearch from '../components/SimpleSearch';
import { NFTProvider } from '../contexts/NFTContext';
import FarcasterUserSearch from '../components/FarcasterUserSearch';

/**
 * HomePage Component
 * Simple implementation that only renders NFTProvider when needed
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
          // Only wrap with NFTProvider after search to avoid initialization issues
          <NFTProvider>
            <FarcasterUserSearch initialUsername={searchQuery} />
          </NFTProvider>
        )}
      </div>
    </div>
  );
};

export default HomePage; 