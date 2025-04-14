import React, { useState, Suspense } from 'react';
import { NFTProvider } from '../contexts/NFTContext';
import SimpleSearch from '../components/SimpleSearch';
import FarcasterUserSearch from '../components/FarcasterUserSearch';

/**
 * HomePage Component with safer loading approach
 * First renders a simple search component that doesn't depend on complex contexts
 * Only renders the full FarcasterUserSearch when a search is performed
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
          // Full-featured search with NFT display, wrapped in error boundary
          <Suspense fallback={<div>Loading search results...</div>}>
            <NFTProvider>
              <FarcasterUserSearch initialUsername={searchQuery} />
            </NFTProvider>
          </Suspense>
        )}
      </div>
    </div>
  );
};

export default HomePage; 