import React, { useState, useEffect } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { NFTProvider } from '../contexts/NFTContext';
import FarcasterUserSearch from './FarcasterUserSearch';

/**
 * Error fallback component
 */
const ErrorFallback = ({ error, resetErrorBoundary }) => {
  console.error("Error in FarcasterSearch:", error);
  
  return (
    <div className="error-container">
      <h3>Error Loading Farcaster Data</h3>
      <p>{error?.message || 'An unexpected error occurred'}</p>
      <div className="error-details">
        <pre>{error?.stack?.slice(0, 200) || 'No stack trace available'}</pre>
      </div>
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
 * Wrapper component that loads FarcasterUserSearch with proper context
 * This creates separation to avoid circular dependencies during initialization
 */
const LazyFarcasterSearch = ({ initialUsername }) => {
  const [error, setError] = useState(null);
  
  // Reset error state when username changes
  useEffect(() => {
    setError(null);
  }, [initialUsername]);
  
  return (
    <ErrorBoundary 
      FallbackComponent={ErrorFallback}
      onReset={() => setError(null)}
    >
      <NFTProvider>
        <FarcasterUserSearch initialUsername={initialUsername} />
      </NFTProvider>
    </ErrorBoundary>
  );
};

export default LazyFarcasterSearch; 