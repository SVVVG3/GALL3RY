import React, { useState, Suspense } from 'react';
import SimpleSearch from '../components/SimpleSearch';

// No static imports of components that use NFT context
// Everything is dynamically loaded

/**
 * HomePage Component with error-resistant loading approach
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
          // Fully dynamic import to avoid any potential circular dependencies or initialization issues
          <Suspense fallback={
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Loading search results...</p>
            </div>
          }>
            <DynamicFarcasterSearch initialUsername={searchQuery} />
          </Suspense>
        )}
      </div>
    </div>
  );
};

// Define the dynamic component outside the main component
// This ensures it's only imported when actually rendered
const DynamicFarcasterSearch = React.lazy(() => {
  // Add a small delay to ensure any initialization is complete
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(import('../components/LazyFarcasterSearch'));
    }, 100);
  });
});

export default HomePage; 