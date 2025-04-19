import { sdk } from '@farcaster/frame-sdk';

// Add detailed debugging at the top of the file
const DEBUG_MINI_APP = true;

function logDebug(...args) {
  if (DEBUG_MINI_APP) {
    console.log('[MINI APP DEBUG]', ...args);
  }
}

// Log SDK availability and version
try {
  if (typeof sdk !== 'undefined') {
    logDebug('Frame SDK detected:', sdk);
    logDebug('SDK version:', sdk.version || 'unknown');
    logDebug('SDK methods:', Object.keys(sdk));
    if (sdk.actions) {
      logDebug('SDK actions:', Object.keys(sdk.actions));
    }
  } else {
    logDebug('Frame SDK not detected');
  }
} catch (e) {
  logDebug('Error checking SDK:', e);
}

// DO NOT call ready at the module level - this can cause issues
// Instead, we'll make multiple attempts to call ready in the initialization function

/**
 * Utility functions for Farcaster Mini App integration
 * These utilities allow our app to work both as a regular web app and as a Mini App
 * without breaking existing functionality
 */

/**
 * Check if the current app is running inside a Farcaster Mini App container
 * @returns {boolean} True if running in a Mini App, false otherwise
 */
export const isMiniAppEnvironment = () => {
  // Check if we're in a frame/mobile webview using the SDK
  try {
    // Check if we're in a Farcaster client by looking for specific indicators
    const inFarcasterWebView = typeof window !== 'undefined' && 
      (window.navigator.userAgent.includes('Farcaster') || 
       window.navigator.userAgent.includes('Warpcast') ||
       window.location.href.includes('warpcast.com') ||
       window.parent !== window);
    
    logDebug('Checking Mini App environment:');
    logDebug('- inFarcasterWebView:', inFarcasterWebView);
    logDebug('- userAgent:', window.navigator.userAgent);
    logDebug('- location:', window.location.href);
    logDebug('- is iframe:', window.self !== window.top);
    logDebug('- is mobile:', /iPhone|iPad|iPod|Android/i.test(window.navigator.userAgent));
      
    // First try the SDK isFrame method if available
    if (typeof sdk.isFrame === 'function') {
      const isFrame = sdk.isFrame();
      logDebug('- sdk.isFrame() result:', isFrame);
      return isFrame;
    }
    
    logDebug('- sdk.isFrame not available, using fallbacks');
    
    // Fall back to checking for the postMessage API which is used by the SDK
    const result = inFarcasterWebView || (typeof window !== 'undefined' && 
      typeof window.parent !== 'undefined' && 
      window.parent !== window);
      
    logDebug('- Final environment detection result:', result);
    return result;
  } catch (e) {
    console.warn('Error checking Mini App environment:', e);
    
    // Fall back to checking if we're in an iframe as a last resort
    const isIframe = typeof window !== 'undefined' && window.self !== window.top;
    logDebug('- Error occurred, fallback to iframe check:', isIframe);
    return isIframe;
  }
};

// A safety flag to ensure we don't call ready multiple times
let readyCalled = false;

/**
 * Initialize the Mini App SDK if we're in a Mini App environment
 * Call this early in the app initialization
 * @param {Object} options - Options for initialization
 * @param {boolean} options.disableNativeGestures - Whether to disable native gestures
 * @returns {Promise<void>}
 */
export const initializeMiniApp = async (options = {}) => {
  const isInMiniApp = isMiniAppEnvironment();
  logDebug(`initializeMiniApp called, isInMiniApp=${isInMiniApp}`, options);
  
  if (!isInMiniApp) {
    logDebug('Not in Mini App environment, skipping initialization');
    return;
  }

  // CRITICAL: The priority is to dismiss the splash screen first
  logDebug('🚨 PRIORITY: Dismissing splash screen first, before any other operations');
  
  try {
    // Make IMMEDIATE call to ready() - this is the most important thing
    if (sdk.actions && typeof sdk.actions.ready === 'function' && !readyCalled) {
      logDebug('Making IMMEDIATE call to sdk.actions.ready()');
      try {
        // Don't await this call - we want it to happen immediately
        sdk.actions.ready({
          disableNativeGestures: options.disableNativeGestures || false
        }).then(() => {
          logDebug('✓ Immediate ready() call succeeded');
          readyCalled = true;
        }).catch(e => {
          logDebug('✗ Immediate ready() call failed:', e);
        });
        
        // Mark as called anyway to prevent duplicate calls
        readyCalled = true;
      } catch (readyError) {
        logDebug('Error in immediate ready() call:', readyError);
      }
    }
    
    // Use a timeout to ensure ready is called even if there's a delay
    // This is especially important for mobile environments
    setTimeout(() => {
      if (!readyCalled && sdk.actions && typeof sdk.actions.ready === 'function') {
        logDebug('Calling ready from safety timeout');
        sdk.actions.ready({
          disableNativeGestures: options.disableNativeGestures || false
        }).catch(e => {
          logDebug('Timeout ready call failed:', e);
        });
        readyCalled = true;
      }
    }, 2000);

    logDebug('Initializing Mini App and telling Farcaster we are ready...');
    
    // Now try a second, awaited call to ready to ensure we get the context
    if (sdk.actions && typeof sdk.actions.ready === 'function') {
      logDebug('Making awaited call to sdk.actions.ready()');
      try {
        await sdk.actions.ready({
          disableNativeGestures: options.disableNativeGestures || false
        });
        logDebug('Mini App initialized successfully with sdk.actions.ready()');
        readyCalled = true;
      } catch (readyError) {
        logDebug('Error calling sdk.actions.ready():', readyError);
        // Don't throw here, try other methods
      }
    } 
    // Fallback to other methods if actions.ready is not available
    else if (typeof sdk.ready === 'function') {
      logDebug('Falling back to sdk.ready() method');
      try {
        await sdk.ready();
        logDebug('Mini App initialized with legacy sdk.ready() method');
        readyCalled = true;
      } catch (readyError) {
        logDebug('Error calling sdk.ready():', readyError);
        // Don't throw here
      }
    } 
    else if (readyCalled) {
      logDebug('Ready was already called, skipping initialization');
    }
    else {
      logDebug('No ready method available in SDK');
      console.warn('No ready method available in this SDK version. The app may not display properly in Farcaster.');
    }
    
    // Try to get client context if available
    let context = null;
    if (typeof sdk.getContext === 'function') {
      logDebug('Attempting to get context');
      try {
        context = await sdk.getContext();
        logDebug('Mini App context received:', context);
      } catch (contextError) {
        logDebug('Could not get Mini App context:', contextError);
        console.warn('Could not get Mini App context:', contextError);
      }
    } else {
      logDebug('getContext method not available');
    }
    
    return context;
  } catch (e) {
    logDebug('Error in initializeMiniApp, but continuing:', e);
    console.warn('Error in initializeMiniApp, but continuing:', e);
    
    // Try one more time to call ready if it hasn't been called yet
    if (!readyCalled && sdk.actions && typeof sdk.actions.ready === 'function') {
      try {
        logDebug('Final attempt to call ready after error');
        await sdk.actions.ready({
          disableNativeGestures: options.disableNativeGestures || false
        });
        readyCalled = true;
        logDebug('Final ready call succeeded');
      } catch (finalError) {
        logDebug('Final ready call also failed:', finalError);
      }
    }
    
    // Return an error object rather than throwing
    return {
      error: e.message,
      errorType: e.name
    };
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
    // Could trigger analytics event or update UI
  });
  
  sdk.on('frameRemoved', () => {
    console.log('App was removed from user collection');
    // Could trigger analytics event or update UI
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
    return null;
  }

  try {
    // Check if the SDK has the actions.signIn method
    if (sdk.actions && typeof sdk.actions.signIn === 'function') {
      // For Mini App environment, we can use the SDK's signIn method
      const authResult = await sdk.actions.signIn({ nonce });
      return authResult;
    } else {
      console.warn('signIn method not available in this SDK version');
      return null;
    }
  } catch (e) {
    console.error('Error authenticating in Mini App:', e);
    return null;
  }
};

/**
 * View a user's Farcaster profile
 * @param {number} fid - Farcaster ID of the user
 * @returns {Promise<void>}
 */
export const viewFarcasterProfile = async (fid) => {
  if (!isMiniAppEnvironment()) {
    // In web app, navigate to the profile page
    window.location.href = `/profile/${fid}`;
    return;
  }

  try {
    // Check if the SDK has the actions.viewProfile method
    if (sdk.actions && typeof sdk.actions.viewProfile === 'function') {
      // In Mini App, use the SDK to view the profile
      await sdk.actions.viewProfile({ fid });
    } else {
      console.warn('viewProfile method not available in this SDK version');
      window.location.href = `/profile/${fid}`;
    }
  } catch (e) {
    console.error('Error viewing profile in Mini App:', e);
    // Fallback to regular navigation
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
  if (!isMiniAppEnvironment()) {
    // In web app, maybe show a message that this feature is only available in Mini App
    console.log('Compose cast is only available in Mini App environment');
    return null;
  }

  try {
    // Check if the SDK has the actions.composeCast method
    if (sdk.actions && typeof sdk.actions.composeCast === 'function') {
      const result = await sdk.actions.composeCast({ text, embeds });
      return result;
    } else {
      console.warn('composeCast method not available in this SDK version');
      return null;
    }
  } catch (e) {
    console.error('Error composing cast in Mini App:', e);
    return null;
  }
};

/**
 * Prompts the user to add the Mini App to their collection in Farcaster
 * This function will show the user a dialog to add the app
 * @returns {Promise<boolean>} True if the app was added, false otherwise
 */
export const promptAddFrame = async () => {
  if (!isMiniAppEnvironment()) {
    // In web app, maybe show a message that this feature is only available in Mini App
    console.log('Add frame is only available in Mini App environment');
    return false;
  }

  try {
    // Check if the SDK has the actions.addFrame method
    if (sdk.actions && typeof sdk.actions.addFrame === 'function') {
      logDebug('Prompting user to add frame');
      await sdk.actions.addFrame();
      logDebug('User added frame successfully');
      return true;
    } else {
      console.warn('addFrame method not available in this SDK version');
      return false;
    }
  } catch (e) {
    if (e.name === 'RejectedByUser') {
      logDebug('User rejected adding the app');
    } else if (e.name === 'InvalidDomainManifestJson') {
      console.error('Invalid manifest.json:', e);
    } else {
      console.error('Error adding frame in Mini App:', e);
    }
    return false;
  }
}; 