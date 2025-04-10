import React from 'react';
import { useAuth } from '../contexts/AuthContext';

/**
 * SignInButton Component
 * Provides a button to sign in/out with Farcaster
 */
const SignInButton = ({ onSuccess }) => {
  const { isAuthenticated, signIn, signOut, loading } = useAuth();
  
  const handleSignIn = async () => {
    try {
      await signIn();
      if (onSuccess && typeof onSuccess === 'function') {
        onSuccess();
      }
    } catch (error) {
      console.error('Error signing in with Farcaster:', error);
    }
  };
  
  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };
  
  if (loading) {
    return (
      <button 
        className="px-4 py-2 bg-purple-500 text-white rounded-lg opacity-75 cursor-not-allowed" 
        disabled
      >
        <span className="flex items-center">
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Loading...
        </span>
      </button>
    );
  }
  
  if (isAuthenticated) {
    return (
      <button 
        onClick={handleSignOut}
        className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
      >
        Sign Out
      </button>
    );
  }
  
  return (
    <button 
      onClick={handleSignIn}
      className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
    >
      Sign In with Farcaster
    </button>
  );
};

export default SignInButton; 