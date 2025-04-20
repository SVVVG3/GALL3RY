import React from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { isMiniAppEnvironment } from '../utils/miniAppUtils';

/**
 * A button component for signing in with Farcaster using Privy.
 * 
 * This component will automatically handle the authentication flow
 * in both web and Mini App environments.
 */
const PrivyFarcasterButton = ({ 
  className = '',
  style = {},
  onLoginSuccess,
  onLoginError,
  buttonText = "Sign in with Farcaster",
  loadingText = "Signing in...",
}) => {
  const { ready, authenticated, login, user, loginWithFarcaster } = usePrivy();
  const isMiniApp = isMiniAppEnvironment();
  
  const handleSignIn = async () => {
    try {
      // In web environment, trigger Privy login
      if (!isMiniApp) {
        await login({ provider: 'farcaster' });
      }
      
      // In Mini App environment, authentication is handled automatically by PrivyFarcasterAuth
      // which should be included at the app level
      
      if (onLoginSuccess) {
        onLoginSuccess();
      }
    } catch (error) {
      console.error('Error during Farcaster login:', error);
      
      if (onLoginError) {
        onLoginError(error);
      }
    }
  };
  
  // Don't render the button if we're in a Mini App environment
  // since authentication is handled automatically
  if (isMiniApp && (authenticated || !ready)) {
    return null;
  }
  
  // If already authenticated, no need for a sign-in button
  if (authenticated && user) {
    return null;
  }
  
  const isLoading = !ready;
  
  return (
    <button
      className={`w-full py-2 px-4 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg shadow-md transition duration-200 ease-in-out ${className}`}
      style={style}
      onClick={handleSignIn}
      disabled={isLoading}
    >
      {isLoading ? loadingText : buttonText}
    </button>
  );
};

export default PrivyFarcasterButton; 