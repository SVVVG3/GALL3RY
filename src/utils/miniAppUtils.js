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
 * Handle authentication within a Mini App context using the recommended approach
 * Avoids direct access to SDK proxy objects that can cause toJSON errors
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
  
  // Generate a nonce for authentication
  const generateNonce = () => {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  };
  
  const nonce = generateNonce();
  console.log('Generated nonce for authentication:', nonce);
  
  try {
    // IMPORTANT: In Mini App environment, we should use the signIn action
    // and handle the result WITHOUT trying to directly access object properties
    if (sdk.actions && typeof sdk.actions.signIn === 'function') {
      console.log('Using sdk.actions.signIn for authentication...');
      
      try {
        // Set a reasonable timeout
        const signInPromise = sdk.actions.signIn({ nonce });
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Sign-in timeout after 15 seconds')), 15000);
        });
        
        // Race the promises to handle timeout
        const signInResult = await Promise.race([signInPromise, timeoutPromise]);
        console.log('Sign-in completed');
        
        // CORRECT APPROACH: Don't access signInResult properties directly
        // Instead, just verify we have a result and store it
        if (signInResult) {
          console.log('Authentication successful');
          
          // Instead of accessing complex objects, extract the minimal data we need
          // Either from the app server verification or from local storage
          try {
            // For Mini Apps, we store a simple indication that the user is authenticated
            localStorage.setItem('miniAppAuthenticated', 'true');
            
            // Try to get FID from the signInResult.message if available
            let fid = null;
            if (signInResult.message) {
              const fidMatch = signInResult.message.match(/fid:(\d+)/);
              if (fidMatch && fidMatch[1]) {
                fid = fidMatch[1];
              }
            }
            
            // Create a minimal user object with just what we need
            const minimalUserInfo = {
              authenticated: true,
              fid: fid || 'unknown',
              timestamp: new Date().toISOString()
            };
            
            localStorage.setItem('miniAppUserInfo', JSON.stringify(minimalUserInfo));
            
            // Dispatch a simple event without complex objects
            const event = new CustomEvent('miniAppAuthenticated', {
              detail: {
                authenticated: true,
                fid: minimalUserInfo.fid
              }
            });
            window.dispatchEvent(event);
            
            return { success: true, user: minimalUserInfo };
          } catch (storageError) {
            console.error('Error storing authentication data:', storageError);
          }
        } else {
          console.log('Authentication failed - no result returned');
          return { success: false, error: 'No authentication result' };
        }
      } catch (signInError) {
        console.error('Error during sign-in:', signInError);
        return { success: false, error: signInError.message || 'Sign-in failed' };
      }
    } else {
      console.error('Sign-in action not available');
      return { success: false, error: 'Sign-in action not available' };
    }
    
    return { success: false, error: 'Authentication failed' };
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