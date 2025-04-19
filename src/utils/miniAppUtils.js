import { sdk } from '@farcaster/frame-sdk';
import React from 'react';

// Add detailed debugging at the top of the file
const DEBUG_MINI_APP = true;

function logDebug(...args) {
  if (DEBUG_MINI_APP) {
    console.log('[MINI APP DEBUG]', ...args);
  }
}

/**
 * Check if the current app is running inside a Farcaster Mini App container
 * @returns {boolean} True if running in a Mini App, false otherwise
 */
export const isMiniAppEnvironment = () => {
  // Enhanced check to determine if we're in a Mini App environment
  try {
    // Check for SDK existence first
    const sdkExists = typeof sdk !== 'undefined';
    
    // Method 1: Check if the sdk.isFrame() method is available and returns true
    const isFrame = sdkExists && typeof sdk.isFrame === 'function' && sdk.isFrame();
    
    // Method 2: Check if running in an iframe
    const inIframe = typeof window !== 'undefined' && window.self !== window.top;
    
    // Method 3: Check for Farcaster/Warpcast in the User Agent
    const hasFarcasterInUA = typeof window !== 'undefined' && 
                           (window.navigator.userAgent.includes('Farcaster') || 
                            window.navigator.userAgent.includes('Warpcast'));
    
    // Method 4: Check for mobile-specific markers in the user agent
    const isMobileUA = typeof window !== 'undefined' && 
                      (/Android|iPhone|iPad|iPod|Mobile/i.test(window.navigator.userAgent));
    
    // Method 5: Directly try to access specific Warpcast webview context variables
    // This is a more specific check for the Warpcast WebView environment
    const hasWarpcastBridge = typeof window !== 'undefined' && 
                             (typeof window.webkit !== 'undefined' || 
                              typeof window.ReactNativeWebView !== 'undefined' ||
                              typeof window.__WARPCAST__ !== 'undefined');
    
    // Method 6: Try to access context (for newer SDK versions)
    let hasContext = false;
    if (sdkExists && typeof sdk.getContext === 'function') {
      try {
        // Just check if this function exists, don't actually call it yet
        hasContext = true;
      } catch (e) {}
    }
    
    // For debug: Check if we're in a mobile browser but not directly in Warpcast
    const isMobileBrowser = isMobileUA && !hasWarpcastBridge && !hasFarcasterInUA;
    
    // Prioritize most reliable detection methods
    const isInMiniApp = isFrame || hasWarpcastBridge || hasFarcasterInUA || inIframe || (isMobileUA && hasContext);
    
    logDebug(`Mini App environment detailed check:
      isFrame=${isFrame}, 
      inIframe=${inIframe}, 
      hasFarcasterInUA=${hasFarcasterInUA}, 
      isMobileUA=${isMobileUA},
      hasWarpcastBridge=${hasWarpcastBridge},
      isMobileBrowser=${isMobileBrowser},
      hasContext=${hasContext}, 
      FINAL=${isInMiniApp}`);
    
    return isInMiniApp;
  } catch (e) {
    console.warn('Error checking Mini App environment:', e);
    return false;
  }
};

/**
 * React hook to check if we're in a Mini App environment
 * @returns {boolean} True if in a Mini App, false otherwise
 */
export const useIsMiniApp = () => {
  const [isMiniApp, setIsMiniApp] = React.useState(false);
  
  React.useEffect(() => {
    setIsMiniApp(isMiniAppEnvironment());
  }, []);
  
  return isMiniApp;
};

/**
 * Initialize the Mini App SDK if we're in a Mini App environment
 * @returns {Promise<void>}
 */
export const initializeMiniApp = async () => {
  const isInMiniApp = isMiniAppEnvironment();
  logDebug(`initializeMiniApp called, isInMiniApp=${isInMiniApp}`);
  
  if (!isInMiniApp) {
    logDebug('Not in Mini App environment, skipping initialization');
    return null;
  }

  try {
    // According to docs, we should call ready() to dismiss the splash screen
    if (sdk && sdk.actions && typeof sdk.actions.ready === 'function') {
      logDebug('Calling sdk.actions.ready() to dismiss splash screen');
      await sdk.actions.ready();
      logDebug('Splash screen dismissed');
      
      // Also log the user context if available
      if (sdk.context && sdk.context.user) {
        logDebug('User context available:', sdk.context.user);
      } else {
        logDebug('No user context available yet');
      }
      
      return sdk.context;
    } else {
      logDebug('sdk.actions.ready is not available, cannot dismiss splash screen');
    }
    
    return null;
  } catch (e) {
    logDebug('Error in initializeMiniApp:', e);
    return { error: e.message };
  }
};

/**
 * Set up event listeners for Mini App events from the Farcaster client
 * @returns {void}
 */
export const setupMiniAppEventListeners = () => {
  if (!isMiniAppEnvironment()) {
    return;
  }

  // Make sure the SDK has an 'on' method before trying to use it
  if (typeof sdk.on !== 'function') {
    console.warn('Event listening not supported in this SDK version');
    return;
  }

  // Listen for events from the Farcaster client
  sdk.on('frameAdded', () => {
    console.log('App was added to user collection');
  });
  
  sdk.on('frameRemoved', () => {
    console.log('App was removed from user collection');
  });
};

/**
 * Handle authentication within a Mini App context
 * Uses existing Farcaster auth or sign-in method depending on environment
 * @returns {Promise<Object|null>} Auth result or null if not in Mini App environment
 */
export const handleMiniAppAuthentication = async () => {
  try {
    console.log('Mini App Authentication: Starting authentication process');
    
    // Check if we have the SDK available
    if (typeof sdk === 'undefined' || !sdk) {
      console.error('Mini App Authentication: Frame SDK not initialized');
      return { success: false, error: 'Frame SDK not initialized' };
    }

    // Generate a secure nonce for authentication
    const generateNonce = () => {
      const array = new Uint8Array(16);
      window.crypto.getRandomValues(array);
      return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    };
    
    const nonce = generateNonce();
    console.log('Mini App Authentication: Generated nonce for authentication');
    
    try {
      // Use the SDK's signIn method to authenticate the user
      const signInResult = await sdk.actions.signIn({ nonce });
      console.log('Mini App Authentication: Sign in successful', signInResult);
      
      // Get user context from the SDK
      const userContext = sdk.context?.user;
      console.log('Mini App Authentication: User context from SDK', userContext);
      
      if (userContext && userContext.fid) {
        // Create a user object from the context
        const userInfo = {
          fid: userContext.fid,
          username: userContext.username || `user${userContext.fid}`,
          displayName: userContext.displayName || userContext.username || `User ${userContext.fid}`,
          pfp: { url: userContext.pfpUrl || null }
        };
        
        // Store the user info in localStorage for persistence
        localStorage.setItem('farcaster_user', JSON.stringify(userInfo));
        console.log('Mini App Authentication: Stored user info in localStorage', userInfo);
        
        // Get any auth context that might exist from React
        const authContext = window._authContext || null;
        
        // Update the auth context if available
        if (authContext && authContext.current && typeof authContext.current.login === 'function') {
          console.log('Mini App Authentication: Updating auth context with user info');
          await authContext.current.login({
            fid: userInfo.fid,
            username: userInfo.username,
            displayName: userInfo.displayName,
            signInResult
          });
        } else {
          console.log('Mini App Authentication: Auth context not available, dispatching event');
          // Dispatch an event for components to listen for
          const event = new CustomEvent('miniAppAuthenticated', {
            detail: {
              fid: userInfo.fid,
              username: userInfo.username,
              displayName: userInfo.displayName || userInfo.username,
              pfp: userInfo.pfp,
              signInResult
            }
          });
          window.dispatchEvent(event);
        }
        
        return { 
          success: true, 
          user: userInfo,
          signInResult
        };
      } else {
        console.error('Mini App Authentication: No valid user context after sign in');
        return { success: false, error: 'No valid user context after sign in' };
      }
    } catch (error) {
      if (error.name === 'RejectedByUser') {
        console.log('Mini App Authentication: User rejected sign in request');
        return { success: false, error: 'User rejected sign in', rejected: true };
      }
      
      console.error('Mini App Authentication: Error during sign in', error);
      return { success: false, error: error.message || 'Error during sign in' };
    }
  } catch (error) {
    console.error('Mini App Authentication: Unexpected error during authentication', error);
    return { success: false, error: error.message || 'Unknown error during authentication' };
  }
};

/**
 * View a user's Farcaster profile
 * @param {number} fid - Farcaster ID of the user
 * @returns {Promise<void>}
 */
export const viewFarcasterProfile = async (fid) => {
  if (!isMiniAppEnvironment() || !sdk.actions || typeof sdk.actions.viewProfile !== 'function') {
    // In web app, navigate to the profile page
    window.location.href = `/profile/${fid}`;
    return;
  }

  try {
    await sdk.actions.viewProfile({ fid });
  } catch (e) {
    console.error('Error viewing profile in Mini App:', e);
    window.location.href = `/profile/${fid}`;
  }
};

/**
 * Compose a cast with optional embeds
 * @param {Object} options - Cast options
 * @param {string} options.text - Text of the cast
 * @param {string[]} options.embeds - URLs to embed in the cast
 * @returns {Promise<Object|null>} Cast result or null if not in Mini App environment
 */
export const composeCast = async ({ text, embeds }) => {
  if (!isMiniAppEnvironment() || !sdk.actions || typeof sdk.actions.composeCast !== 'function') {
    console.log('Compose cast is only available in Mini App environment');
    return null;
  }

  try {
    return await sdk.actions.composeCast({ text, embeds });
  } catch (e) {
    console.error('Error composing cast in Mini App:', e);
    return null;
  }
};

/**
 * Prompts the user to add the Mini App to their collection in Farcaster
 * @returns {Promise<boolean>} True if the app was added, false otherwise
 */
export const promptAddFrame = async () => {
  if (!isMiniAppEnvironment() || !sdk.actions || typeof sdk.actions.addFrame !== 'function') {
    console.log('Add frame is only available in Mini App environment');
    return false;
  }

  try {
    await sdk.actions.addFrame();
    logDebug('User added frame successfully');
    return true;
  } catch (e) {
    if (e.name === 'RejectedByUser') {
      logDebug('User rejected adding the app');
    } else {
      console.error('Error adding frame in Mini App:', e);
    }
    return false;
  }
}; 