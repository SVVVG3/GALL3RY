import React, { useState, lazy, Suspense } from 'react';
import SimpleSearch from '../components/SimpleSearch';

// Lazy load the components that depend on contexts to avoid circular dependencies
const FarcasterSearchWithContext = lazy(() => 
  import('../components/LazyFarcasterSearch')
);

/**
 * HomePage Component with safer loading approach
 * First renders a simple search component that doesn't depend on complex contexts
 * Only loads context and search component when a search is performed
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
          // Lazy-load the full search component with context to avoid circular dependencies
          <Suspense fallback={
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Loading search results...</p>
            </div>
          }>
            <FarcasterSearchWithContext initialUsername={searchQuery} />
          </Suspense>
        )}
      </div>
    </div>
  );
};

export default HomePage; 