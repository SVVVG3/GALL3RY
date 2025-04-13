import React, { useState, useEffect, Suspense } from 'react';
// Import the hook directly to avoid initialization issues
import { useAuth } from '../contexts/AuthContext';

// We won't dynamically import the Farcaster components to avoid initialization issues
import { SignInButton as FarcasterSignInButton } from '@farcaster/auth-kit';

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
  
  // If not authenticated, use the Farcaster auth button directly
  return (
    <ErrorBoundaryWrapper>
      <FarcasterSignInButton onSuccess={onSuccess} />
    </ErrorBoundaryWrapper>
  );
};

// Fallback button shown when the real one fails
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