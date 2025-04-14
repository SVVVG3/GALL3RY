import React, { useState } from 'react';
import SimpleSearch from '../components/SimpleSearch';
import LazyFarcasterSearch from '../components/LazyFarcasterSearch';

/**
 * HomePage Component
 * Simple implementation that uses LazyFarcasterSearch to avoid circular dependencies
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
          // Use the LazyFarcasterSearch component which handles NFTProvider internally
          <LazyFarcasterSearch initialUsername={searchQuery} />
        )}
      </div>
    </div>
  );
};

export default HomePage; 