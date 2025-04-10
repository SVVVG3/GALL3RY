import React from 'react';
import { SignInButton as FarcasterSignInButton } from '@farcaster/auth-kit';
import { useAuth } from '../contexts/AuthContext';

const SignInButton = ({ onSuccess, className }) => {
  const { isAuthenticated, profile } = useAuth();

  if (isAuthenticated && profile) {
    // Don't display anything when authenticated - we have a profile link already
    return null;
  }

  return (
    <div style={{ display: 'inline-block' }} className={className || ''}>
      <FarcasterSignInButton 
        onSuccess={(res) => {
          if (onSuccess) {
            onSuccess(res);
          }
        }}
        timeoutInMs={300000} // 5 minutes
        size="medium"
      />
    </div>
  );
};

export default SignInButton; 