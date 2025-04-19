import { sdk } from '@farcaster/frame-sdk';
import React from 'react';

// Add detailed debugging at the top of the file
const DEBUG_MINI_APP = true;

// Add an immediate debug check of the SDK to see if it's loading
console.log('miniAppUtils.js loaded, SDK status:', {
  sdkDefined: typeof sdk !== 'undefined',
  sdkActions: sdk && typeof sdk.actions !== 'undefined',
  sdkContext: sdk && typeof sdk.context !== 'undefined',
  actionsSignIn: sdk && sdk.actions && typeof sdk.actions.signIn === 'function',
  actionsReady: sdk && sdk.actions && typeof sdk.actions.ready === 'function'
});

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
  console.log('⭐️ handleMiniAppAuthentication called');
  
  // Ensure we're in a Mini App environment
  if (!isMiniAppEnvironment()) {
    console.log('Not in Mini App environment');
    return { success: false, error: 'Not in Mini App environment' };
  }
  
  // Verify SDK is available
  if (!sdk) {
    console.error('SDK is not available');
    return { success: false, error: 'SDK not available' };
  }
  
  // Ensure SDK is initialized
  if (!sdk.initialized && typeof sdk.init === 'function') {
    try {
      sdk.init();
      console.log('SDK initialized');
    } catch (initError) {
      console.error('Error initializing SDK:', initError);
      return { success: false, error: 'SDK initialization failed' };
    }
  }
  
  try {
    // Generate a secure nonce for authentication
    const generateNonce = () => {
      const array = new Uint8Array(16);
      window.crypto.getRandomValues(array);
      return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    };
    
    const nonce = generateNonce();
    console.log('Generated nonce for authentication');
    
    // First check for existing user info in localStorage
    let userInfo = null;
    try {
      const storedInfo = localStorage.getItem('farcaster_user');
      if (storedInfo) {
        const parsedInfo = JSON.parse(storedInfo);
        if (parsedInfo && parsedInfo.fid) {
          userInfo = parsedInfo;
          console.log('Retrieved existing user info from localStorage');
        }
      }
    } catch (storageError) {
      console.log('Error retrieving from localStorage:', storageError);
    }
    
    // If no stored user info, try to get from context
    if (!userInfo) {
      // Check if the getContext method is available
      if (typeof sdk.getContext === 'function') {
        try {
          console.log('Getting user info from sdk.getContext()');
          const context = await sdk.getContext();
          console.log('Context result:', context);
          
          if (context && context.user && context.user.fid) {
            userInfo = {
              fid: context.user.fid,
              username: context.user.username || `user${context.user.fid}`,
              displayName: context.user.displayName || context.user.username || `User ${context.user.fid}`,
              pfp: { url: context.user.pfpUrl || null }
            };
            console.log('Got user info from getContext:', userInfo);
          }
        } catch (contextError) {
          console.log('Error getting context:', contextError);
        }
      }
      
      // If getContext didn't work, try context property directly
      if (!userInfo && sdk.context && sdk.context.user && sdk.context.user.fid) {
        const user = sdk.context.user;
        userInfo = {
          fid: user.fid,
          username: user.username || `user${user.fid}`,
          displayName: user.displayName || user.username || `User ${user.fid}`,
          pfp: { url: user.pfpUrl || null }
        };
        console.log('Got user info from context property:', userInfo);
      }
      
      // If still no user info, try sign-in
      if (!userInfo && sdk.actions && typeof sdk.actions.signIn === 'function') {
        try {
          console.log('No user info found, attempting to sign in');
          
          // Create a timeout to avoid hanging
          const signInPromise = sdk.actions.signIn({ nonce });
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Sign-in timeout')), 5000);
          });
          
          // Race the promises
          const signInResult = await Promise.race([signInPromise, timeoutPromise]);
          console.log('Sign-in result type:', typeof signInResult);
          
          // Try to get context again after sign-in
          if (typeof sdk.getContext === 'function') {
            const newContext = await sdk.getContext();
            if (newContext && newContext.user && newContext.user.fid) {
              userInfo = {
                fid: newContext.user.fid,
                username: newContext.user.username || `user${newContext.user.fid}`,
                displayName: newContext.user.displayName || newContext.user.username || `User ${newContext.user.fid}`,
                pfp: { url: newContext.user.pfpUrl || null }
              };
              console.log('Got user info after sign-in:', userInfo);
            }
          }
        } catch (signInError) {
          console.log('Sign-in error or timeout:', signInError);
          return { success: false, error: 'Sign-in failed or was rejected' };
        }
      }
    }
    
    // If we have user info, store it and update state
    if (userInfo && userInfo.fid) {
      // Store in localStorage for persistence
      try {
        localStorage.setItem('farcaster_user', JSON.stringify(userInfo));
        localStorage.setItem('miniAppUserInfo', JSON.stringify(userInfo));
        console.log('Stored user info in localStorage');
      } catch (storageError) {
        console.error('Error storing in localStorage:', storageError);
      }
      
      // Update auth state if function is available
      if (window.authContextRef && window.authContextRef.current) {
        console.log('Updating auth state with authContextRef');
        window.authContextRef.current.setAuth({
          isAuthenticated: true,
          user: userInfo
        });
      }
      
      // Update auth state with updateAuthState if available
      if (typeof window.updateAuthState === 'function') {
        console.log('Calling updateAuthState function');
        window.updateAuthState({
          user: userInfo,
          isAuthenticated: true
        });
      } else {
        // Dispatch event for components to react to
        console.log('Dispatching miniAppAuthenticated event');
        const event = new CustomEvent('miniAppAuthenticated', {
          detail: userInfo
        });
        window.dispatchEvent(event);
      }
      
      return { success: true, user: userInfo };
    }
    
    console.log('Failed to get user info through any method');
    return { success: false, error: 'Could not get user info' };
  } catch (error) {
    console.error('Error during Mini App authentication:', error);
    return { success: false, error: error.message || 'Authentication failed' };
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