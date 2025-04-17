import React, { useState, useEffect, Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { NFTProvider } from '../contexts/NFTContext';

// Dynamically import the FarcasterUserSearch component to avoid circular dependencies
const DynamicFarcasterUserSearch = React.lazy(() => import('./FarcasterUserSearch'));

/**
 * Error fallback component
 */
const ErrorFallback = ({ error, resetErrorBoundary }) => {
  // Only log the error in development mode to avoid console spam
  if (process.env.NODE_ENV === 'development') {
    console.error("Error in FarcasterSearch:", error);
  }
  
  return (
    <div className="error-container">
      <h3>Error Loading Farcaster Data</h3>
      <p>Minified React error #301; visit <a href="https://reactjs.org/docs/error-decoder.html?invariant=301" target="_blank" rel="noopener noreferrer">https://reactjs.org/docs/error-decoder.html?invariant=301</a> for the full message or use the non-minified dev environment for full errors and additional helpful warnings.</p>
      <button 
        onClick={resetErrorBoundary} 
        className="retry-button"
      >
        Try Again
      </button>
    </div>
  );
};

/**
 * Loading component to show while the FarcasterUserSearch is loading
 */
const SearchLoader = () => (
  <div className="search-loading">
    <div className="loading-spinner"></div>
    <p>Loading Farcaster search component...</p>
  </div>
);

/**
 * Wrapper component that loads FarcasterUserSearch with proper context
 * This creates separation to avoid circular dependencies during initialization
 */
const LazyFarcasterSearch = ({ initialUsername }) => {
  // Fixed: We don't need this state here - it's causing issues
  // const [error, setError] = useState(null);
  
  // Fixed: Instead of useEffect with initialUsername dependency that calls setError,
  // we'll handle the error reset directly in the ErrorBoundary's onReset prop
  
  return (
    <ErrorBoundary 
      FallbackComponent={ErrorFallback}
      onReset={() => {
        // This function is called when the "Try Again" button is clicked
        // No need to update any local state
        console.log("Resetting Farcaster Search");
      }}
    >
      <NFTProvider>
        <Suspense fallback={<SearchLoader />}>
          <DynamicFarcasterUserSearch initialUsername={initialUsername} />
        </Suspense>
      </NFTProvider>
    </ErrorBoundary>
  );
};

export default LazyFarcasterSearch; 