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
 * This is now a simple wrapper that just calls ready() - main logic is in App.js
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
    // Just call ready() - this should dismiss the splash screen
    if (sdk.actions && typeof sdk.actions.ready === 'function') {
      await sdk.actions.ready();
      logDebug('Mini App ready() called successfully');
    } else {
      logDebug('sdk.actions.ready is not available, cannot dismiss splash screen');
    }
    
    // Try to get context
    let context = null;
    if (typeof sdk.getContext === 'function') {
      try {
        context = await sdk.getContext();
        logDebug('Mini App context received:', context);
      } catch (error) {
        logDebug('Error getting context:', error);
      }
    }
    
    return context;
  } catch (e) {
    logDebug('Error in initializeMiniApp:', e);
    
    // Always try to call ready() one more time to ensure splash screen is dismissed
    try {
      if (sdk.actions && typeof sdk.actions.ready === 'function') {
        await sdk.actions.ready();
        logDebug('Secondary ready() call succeeded');
      }
    } catch (e2) {
      logDebug('Secondary ready() call also failed:', e2);
    }
    
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
    console.log('Handling Mini App Authentication');
    
    // Generate a secure nonce for authentication
    const generateNonce = () => {
      const array = new Uint8Array(16);
      window.crypto.getRandomValues(array);
      return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    };
    
    const nonce = generateNonce();
    console.log('Using nonce for authentication:', nonce);
    
    // Use the Farcaster Frame SDK signIn action - this is the proper way to authenticate in Mini Apps
    if (sdk && sdk.actions && typeof sdk.actions.signIn === 'function') {
      console.log('Using sdk.actions.signIn for authentication');
      const signInResult = await sdk.actions.signIn({ nonce });
      console.log('Sign in result:', signInResult);
      
      if (signInResult && signInResult.message) {
        // Extract FID from the message
        const fidMatch = signInResult.message.match(/(?:fid|FID):\s*(\d+)/i);
        const fid = fidMatch ? parseInt(fidMatch[1], 10) : null;
        
        if (fid) {
          // For simplicity in this example, we'll use the FID to construct user info
          // In a real app, you would verify the message on your server first
          const userInfo = {
            fid,
            username: `user${fid}`,
            displayName: `User ${fid}`,
            pfp: {
              url: null
            }
          };
          
          // Try to get more user info from context if available
          try {
            if (sdk.context && sdk.context.user) {
              userInfo.username = sdk.context.user.username || userInfo.username;
              userInfo.displayName = sdk.context.user.displayName || userInfo.displayName;
              if (sdk.context.user.pfpUrl) {
                userInfo.pfp = { url: sdk.context.user.pfpUrl };
              }
            }
          } catch (e) {
            console.warn('Error getting user context:', e);
          }
          
          // Store auth info in localStorage for persistence
          localStorage.setItem('miniAppUserInfo', JSON.stringify(userInfo));
          
          // Make sure this gets updated in the app state
          if (window.updateAuthState) {
            window.updateAuthState({
              user: userInfo,
              isAuthenticated: true
            });
          }
          
          // Dispatch a custom event to notify components about authentication
          const authEvent = new CustomEvent('miniAppAuthenticated', { 
            detail: { userInfo }
          });
          window.dispatchEvent(authEvent);
          
          return userInfo;
        }
      }
    }
    // Fallback to older window.miniApp method if needed
    else if (window.miniApp && typeof window.miniApp.getUserInfo === 'function') {
      console.log('Falling back to window.miniApp.getUserInfo');
      const userInfo = await window.miniApp.getUserInfo();
      console.log('Mini App User Info:', userInfo);

      if (userInfo && userInfo.fid) {
        // Store auth info in localStorage for persistence
        localStorage.setItem('miniAppUserInfo', JSON.stringify(userInfo));
        
        // Make sure this gets updated in the app state
        if (window.updateAuthState) {
          window.updateAuthState({
            user: {
              fid: userInfo.fid,
              username: userInfo.username,
              displayName: userInfo.displayName,
              pfp: userInfo.pfp
            },
            isAuthenticated: true
          });
        }
        
        // Dispatch a custom event to notify components about authentication
        const authEvent = new CustomEvent('miniAppAuthenticated', { 
          detail: { userInfo }
        });
        window.dispatchEvent(authEvent);
        
        return userInfo;
      }
    }
    
    console.log('No authentication method available');
    return null;
  } catch (error) {
    console.error('Error in Mini App Authentication:', error);
    return null;
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