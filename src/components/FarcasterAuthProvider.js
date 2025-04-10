import React from 'react';
import { AuthKitProvider } from '@farcaster/auth-kit';
import '@farcaster/auth-kit/styles.css';
import farcasterAuthService from '../services/farcasterAuthService';

/**
 * Farcaster AuthKit provider component
 * Wraps the application with the Farcaster AuthKit provider
 */
const FarcasterAuthProvider = ({ children }) => {
  const config = farcasterAuthService.getConfig();
  
  return (
    <AuthKitProvider config={config}>
      {children}
    </AuthKitProvider>
  );
};

export default FarcasterAuthProvider; 