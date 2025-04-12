import React, { useState } from 'react';
import { SignInButton as FarcasterSignInButton, useSignIn } from '@farcaster/auth-kit';

/**
 * Simplified SignInButton Component
 * A minimal sign-in button to work with the debug version of the app
 */
const SignInButton = ({ onSuccess }) => {
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, signOut, status, isAuthenticated } = useSignIn();
  
  // Handle sign out
  const handleSignOut = async () => {
    try {
      setIsLoading(true);
      await signOut();
      
      // Call success callback if provided
      if (onSuccess && typeof onSuccess === 'function') {
        onSuccess();
      }
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
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
  
  // If not authenticated, use the Farcaster SignInButton
  return (
    <FarcasterSignInButton onSuccess={onSuccess} />
  );
};

export default SignInButton; 