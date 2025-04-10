import React from 'react';
import { SignInButton } from '@farcaster/auth-kit';
import farcasterAuthService from '../services/farcasterAuthService';

/**
 * Farcaster Sign-In Button component
 * Renders a button that allows users to sign in with their Farcaster wallet
 */
const FarcasterSignInButton = ({ onSuccess, className, style }) => {
  const { useSignInHook } = farcasterAuthService;
  const { status } = useSignInHook();
  
  // Handle successful sign-in
  const handleSuccess = (profile) => {
    if (onSuccess && typeof onSuccess === 'function') {
      onSuccess(profile);
    }
  };
  
  return (
    <div className={className} style={style}>
      <SignInButton onSuccess={handleSuccess} />
      {status === 'loading' && <div>Loading...</div>}
      {status === 'error' && <div>Error signing in. Please try again.</div>}
    </div>
  );
};

export default FarcasterSignInButton; 