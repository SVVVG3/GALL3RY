import React, { useEffect } from 'react';
import frameSdk from "@farcaster/frame-sdk";
import { usePrivy } from "@privy-io/react-auth";
import { useLoginToFrame } from "@privy-io/react-auth/farcaster";

// Debug mode for logging
const DEBUG_MODE = true;

const log = (message, data) => {
  if (DEBUG_MODE) {
    console.log(`[PRIVY AUTH] ${message}`, data || '');
  }
};

/**
 * Component that automatically handles Farcaster authentication in a Mini App environment
 * using Privy's authentication system
 */
const PrivyFarcasterAuth = ({ onLoginSuccess, onLoginError }) => {
  const { ready, authenticated, login, user } = usePrivy();
  const { initLoginToFrame, loginToFrame } = useLoginToFrame();

  // Automatically handle login for Mini App environment
  useEffect(() => {
    if (ready && !authenticated) {
      log('Privy ready and user not authenticated - initiating Mini App login');
      
      const handleLogin = async () => {
        try {
          log('Initializing login to frame');
          // Initialize a new login attempt to get a nonce for the Farcaster wallet to sign
          const { nonce } = await initLoginToFrame();
          log('Generated nonce for authentication:', nonce);
          
          // Request a signature from Warpcast
          log('Requesting signature from Warpcast');
          const result = await frameSdk.actions.signIn({ nonce });
          log('Received signature from Warpcast');
          
          // Send the received signature from Warpcast to Privy for authentication
          log('Sending signature to Privy for authentication');
          await loginToFrame({
            message: result.message,
            signature: result.signature,
          });
          
          log('Successfully authenticated with Privy');
          if (onLoginSuccess) {
            onLoginSuccess();
          }
        } catch (error) {
          log('Error during authentication:', error);
          if (onLoginError) {
            onLoginError(error);
          }
        }
      };
      
      handleLogin();
    } else if (ready && authenticated && user) {
      log('User already authenticated', { fid: user.farcaster?.fid, username: user.farcaster?.username });
      
      if (onLoginSuccess) {
        onLoginSuccess();
      }
      
      // Try to dismiss splash screen if in Mini App environment
      if (frameSdk && frameSdk.actions && typeof frameSdk.actions.ready === 'function') {
        log('Dismissing splash screen');
        frameSdk.actions.ready().catch(err => {
          console.error('Error dismissing splash screen:', err);
        });
      }
    }
  }, [ready, authenticated, user, initLoginToFrame, loginToFrame, onLoginSuccess, onLoginError]);

  // This component doesn't render anything visible
  return null;
};

export default PrivyFarcasterAuth; 