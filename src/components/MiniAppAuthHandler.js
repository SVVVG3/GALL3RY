import React, { useEffect, useState } from 'react';
import { sdk } from '@farcaster/frame-sdk';
import { useAuth } from '../contexts/AuthContext';
import { isMiniAppEnvironment } from '../utils/miniAppUtils';

// Safely access SDK property with explicit type conversion - prevents Symbol.toPrimitive errors
const safeGetProperty = (obj, path, defaultVal = null) => {
  if (!obj) return defaultVal;
  
  try {
    const keys = path.split('.');
    let result = obj;
    
    for (const key of keys) {
      if (result === undefined || result === null) return defaultVal;
      
      // Using hasOwnProperty to check if the property exists
      // This avoids triggering Symbol.toPrimitive
      if (!Object.prototype.hasOwnProperty.call(result, key)) {
        return defaultVal;
      }
      
      result = result[key];
    }
    
    return result;
  } catch (e) {
    console.error(`Error accessing property ${path}:`, e.message);
    return defaultVal;
  }
};

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
            console.error('MiniAppAuthHandler: Error initializing SDK:', initError.message || 'Unknown error');
          }
        }
        
        // STEP 2: Check if user info is directly available in context
        // SAFE: Only log booleans about existence, not the actual objects
        console.log('MiniAppAuthHandler: SDK context check:', {
          hasContext: !!sdk.context,
          hasUser: safeGetProperty(sdk, 'context.user', false) ? true : false,
          hasFid: safeGetProperty(sdk, 'context.user.fid', false) ? true : false
        });
        
        // First try direct context access (most reliable and fastest)
        const hasFid = safeGetProperty(sdk, 'context.user.fid', false);
        if (hasFid) {
          try {
            // SAFE: Only log what properties exist, not their values
            console.log('MiniAppAuthHandler: Found user properties:', {
              hasFid: !!safeGetProperty(sdk, 'context.user.fid', false),
              hasUsername: !!safeGetProperty(sdk, 'context.user.username', false),
              hasDisplayName: !!safeGetProperty(sdk, 'context.user.displayName', false),
              hasPfp: !!safeGetProperty(sdk, 'context.user.pfpUrl', false)
            });
            
            // SAFE: Create a clean object with only primitive values
            const fid = safeGetProperty(sdk, 'context.user.fid', 0);
            const username = safeGetProperty(sdk, 'context.user.username', `user${fid}`);
            const displayName = safeGetProperty(sdk, 'context.user.displayName', username || `User ${fid}`);
            const pfpUrl = safeGetProperty(sdk, 'context.user.pfpUrl', null);
            
            // Create a clean data object with NO references to the original SDK objects
            const userData = {
              fid: Number(fid),
              username: String(username || `user${fid}`),
              displayName: String(displayName || username || `User ${fid}`),
              pfp: { url: pfpUrl ? String(pfpUrl) : null }
            };
            
            // SAFE: Log only the keys, not the values
            console.log('MiniAppAuthHandler: Created user data object with keys:', Object.keys(userData));
            
            // For the sake of avoiding storage errors - don't use localStorage
            // in Mini App iframe for now. Just use the data directly.
            console.log('MiniAppAuthHandler: Auto-login with FID:', userData.fid);
            await login(userData);
            
            setAuthAttempted(true);
            setIsAuthenticating(false);
            setAuthenticating?.(false);
            return;
          } catch (error) {
            console.error('MiniAppAuthHandler: Error processing user data:', error.message || 'Unknown error');
          }
        }
        
        // STEP 3: Try getContext() method if direct context access failed
        if (typeof sdk.getContext === 'function') {
          try {
            console.log('MiniAppAuthHandler: Calling sdk.getContext()');
            // Store raw context in a variable but don't log it directly
            const rawContext = await sdk.getContext();
            
            // SAFE: Log only existence of properties
            console.log('MiniAppAuthHandler: getContext result:', {
              hasData: !!rawContext,
              hasUser: rawContext && !!rawContext.user,
              hasFid: rawContext && rawContext.user && !!rawContext.user.fid
            });
            
            if (rawContext && rawContext.user && rawContext.user.fid) {
              // SAFE: Create a clean object with only primitive values
              const userData = {
                fid: Number(rawContext.user.fid || 0),
                username: rawContext.user.username ? String(rawContext.user.username) : `user${rawContext.user.fid}`,
                displayName: rawContext.user.displayName ? String(rawContext.user.displayName) : 
                           (rawContext.user.username ? String(rawContext.user.username) : `User ${rawContext.user.fid}`),
                pfp: { url: rawContext.user.pfpUrl ? String(rawContext.user.pfpUrl) : null }
              };
              
              // Store in localStorage
              try {
                localStorage.setItem('farcaster_user', JSON.stringify(userData));
                localStorage.setItem('miniAppUserInfo', JSON.stringify(userData));
              } catch (storageError) {
                console.error('Error storing user data:', storageError.message || 'Unknown error');
              }
              
              // Login with user data
              console.log('MiniAppAuthHandler: Auto-login with FID:', userData.fid);
              await login(userData);
              
              setAuthAttempted(true);
              setIsAuthenticating(false);
              setAuthenticating?.(false);
              return;
            }
          } catch (contextError) {
            console.error('MiniAppAuthHandler: Error getting context:', contextError.message || 'Unknown error');
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
            
            // Race against timeout - don't log the result directly
            await Promise.race([signInPromise, timeoutPromise]);
            console.log('MiniAppAuthHandler: Sign-in completed');
            
            // Try to get context again after sign-in
            if (typeof sdk.getContext === 'function') {
              const newContext = await sdk.getContext();
              if (newContext && newContext.user && newContext.user.fid) {
                // SAFE: Create a clean object with only primitive values
                const userData = {
                  fid: Number(newContext.user.fid || 0),
                  username: newContext.user.username ? String(newContext.user.username) : `user${newContext.user.fid}`,
                  displayName: newContext.user.displayName ? String(newContext.user.displayName) : 
                             (newContext.user.username ? String(newContext.user.username) : `User ${newContext.user.fid}`),
                  pfp: { url: newContext.user.pfpUrl ? String(newContext.user.pfpUrl) : null }
                };
                
                // Store & login with user data
                localStorage.setItem('farcaster_user', JSON.stringify(userData));
                localStorage.setItem('miniAppUserInfo', JSON.stringify(userData));
                await login(userData);
              }
            } else if (sdk.context && sdk.context.user) {
              // SAFE: Create a clean object with only primitive values
              const userData = {
                fid: Number(sdk.context.user.fid || 0),
                username: sdk.context.user.username ? String(sdk.context.user.username) : `user${sdk.context.user.fid}`,
                displayName: sdk.context.user.displayName ? String(sdk.context.user.displayName) : 
                           (sdk.context.user.username ? String(sdk.context.user.username) : `User ${sdk.context.user.fid}`),
                pfp: { url: sdk.context.user.pfpUrl ? String(sdk.context.user.pfpUrl) : null }
              };
              
              // Store & login with user data
              localStorage.setItem('farcaster_user', JSON.stringify(userData));
              localStorage.setItem('miniAppUserInfo', JSON.stringify(userData));
              await login(userData);
            }
          } catch (signInError) {
            // Silent auth failed - this is expected if user needs to approve
            console.log('MiniAppAuthHandler: Silent authentication failed:', signInError.message || 'Unknown error');
          }
        }
        
      } catch (error) {
        console.error('MiniAppAuthHandler: Error during authentication:', error.message || 'Unknown error');
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
      // SAFE: Only log the FID and username, not the full detail object
      if (event.detail && event.detail.fid) {
        console.log('MiniAppAuthHandler: Authenticated event with FID:', event.detail.fid);
      } else {
        console.log('MiniAppAuthHandler: Authenticated event received but missing FID');
      }
      
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