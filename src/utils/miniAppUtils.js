import React from 'react';

// Add detailed debugging at the top of the file
const DEBUG_MINI_APP = true;

// Safely reference the SDK to handle cases where extensions might cause issues
let safeSDK;
try {
  const { sdk } = require('@farcaster/frame-sdk');
  safeSDK = sdk;
} catch (e) {
  console.warn('Error importing Farcaster SDK, creating fallback:', e);
  // Create a fallback SDK with empty methods
  safeSDK = {
    actions: { 
      ready: async () => console.log('Fallback SDK: ready called'),
      signIn: async () => console.log('Fallback SDK: signIn called')
    },
    getContext: async () => null,
    context: {}
  };
}

// Add an immediate debug check of the SDK to see if it's loading
console.log('miniAppUtils.js loaded, SDK status:', {
  sdkDefined: typeof safeSDK !== 'undefined',
  sdkActions: safeSDK && typeof safeSDK.actions !== 'undefined',
  sdkContext: safeSDK && typeof safeSDK.context !== 'undefined',
  actionsSignIn: safeSDK && safeSDK.actions && typeof safeSDK.actions.signIn === 'function',
  actionsReady: safeSDK && safeSDK.actions && typeof safeSDK.actions.ready === 'function'
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
    const sdkExists = typeof safeSDK !== 'undefined';
    
    // Method 1: Check if the sdk.isFrame() method is available and returns true
    const isFrame = sdkExists && typeof safeSDK.isFrame === 'function' && safeSDK.isFrame();
    
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
    if (sdkExists && typeof safeSDK.getContext === 'function') {
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
 * Dismiss the Mini App splash screen
 * @returns {Promise<boolean>} True if successfully dismissed, false otherwise
 */
export const dismissSplashScreen = async () => {
  logDebug('Attempting to dismiss splash screen');
  
  try {
    if (!safeSDK) {
      console.warn('SDK is not available for dismissing splash screen');
      return false;
    }
    
    // Try using sdk.actions.ready() method (current API according to docs)
    if (safeSDK.actions && typeof safeSDK.actions.ready === 'function') {
      logDebug('Calling sdk.actions.ready()');
      await safeSDK.actions.ready();
      logDebug('Splash screen dismissed with actions.ready');
      return true;
    }
    
    // Try using hideSplashScreen method (older API)
    if (typeof safeSDK.hideSplashScreen === 'function') {
      logDebug('Calling sdk.hideSplashScreen()');
      await safeSDK.hideSplashScreen();
      logDebug('Splash screen dismissed with hideSplashScreen');
      return true;
    }
    
    // Fallback to older SDK versions that might use dismissSplashScreen
    if (typeof safeSDK.dismissSplashScreen === 'function') {
      logDebug('Calling sdk.dismissSplashScreen()');
      await safeSDK.dismissSplashScreen();
      logDebug('Splash screen dismissed with dismissSplashScreen');
      return true;
    }
    
    console.warn('No splash screen dismissal method found on SDK');
    return false;
  } catch (e) {
    console.error('Error dismissing splash screen:', e);
    return false;
  }
};

/**
 * View a user's Farcaster profile
 * @param {number} fid - Farcaster ID of the user
 * @returns {Promise<void>}
 */
export const viewFarcasterProfile = async (fid) => {
  if (!isMiniAppEnvironment() || !safeSDK.actions || typeof safeSDK.actions.viewProfile !== 'function') {
    // In web app, navigate to the profile page
    window.location.href = `/profile/${fid}`;
    return;
  }

  try {
    await safeSDK.actions.viewProfile({ fid });
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
  if (!isMiniAppEnvironment() || !safeSDK.actions || typeof safeSDK.actions.composeCast !== 'function') {
    console.log('Compose cast is only available in Mini App environment');
    return null;
  }

  try {
    return await safeSDK.actions.composeCast({ text, embeds });
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
  if (!isMiniAppEnvironment() || !safeSDK.actions || typeof safeSDK.actions.addFrame !== 'function') {
    console.log('Add frame is only available in Mini App environment');
    return false;
  }

  try {
    await safeSDK.actions.addFrame();
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

// Helper function to safely get a primitive value from potentially proxy objects
const safeGetPrimitive = (value, defaultValue = null) => {
  try {
    // Case 1: value is undefined or null
    if (value === undefined || value === null) {
      return defaultValue;
    }
    
    // Case 2: value is a function (proxy objects often appear as functions)
    if (typeof value === 'function') {
      return defaultValue;
    }
    
    // Case 3: value is an object but we need a string/number/etc
    // Instead of accessing properties (which might trigger proxy traps)
    // convert directly to the needed primitive
    if (typeof value === 'object') {
      // Try using String() which avoids calling methods on the object
      return String(value) !== '[object Object]' ? String(value) : defaultValue;
    }
    
    // Case 4: value is already a primitive, return as is
    return value;
  } catch (e) {
    console.warn('Error getting primitive value:', e);
    return defaultValue;
  }
};

// Enhanced function to safely extract user data with special handling for pfpUrl
const safeExtractUserData = (user) => {
  if (!user) return null;
  
  try {
    const userData = {
      fid: safeGetPrimitive(user.fid, 0),
      username: safeGetPrimitive(user.username, ''),
      displayName: safeGetPrimitive(user.displayName, safeGetPrimitive(user.username, '')),
      pfp: safeGetPrimitive(user.pfpUrl, '')
    };
    
    // Convert to expected types
    userData.fid = Number(userData.fid);
    userData.username = String(userData.username || '');
    userData.displayName = String(userData.displayName || userData.username || '');
    userData.pfp = String(userData.pfp || '');
    
    return userData;
  } catch (e) {
    console.error('Error safely extracting user data:', e);
    return {
      fid: 0,
      username: '',
      displayName: '',
      pfp: ''
    };
  }
};

// Export utility functions for use in other components
export { safeGetPrimitive, safeExtractUserData }; 