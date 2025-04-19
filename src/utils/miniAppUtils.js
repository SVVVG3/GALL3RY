import { sdk } from '@farcaster/frame-sdk';

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
    return sdk.isFrame();
  } catch (e) {
    console.warn('Error checking Mini App environment:', e);
    return false;
  }
};

/**
 * Initialize the Mini App SDK if we're in a Mini App environment
 * Call this early in the app initialization
 * @returns {Promise<void>}
 */
export const initializeMiniApp = async () => {
  if (!isMiniAppEnvironment()) {
    return;
  }

  try {
    // Initialize the SDK and handle app ready state
    await sdk.ready();
    
    console.log('Mini App initialized successfully');
    
    // Get client context if available
    const context = await sdk.getContext();
    console.log('Mini App context:', context);
    
    return context;
  } catch (e) {
    console.error('Error initializing Mini App:', e);
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
    // For Mini App environment, we can use the SDK's signIn method
    // This will return a signature and message that can be verified on the server
    const authResult = await sdk.actions.signIn({ nonce });
    return authResult;
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
    // In Mini App, use the SDK to view the profile
    await sdk.actions.viewProfile({ fid });
  } catch (e) {
    console.error('Error viewing profile in Mini App:', e);
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
    const result = await sdk.actions.composeCast({ text, embeds });
    return result;
  } catch (e) {
    console.error('Error composing cast in Mini App:', e);
    return null;
  }
}; 