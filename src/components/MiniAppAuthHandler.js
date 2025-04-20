import React, { useEffect, useState } from 'react';
import { sdk } from '@farcaster/frame-sdk';
import { handleMiniAppAuthentication } from '../utils/miniAppUtils';
import { useAuth } from '../contexts/AuthContext';

/**
 * Component that handles automatic authentication in Mini App environments.
 * This component doesn't render anything visible but manages the authentication flow.
 */
const MiniAppAuthHandler = () => {
  const { isAuthenticated } = useAuth();
  const [hasAttemptedAuth, setHasAttemptedAuth] = useState(false);

  // Attempt to authenticate on mount
  useEffect(() => {
    const attemptAuth = async () => {
      if (!isAuthenticated && !hasAttemptedAuth) {
        console.log('MiniAppAuthHandler: Attempting automatic authentication');
        try {
          // Check if SDK is available
          if (!sdk) {
            console.log('MiniAppAuthHandler: SDK not available');
            return;
          }

          // Generate a nonce for authentication
          const generateNonce = () => {
            return Math.random().toString(36).substring(2, 15) + 
                   Math.random().toString(36).substring(2, 15);
          };

          const nonce = generateNonce();
          console.log('MiniAppAuthHandler: Generated nonce for auth');

          // Try to get user info from SDK context first
          let userInfo = null;
          
          try {
            if (typeof sdk.getContext === 'function') {
              const context = await sdk.getContext();
              console.log('MiniAppAuthHandler: Context retrieved:', context ? 'yes' : 'no');
              
              if (context && context.user && context.user.fid) {
                // Ensure we're using primitive values only
                userInfo = {
                  fid: typeof context.user.fid === 'function' ? null : Number(context.user.fid || 0),
                  username: typeof context.user.username === 'function' ? null : String(context.user.username || ''),
                  displayName: typeof context.user.displayName === 'function' ? null : 
                              String(context.user.displayName || context.user.username || ''),
                  pfp: typeof context.user.pfpUrl === 'function' ? null : 
                       String(context.user.pfpUrl || '')
                };
                
                console.log('MiniAppAuthHandler: Found user in context:', {
                  fid: userInfo.fid,
                  username: userInfo.username || 'unknown'
                });
              }
            }
          } catch (contextError) {
            console.error('MiniAppAuthHandler: Error getting context:', contextError);
          }

          // If no user info from context, try sign in
          if (!userInfo && sdk.actions && typeof sdk.actions.signIn === 'function') {
            console.log('MiniAppAuthHandler: No user in context, attempting signIn');
            try {
              const result = await sdk.actions.signIn({ nonce });
              console.log('MiniAppAuthHandler: Sign-in result:', result ? 'received' : 'null');
              
              if (result && result.message) {
                // Use the general handler to process the result
                await handleMiniAppAuthentication();
              }
            } catch (signInError) {
              console.error('MiniAppAuthHandler: Sign-in error:', signInError);
            }
          } else if (userInfo) {
            // We have user info from context, store it
            try {
              localStorage.setItem('farcaster_user', JSON.stringify(userInfo));
              localStorage.setItem('miniAppUserInfo', JSON.stringify(userInfo));
              
              // Dispatch event for other components to react
              const authEvent = new CustomEvent('miniAppAuthenticated', { 
                detail: {
                  fid: userInfo.fid,
                  username: userInfo.username,
                  displayName: userInfo.displayName,
                  pfp: userInfo.pfp
                }
              });
              window.dispatchEvent(authEvent);
              
              console.log('MiniAppAuthHandler: Successfully stored user data and dispatched event');
            } catch (storageError) {
              console.error('MiniAppAuthHandler: Error storing user data:', storageError);
            }
          }
        } catch (error) {
          console.error('MiniAppAuthHandler: Authentication error:', error);
        } finally {
          setHasAttemptedAuth(true);
        }
      }
    };

    attemptAuth();
  }, [isAuthenticated, hasAttemptedAuth]);

  // This component doesn't render anything
  return null;
};

export default MiniAppAuthHandler; 