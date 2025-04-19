import React, { useEffect, useState } from 'react';
import { sdk } from '@farcaster/frame-sdk';
import { useAuth } from '../contexts/AuthContext';
import { isMiniAppEnvironment } from '../utils/miniAppUtils';

// Generate a secure nonce for authentication
const generateNonce = () => {
  const array = new Uint8Array(16);
  window.crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
};

/**
 * MiniAppAuthHandler - Handles silent authentication in Mini App environment
 * 
 * This component automatically signs in the user when in a Mini App environment
 * where the user is already authenticated in their Farcaster client (like Warpcast)
 */
const MiniAppAuthHandler = () => {
  const { login, isAuthenticated, setAuthenticating } = useAuth();
  const [authAttempted, setAuthAttempted] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  
  useEffect(() => {
    const attemptAuth = async () => {
      // Don't try to authenticate if we've already attempted or are already authenticated
      if (authAttempted || isAuthenticated || isAuthenticating) {
        return;
      }
      
      // Check if we're in a Mini App environment
      const isMiniApp = isMiniAppEnvironment();
      console.log('MiniAppAuthHandler: Environment check:', { isMiniApp, isAuthenticated });
      
      if (!isMiniApp) {
        console.log('MiniAppAuthHandler: Not in Mini App environment, skipping auto-auth');
        setAuthAttempted(true);
        return;
      }
      
      try {
        setIsAuthenticating(true);
        setAuthenticating?.(true);
        
        console.log('MiniAppAuthHandler: Starting auto-authentication');
        
        // STEP 1: Check if SDK is available 
        if (!sdk) {
          console.error('MiniAppAuthHandler: SDK not available');
          setAuthAttempted(true);
          setIsAuthenticating(false);
          setAuthenticating?.(false);
          return;
        }
        
        // Ensure SDK is initialized
        if (!sdk.initialized && typeof sdk.init === 'function') {
          console.log('MiniAppAuthHandler: Initializing SDK');
          try {
            sdk.init();
          } catch (initError) {
            console.error('MiniAppAuthHandler: Error initializing SDK:', initError);
          }
        }
        
        // STEP 2: Check if user info is directly available in context
        console.log('MiniAppAuthHandler: Checking sdk.context directly:', sdk.context);
        
        // First try direct context access (most reliable and fastest)
        if (sdk.context && sdk.context.user && sdk.context.user.fid) {
          console.log('MiniAppAuthHandler: Found user in sdk.context:', sdk.context.user);
          
          const userData = {
            fid: sdk.context.user.fid,
            username: sdk.context.user.username || `user${sdk.context.user.fid}`,
            displayName: sdk.context.user.displayName || sdk.context.user.username || `User ${sdk.context.user.fid}`,
            pfp: sdk.context.user.pfpUrl ? { url: sdk.context.user.pfpUrl } : null
          };
          
          console.log('MiniAppAuthHandler: Found valid user data in context:', userData);
          
          // Store in localStorage for persistence
          try {
            localStorage.setItem('farcaster_user', JSON.stringify(userData));
            localStorage.setItem('miniAppUserInfo', JSON.stringify(userData));
          } catch (storageError) {
            console.error('Error storing user data:', storageError);
          }
          
          // Login with user data
          console.log('MiniAppAuthHandler: Auto-login with context data:', userData);
          await login(userData);
          
          setAuthAttempted(true);
          setIsAuthenticating(false);
          setAuthenticating?.(false);
          return;
        }
        
        // STEP 3: Try getContext() method if direct context access failed
        if (typeof sdk.getContext === 'function') {
          try {
            console.log('MiniAppAuthHandler: Getting context with sdk.getContext()');
            const context = await sdk.getContext();
            console.log('MiniAppAuthHandler: Context result:', context);
            
            if (context && context.user && context.user.fid) {
              // Found authenticated user in context
              console.log('MiniAppAuthHandler: Found authenticated user:', context.user);
              
              const userData = {
                fid: context.user.fid,
                username: context.user.username || `user${context.user.fid}`,
                displayName: context.user.displayName || context.user.username || `User ${context.user.fid}`,
                pfp: context.user.pfpUrl ? { url: context.user.pfpUrl } : null
              };
              
              // Store in localStorage
              try {
                localStorage.setItem('farcaster_user', JSON.stringify(userData));
                localStorage.setItem('miniAppUserInfo', JSON.stringify(userData));
              } catch (storageError) {
                console.error('Error storing user data:', storageError);
              }
              
              // Login with user data
              console.log('MiniAppAuthHandler: Auto-login with data:', userData);
              await login(userData);
              
              setAuthAttempted(true);
              setIsAuthenticating(false);
              setAuthenticating?.(false);
              return;
            }
          } catch (contextError) {
            console.error('MiniAppAuthHandler: Error getting context:', contextError);
          }
        }
        
        // STEP 4: As a last resort, try silent sign-in
        console.log('MiniAppAuthHandler: No user found in context, trying silent sign-in');
        if (sdk.actions && typeof sdk.actions.signIn === 'function') {
          try {
            const nonce = generateNonce();
            console.log('MiniAppAuthHandler: Attempting silent authentication');
            
            // Set a timeout to prevent hanging
            const signInPromise = sdk.actions.signIn({ nonce });
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Sign-in timeout')), 5000);
            });
            
            // Race against timeout
            await Promise.race([signInPromise, timeoutPromise]);
            
            // Try to get context again after sign-in
            if (typeof sdk.getContext === 'function') {
              const newContext = await sdk.getContext();
              if (newContext && newContext.user && newContext.user.fid) {
                const userData = {
                  fid: newContext.user.fid,
                  username: newContext.user.username || `user${newContext.user.fid}`,
                  displayName: newContext.user.displayName || newContext.user.username || `User ${newContext.user.fid}`,
                  pfp: newContext.user.pfpUrl ? { url: newContext.user.pfpUrl } : null
                };
                
                // Store & login with user data
                localStorage.setItem('farcaster_user', JSON.stringify(userData));
                localStorage.setItem('miniAppUserInfo', JSON.stringify(userData));
                await login(userData);
              }
            } else if (sdk.context && sdk.context.user) {
              // Check context again after sign-in
              const userData = {
                fid: sdk.context.user.fid,
                username: sdk.context.user.username || `user${sdk.context.user.fid}`,
                displayName: sdk.context.user.displayName || sdk.context.user.username || `User ${sdk.context.user.fid}`,
                pfp: sdk.context.user.pfpUrl ? { url: sdk.context.user.pfpUrl } : null
              };
              
              // Store & login with user data
              localStorage.setItem('farcaster_user', JSON.stringify(userData));
              localStorage.setItem('miniAppUserInfo', JSON.stringify(userData));
              await login(userData);
            }
          } catch (signInError) {
            // Silent auth failed - this is expected if user needs to approve
            console.log('MiniAppAuthHandler: Silent authentication failed:', signInError);
          }
        }
        
      } catch (error) {
        console.error('MiniAppAuthHandler: Error during authentication:', error);
      } finally {
        setIsAuthenticating(false);
        setAuthAttempted(true);
        setAuthenticating?.(false);
      }
    };
    
    // Try auto-authentication on mount
    attemptAuth();
    
    // Listen for miniAppAuthenticated events
    const handleAuthenticated = (event) => {
      console.log('MiniAppAuthHandler: Caught miniAppAuthenticated event:', event.detail);
      
      if (event.detail && !isAuthenticated) {
        const userInfo = event.detail;
        
        if (userInfo.fid) {
          login(userInfo);
        }
      }
    };
    
    window.addEventListener('miniAppAuthenticated', handleAuthenticated);
    
    return () => {
      window.removeEventListener('miniAppAuthenticated', handleAuthenticated);
    };
  }, [authAttempted, isAuthenticated, isAuthenticating, login, setAuthenticating]);
  
  // This is a transparent component, it doesn't render anything
  return null;
};

export default MiniAppAuthHandler; 