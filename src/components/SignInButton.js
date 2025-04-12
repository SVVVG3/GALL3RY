import React, { useState, useEffect } from 'react';
import { SignInButton as FarcasterSignInButton, useSignIn } from '@farcaster/auth-kit';

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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { signIn, signOut, status } = useSignIn();
  
  // Safely check authentication status
  useEffect(() => {
    try {
      if (status === 'authenticated') {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.error("Error checking auth status:", err);
      setError(err);
    }
  }, [status]);
  
  // Handle sign out with extra error protection
  const handleSignOut = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Check browser environment before trying to sign out
      if (!isBrowser) {
        throw new Error("Cannot sign out in non-browser environment");
      }
      
      await signOut();
      setIsAuthenticated(false);
      
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
  if (isLoading || status === 'loading') {
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
  
  // If not authenticated, wrap the Farcaster SignInButton in error boundary
  return (
    <ErrorBoundaryWrapper>
      <FarcasterSignInButton onSuccess={onSuccess} />
    </ErrorBoundaryWrapper>
  );
};

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
      return (
        <button className="btn btn-primary">
          Sign in
        </button>
      );
    }

    return this.props.children;
  }
}

export default SignInButton; 