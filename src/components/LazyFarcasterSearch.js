import React, { useState, useEffect, Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';

// Import the simple version instead
const SimpleFarcasterSearch = React.lazy(() => import('./SimpleFarcasterSearch'));

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
 * Wrapper component that loads SimpleFarcasterSearch with proper error boundaries
 */
const LazyFarcasterSearch = ({ initialUsername }) => {
  return (
    <ErrorBoundary 
      FallbackComponent={ErrorFallback}
      onReset={() => {
        console.log("Resetting Farcaster Search");
      }}
    >
      <Suspense fallback={<SearchLoader />}>
        <SimpleFarcasterSearch initialUsername={initialUsername} />
      </Suspense>
    </ErrorBoundary>
  );
};

export default LazyFarcasterSearch; 