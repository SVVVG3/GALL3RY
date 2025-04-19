import { sdk } from '@farcaster/frame-sdk';

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
 * @param {string} nonce - A secure nonce for authentication (if using SIWF)
 * @returns {Promise<Object|null>} Auth result or null if not in Mini App environment
 */
export const handleMiniAppAuthentication = async (nonce) => {
  if (!isMiniAppEnvironment()) {
    logDebug('Not in Mini App environment, cannot authenticate');
    return null;
  }

  try {
    // Define a flag to track if we're in Warpcast mobile environment
    // This is more accurate checking both UA and specific WebView markers
    const isMobileWarpcast = typeof window !== 'undefined' && 
                           (window.navigator.userAgent.includes('Warpcast') ||
                            typeof window.__WARPCAST__ !== 'undefined' ||
                            (typeof window.webkit !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(window.navigator.userAgent)));
    
    logDebug(`Authentication environment check: isMobileWarpcast=${isMobileWarpcast}`);
    
    // First, try to get context to see if user is already authenticated
    // This is especially relevant for mobile Warpcast users
    if (typeof sdk.getContext === 'function') {
      try {
        const context = await sdk.getContext();
        logDebug('Got Mini App context:', context);
        
        if (context && context.user && context.user.fid) {
          logDebug('Found authenticated user in context!', context.user);
          // User is already authenticated in Warpcast, we can use this data
          return {
            success: true,
            data: {
              fid: context.user.fid,
              username: context.user.username,
              displayName: context.user.displayName,
              pfp: { url: context.user.pfpUrl }
            },
            signature: 'context-auth', // Marker to show this came from context
            message: `fid: ${context.user.fid}`,
            source: 'context'
          };
        }
      } catch (contextError) {
        logDebug('Error getting context:', contextError);
        // Continue to try explicit sign-in
      }
    }
    
    // Check if the SDK has the actions.signIn method
    if (sdk.actions && typeof sdk.actions.signIn === 'function') {
      // For Mini App environment, we can use the SDK's signIn method
      logDebug(`Calling sdk.actions.signIn with nonce (isMobileWarpcast=${isMobileWarpcast})`);
      
      // If we're on mobile Warpcast, use a longer timeout since silent auth should work
      const timeoutDuration = isMobileWarpcast ? 10000 : 5000;
      
      // Create a timeout to prevent hanging if signIn never resolves
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Authentication timed out')), timeoutDuration);
      });
      
      // Race the actual sign-in against the timeout
      const authResult = await Promise.race([
        sdk.actions.signIn({ nonce }),
        timeoutPromise
      ]);
      
      logDebug('Auth result received:', authResult);
      
      // Ensure splash screen is dismissed after auth regardless of success/failure
      try {
        if (sdk.actions && typeof sdk.actions.ready === 'function') {
          await sdk.actions.ready();
          logDebug('Splash screen dismissed after auth');
        }
      } catch (e) {
        logDebug('Error dismissing splash screen after auth:', e);
      }
      
      return authResult;
    } else {
      logDebug('signIn method not available in this SDK version');
      return null;
    }
  } catch (e) {
    logDebug('Error authenticating in Mini App:', e);
    
    // Ensure splash screen is dismissed even if auth fails
    try {
      if (sdk.actions && typeof sdk.actions.ready === 'function') {
        await sdk.actions.ready();
        logDebug('Splash screen dismissed after auth error');
      }
    } catch (e2) {
      logDebug('Error dismissing splash screen after auth error:', e2);
    }
    
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