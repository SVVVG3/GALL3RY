import React, { useState, useEffect, Suspense, lazy } from 'react';
// Import the hook directly to avoid initialization issues
import { useAuth } from '../contexts/AuthContext';

// Dynamic imports to prevent initialization issues
const LazyFarcasterComponents = lazy(() => 
  Promise.all([
    import('@farcaster/auth-kit')
  ]).then(([authKit]) => ({
    SignInButton: authKit.SignInButton,
    useSignIn: authKit.useSignIn
  }))
);

// Check for browser environment
const isBrowser = typeof window !== 'undefined' && 
                 window.document !== undefined;

/**
 * Enhanced SignInButton Component
 * With error handling and safe localStorage access
 */
const SignInButton = ({ onSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Use our AuthContext instead of direct Farcaster auth
  const { isAuthenticated, logout } = useAuth();
  
  // Handle sign out with extra error protection
  const handleSignOut = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Check browser environment before trying to sign out
      if (!isBrowser) {
        throw new Error("Cannot sign out in non-browser environment");
      }
      
      await logout();
      
      // Call success callback if provided
      if (onSuccess && typeof onSuccess === 'function') {
        onSuccess();
      }
    } catch (error) {
      console.error('Error signing out:', error);
      setError(error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // If there's an error
  if (error) {
    return (
      <button 
        className="btn btn-error"
        onClick={() => setError(null)}
        title={error.message}
      >
        Error
      </button>
    );
  }
  
  // If loading
  if (isLoading) {
    return (
      <button 
        className="btn btn-primary"
        disabled
      >
        <span className="loading-indicator">Loading...</span>
      </button>
    );
  }
  
  // If authenticated
  if (isAuthenticated) {
    return (
      <button 
        onClick={handleSignOut}
        className="btn btn-outline"
      >
        Sign Out
      </button>
    );
  }
  
  // If not authenticated, use the fallback button that will be shown until
  // the real Farcaster auth button loads
  return (
    <Suspense fallback={<FallbackSignInButton />}>
      <FarcasterSignInButtonWrapper onSuccess={onSuccess} />
    </Suspense>
  );
};

// Wrapper for the actual Farcaster sign-in button
const FarcasterSignInButtonWrapper = ({ onSuccess }) => {
  return (
    <ErrorBoundaryWrapper>
      <LazyFarcasterComponents>
        {({ SignInButton, useSignIn }) => (
          <SignInButton onSuccess={onSuccess} />
        )}
      </LazyFarcasterComponents>
    </ErrorBoundaryWrapper>
  );
};

// Fallback button shown while the real one loads
const FallbackSignInButton = () => (
  <button className="btn btn-primary">
    Sign in
  </button>
);

// Simple error boundary for the sign-in button
class ErrorBoundaryWrapper extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Sign-in button error:", error);
  }

  render() {
    if (this.state.hasError) {
      return <FallbackSignInButton />;
    }

    return this.props.children;
  }
}

export default SignInButton; 