import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { SignInButton as FarcasterSignInButton, useSignIn } from '@farcaster/auth-kit';

/**
 * SignInButton Component
 * Provides a button to sign in/out with Farcaster directly in the header
 */
const SignInButton = ({ onSuccess }) => {
  const { isAuthenticated, logout } = useAuth();
  const { signIn, signOut, status } = useSignIn();
  
  // Handle sign out
  const handleSignOut = async () => {
    try {
      await signOut();
      logout(); // Call our local logout for compatibility
      
      // Call success callback if provided
      if (onSuccess && typeof onSuccess === 'function') {
        onSuccess();
      }
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };
  
  // If loading
  if (status === 'loading') {
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