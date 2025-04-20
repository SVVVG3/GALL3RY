import React, { useState, useEffect, Suspense, useRef, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ToastContainer } from 'react-toastify';
import { ErrorBoundary } from 'react-error-boundary';

// Add a try-catch for styles import to prevent build failures
try {
  require('react-toastify/dist/ReactToastify.css');
} catch (e) {
  console.warn('Could not load ReactToastify.css', e);
}

import './App.css';
import './styles/app.css';
import './styles/folder.css';
import './styles/errors.css'; // Import our new error styles
// Import Farcaster Auth Kit styles
import '@farcaster/auth-kit/styles.css';
import { AuthKitProvider } from '@farcaster/auth-kit';

// Import the SDK directly but initialize only in browser
import { sdk } from '@farcaster/frame-sdk';

// Debug mode constant
const DEBUG_MODE = true;
const log = (message, data) => {
  if (DEBUG_MODE) {
    console.log(`🔍 [DEBUG] ${message}`, data || '');
  }
};

// Send diagnostic log to server
const sendDiagnosticLog = async (event, data = {}) => {
  if (!DEBUG_MODE) return;
  
  try {
    await fetch('/api/diagnostic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event,
        type: data.error ? 'error' : 'info',
        message: data.message || event,
        error: data.error,
        data: data.data || null,
        clientInfo: {
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
          sdkStatus: {
            defined: !!sdk,
            hasActions: sdk && !!sdk.actions,
            hasSignIn: sdk && sdk.actions && typeof sdk.actions.signIn === 'function',
            hasGetContext: sdk && typeof sdk.getContext === 'function',
            hasContext: sdk && !!sdk.context
          }
        }
      })
    });
  } catch (e) {
    console.warn('Error sending diagnostic log:', e);
  }
};

// Add a new function to handle splash screen dismissal
// This needs to be as simple as possible
const dismissSplashScreen = async () => {
  log('Attempting to dismiss splash screen');
  sendDiagnosticLog('SPLASH_SCREEN_DISMISS_ATTEMPT');
  
  try {
    if (!sdk) {
      console.warn('⚠️ SDK not available for dismissing splash screen');
      sendDiagnosticLog('SDK_NOT_AVAILABLE_FOR_SPLASH');
      return false;
    }
    
    // Try using sdk.actions.ready() method (current API according to docs)
    if (sdk.actions && typeof sdk.actions.ready === 'function') {
      log('Calling sdk.actions.ready()');
      await sdk.actions.ready();
      log('✅ Splash screen dismissed with actions.ready');
      sendDiagnosticLog('SPLASH_SCREEN_DISMISSED_WITH_READY');
      return true;
    }
    
    // Try using hideSplashScreen method (older API)
    if (typeof sdk.hideSplashScreen === 'function') {
      log('Calling sdk.hideSplashScreen()');
      await sdk.hideSplashScreen();
      log('✅ Splash screen dismissed with hideSplashScreen');
      sendDiagnosticLog('SPLASH_SCREEN_DISMISSED_WITH_HIDE');
      return true;
    }
    
    // Fallback to older SDK versions that might use dismissSplashScreen
    if (typeof sdk.dismissSplashScreen === 'function') {
      log('Calling sdk.dismissSplashScreen()');
      await sdk.dismissSplashScreen();
      log('✅ Splash screen dismissed with dismissSplashScreen');
      sendDiagnosticLog('SPLASH_SCREEN_DISMISSED_WITH_DISMISS');
      return true;
    }
    
    // Another fallback for possible API changes
    if (sdk.actions && typeof sdk.actions.hideSplashScreen === 'function') {
      log('Calling sdk.actions.hideSplashScreen()');
      await sdk.actions.hideSplashScreen();
      log('✅ Splash screen dismissed with actions.hideSplashScreen');
      sendDiagnosticLog('SPLASH_SCREEN_DISMISSED_WITH_ACTIONS_HIDE');
      return true;
    }
    
    // Last fallback if we can't find the method
    console.warn('⚠️ No splash screen dismissal method found on SDK');
    sendDiagnosticLog('NO_SPLASH_SCREEN_METHOD_FOUND');
    return false;
  } catch (e) {
    console.error('❌ Error dismissing splash screen:', e.message || String(e));
    sendDiagnosticLog('SPLASH_SCREEN_DISMISS_ERROR', { error: e.message });
    return false;
  }
};

// IMPORTANT: Add a check for browser environment first
if (typeof window !== 'undefined') {
  // Make SDK globally accessible
  window.farcasterSdk = sdk;
  
  log("Initializing Farcaster SDK...");
  sendDiagnosticLog('SDK_INIT_START');
  
  // Initialize SDK immediately
  try {
    // Check if SDK is available
    if (sdk) {
      // First, mark that we've assigned the sdk to window
      window.SDK_INSTALLED = true;
      window.sdk = sdk;
      
      // Check if it needs initialization
      if (typeof sdk.init === 'function' && !sdk.initialized) {
        log("Calling sdk.init() to initialize the SDK");
        sdk.init();
        log("✅ SDK initialized successfully");
        sendDiagnosticLog('SDK_INIT_SUCCESS');
      } else if (typeof sdk.initialized !== 'undefined') {
        log("✅ SDK already initialized");
        sendDiagnosticLog('SDK_ALREADY_INITIALIZED');
      } else {
        log("⚠️ SDK init method not found, using as-is");
        sendDiagnosticLog('SDK_NO_INIT_METHOD');
      }
      
      // Log SDK status for debugging
      const sdkStatus = {
        isDefined: !!sdk,
        hasActionsProperty: sdk && !!sdk.actions,
        hasSignInMethod: sdk && sdk.actions && typeof sdk.actions.signIn === 'function',
        hasGetContextMethod: sdk && typeof sdk.getContext === 'function',
        hasContext: sdk && !!sdk.context,
        initialized: sdk.initialized
      };
      
      log("SDK Status:", sdkStatus);
      sendDiagnosticLog('SDK_STATUS', { data: sdkStatus });
      
      // Try to extract user info immediately if available
      const checkForUserInfo = async () => {
        try {
          // First try to get context through the method
          if (typeof sdk.getContext === 'function') {
            log("Attempting to get user context via sdk.getContext()");
            const context = await sdk.getContext();
            
            if (context && context.user && context.user.fid) {
              log('Found authenticated user in SDK context with FID:', context.user.fid);
              sendDiagnosticLog('USER_FOUND_IN_CONTEXT', { 
                message: `User found in context with FID: ${context.user.fid}`,
                data: { fid: context.user.fid, username: context.user.username }
              });
              
              // Store user info in sessionStorage (preferred over localStorage for Mini Apps)
              try {
                const userData = {
                  fid: context.user.fid,
                  username: context.user.username || `user${context.user.fid}`,
                  displayName: context.user.displayName || context.user.username || `User ${context.user.fid}`,
                  pfp: context.user.pfpUrl || null
                };
                
                sessionStorage.setItem('miniAppUserInfo', JSON.stringify(userData));
                
                // Dispatch event for components to react to authentication
                try {
                  const eventData = {
                    fid: typeof userData.fid === 'function' ? null : userData.fid,
                    username: typeof userData.username === 'function' ? null : String(userData.username || ''),
                    displayName: typeof userData.displayName === 'function' ? null : String(userData.displayName || ''),
                    pfp: typeof userData.pfp === 'function' ? null : userData.pfp
                  };
                  const authEvent = new CustomEvent('miniAppAuthenticated', { 
                    detail: eventData
                  });
                  window.dispatchEvent(authEvent);
                } catch (eventError) {
                  console.error('Failed to dispatch auth event:', eventError.message || 'Unknown error');
                }
              } catch (storageError) {
                console.warn('Failed to store user info:', storageError);
                sendDiagnosticLog('STORAGE_ERROR', { error: storageError.message });
              }
            } else {
              log('No authenticated user found in SDK context');
              sendDiagnosticLog('NO_USER_IN_CONTEXT');
              
              // Try the context property as fallback
              if (sdk.context && sdk.context.user && sdk.context.user.fid) {
                log('Found user in sdk.context property');
                sendDiagnosticLog('USER_FOUND_IN_CONTEXT_PROPERTY');
                
                // Process user data from context property
                const userData = {
                  fid: sdk.context.user.fid,
                  username: sdk.context.user.username || `user${sdk.context.user.fid}`,
                  displayName: sdk.context.user.displayName || sdk.context.user.username || `User ${sdk.context.user.fid}`,
                  pfp: sdk.context.user.pfpUrl || null
                };
                
                sessionStorage.setItem('miniAppUserInfo', JSON.stringify(userData));
                
                // Dispatch event for components to react to authentication
                try {
                  const eventData = {
                    fid: typeof userData.fid === 'function' ? null : userData.fid,
                    username: typeof userData.username === 'function' ? null : String(userData.username || ''),
                    displayName: typeof userData.displayName === 'function' ? null : String(userData.displayName || ''),
                    pfp: typeof userData.pfp === 'function' ? null : userData.pfp
                  };
                  const authEvent = new CustomEvent('miniAppAuthenticated', { 
                    detail: eventData
                  });
                  window.dispatchEvent(authEvent);
                } catch (eventError) {
                  console.error('Failed to dispatch auth event:', eventError.message || 'Unknown error');
                }
              }
            }
          } else if (sdk.context && sdk.context.user && sdk.context.user.fid) {
            // Fallback to context property if getContext method is not available
            log('Method getContext not available, using context property');
            sendDiagnosticLog('USING_CONTEXT_PROPERTY');
            
            const userData = {
              fid: sdk.context.user.fid,
              username: sdk.context.user.username || `user${sdk.context.user.fid}`,
              displayName: sdk.context.user.displayName || sdk.context.user.username || `User ${sdk.context.user.fid}`,
              pfp: sdk.context.user.pfpUrl || null
            };
            
            sessionStorage.setItem('miniAppUserInfo', JSON.stringify(userData));
            
            // Dispatch event for components to react to authentication
            try {
              const eventData = {
                fid: typeof userData.fid === 'function' ? null : userData.fid,
                username: typeof userData.username === 'function' ? null : String(userData.username || ''),
                displayName: typeof userData.displayName === 'function' ? null : String(userData.displayName || ''),
                pfp: typeof userData.pfp === 'function' ? null : userData.pfp
              };
              const authEvent = new CustomEvent('miniAppAuthenticated', { 
                detail: eventData
              });
              window.dispatchEvent(authEvent);
            } catch (eventError) {
              console.error('Failed to dispatch auth event:', eventError.message || 'Unknown error');
            }
          }
        } catch (e) {
          console.warn('Error checking for user info in SDK context:', e);
          sendDiagnosticLog('CONTEXT_CHECK_ERROR', { error: e.message });
        } finally {
          // Always try to dismiss splash screen after context check
          dismissSplashScreen();
        }
      };
      
      // Run the check after a short delay to ensure SDK is fully initialized
      setTimeout(checkForUserInfo, 300);
      
      // Set a safety timeout to dismiss splash screen even if context check fails
      setTimeout(dismissSplashScreen, 2000);
    } else {
      log("⚠️ SDK not available");
      sendDiagnosticLog('SDK_NOT_AVAILABLE');
      
      // Still try to dismiss splash screen after a delay
      setTimeout(dismissSplashScreen, 1000);
    }
  } catch (e) {
    console.error("❌ SDK init error:", e.message || String(e));
    sendDiagnosticLog('SDK_INIT_ERROR', { error: e.message });
    
    // Emergency dismiss splash screen attempt
    setTimeout(dismissSplashScreen, 1500);
  }
}

// Try to dismiss splash screen as early as possible - before React even renders
if (typeof window !== 'undefined') {
  // Small delay to ensure SDK is initialized first
  setTimeout(() => {
    if (window.sdk && window.sdk.actions && typeof window.sdk.actions.ready === 'function') {
      console.log('Early initialization: Directly calling sdk.actions.ready()');
      window.sdk.actions.ready().catch(e => console.error('Error in early direct ready dismissal:', e));
    } else {
      dismissSplashScreen().catch(e => console.error('Error in early splash screen dismissal:', e));
    }
  }, 100);
}

// Import Mini App utilities
import { initializeMiniApp, setupMiniAppEventListeners, isMiniAppEnvironment, isValidAndNonEmptyUserObject } from './utils/miniAppUtils';

// Import all components directly to avoid lazy loading issues
import { AuthProvider } from './contexts/AuthContext';
import { WalletProvider } from './contexts/WalletContext';
import { NFTProvider } from './contexts/NFTContext';
import SignInButton from './components/SignInButton';
import UserProfilePage from './components/UserProfilePage';
import HomePage from './pages/HomePage'; // Import HomePage from the correct location
import safeStorage from './utils/storage';

// Import our new components
import NFTGallery from './components/NFTGallery';
import SimpleGalleryPage from './pages/SimpleGalleryPage';
import AuthStatusIndicator from './components/AuthStatusIndicator';
import MiniAppAuthHandler from './components/MiniAppAuthHandler';
import DiagnosticPanel from './components/DiagnosticPanel';
import { DiagnosticLogger } from './utils/diagnosticUtils';

// Loading component for suspense fallback
const LoadingScreen = () => (
  <div className="loading-container">
    <div className="loading-spinner"></div>
    <p>Loading GALL3RY...</p>
  </div>
);

// Error component
const ErrorDisplay = ({ error, onRetry }) => (
  <div className="error-container">
    <h1>Error</h1>
    <p>{error?.message || 'An unknown error occurred'}</p>
    <button onClick={onRetry} className="retry-button">Try Again</button>
  </div>
);

// Error boundary component
class CustomErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Component error:", error);
    console.error("Component stack:", errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h3>Component Error</h3>
          <p>We encountered an error loading this component.</p>
          <details>
            <summary>Error details</summary>
            <pre className="error-details">
              {this.state.error && this.state.error.toString()}
            </pre>
          </details>
          <button 
            onClick={() => this.setState({ hasError: false, error: null })} 
            className="retry-button"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Helper function to safely get user info from SDK context
const getUserInfoFromContext = async () => {
  try {
    // First check if SDK is available and initialized
    if (!sdk) {
      console.log('SDK not available for context check');
      return null;
    }
    
    console.log('Checking for user info in SDK context');
    
    // Try to get context using getContext method
    if (typeof sdk.getContext === 'function') {
      try {
        const context = await sdk.getContext();
        console.log('Context retrieved:', context ? 'yes' : 'no');
        
        if (context && context.user && context.user.fid) {
          // Create a clean user data object with primitive values
          const userData = {
            fid: typeof context.user.fid === 'function' ? null : Number(context.user.fid),
            username: typeof context.user.username === 'function' ? null : String(context.user.username || ''),
            displayName: typeof context.user.displayName === 'function' ? null : 
                        String(context.user.displayName || context.user.username || ''),
            pfp: typeof context.user.pfpUrl === 'function' ? null : 
                 (context.user.pfpUrl ? String(context.user.pfpUrl) : null)
          };
          
          console.log('Extracted user data:', JSON.stringify(userData));
          
          // Store in localStorage for persistence
          try {
            localStorage.setItem('farcaster_user', JSON.stringify(userData));
            localStorage.setItem('miniAppUserInfo', JSON.stringify(userData));
            console.log('User info stored in localStorage');
          } catch (e) {
            console.warn('Failed to store user info in localStorage:', e);
          }
          
          // Dispatch event for other components - ensure all values are primitives
          const eventData = {
            fid: userData.fid,
            username: userData.username,
            displayName: userData.displayName,
            pfp: userData.pfp
          };
          
          const authEvent = new CustomEvent('miniAppAuthenticated', { detail: eventData });
          window.dispatchEvent(authEvent);
          
          return userData;
        }
      } catch (e) {
        console.warn('Error getting context:', e);
      }
    }
    
    // Fallback to sdk.context property
    if (sdk.context && sdk.context.user && sdk.context.user.fid) {
      console.log('User info found in sdk.context property');
      
      // Create user data from context property with strict primitive conversion
      const userData = {
        fid: typeof sdk.context.user.fid === 'function' ? null : Number(sdk.context.user.fid || 0),
        username: typeof sdk.context.user.username === 'function' ? null : String(sdk.context.user.username || ''),
        displayName: typeof sdk.context.user.displayName === 'function' ? null : 
                   String(sdk.context.user.displayName || sdk.context.user.username || ''),
        pfp: typeof sdk.context.user.pfpUrl === 'function' ? null : 
             (sdk.context.user.pfpUrl ? String(sdk.context.user.pfpUrl) : null)
      };
      
      console.log('Extracted user data from context property:', JSON.stringify(userData));
      
      // Store in localStorage
      try {
        localStorage.setItem('farcaster_user', JSON.stringify(userData));
        localStorage.setItem('miniAppUserInfo', JSON.stringify(userData));
        console.log('User info stored in localStorage');
      } catch (e) {
        console.warn('Failed to store user info in localStorage:', e);
      }
      
      // Dispatch event with primitive values only
      const eventData = {
        fid: userData.fid,
        username: userData.username, 
        displayName: userData.displayName,
        pfp: userData.pfp
      };
      
      const authEvent = new CustomEvent('miniAppAuthenticated', { detail: eventData });
      window.dispatchEvent(authEvent);
      
      return userData;
    }
    
    console.log('No user info found in SDK context');
    return null;
  } catch (e) {
    console.error('Error getting user info from context:', e);
    return null;
  }
};

// Main App function with simplified provider hierarchy
function AppContent() {
  const [loading, setLoading] = useState(true);
  const [appError, setAppError] = useState(null);
  const [miniAppContext, setMiniAppContext] = useState(null);
  const [isMiniApp, setIsMiniApp] = useState(false);
  const authContextRef = useRef(null);
  const location = useLocation();
  const [showDiagnosticPanel, setShowDiagnosticPanel] = useState(false);
  
  // Initialize the app on mount
  useEffect(() => {
    const initApp = async () => {
      try {
        // Check if we're in a Mini App environment
        const isInMiniApp = isMiniAppEnvironment();
        setIsMiniApp(isInMiniApp);
        
        // If we're in a Mini App environment, initialize it early 
        if (isInMiniApp) {
          console.log('📱 Running in Mini App environment');
          setIsMiniApp(true);
          
          try {
            // SAFE: Log only boolean values about availability
            console.log('🔍 Checking SDK status:', { 
              sdkDefined: !!sdk, 
              actionsAvailable: sdk && sdk.actions ? true : false,
              getContextAvailable: sdk && typeof sdk.getContext === 'function' ? true : false,
              readyAvailable: sdk && typeof sdk.ready === 'function' ? true : false
            });
            
            // STEP 1: Try to get context directly at startup
            let context = null;
            try {
              console.log('🔍 Checking for user context');
              // Don't store the raw context - extract only what we need immediately
              const rawContext = await sdk.getContext();
              // Only check if we have valid user data, don't log the raw context
              if (rawContext && rawContext.user && rawContext.user.fid) {
                console.log('✅ Found authenticated user in context with fid:', 
                  rawContext.user.fid ? Number(rawContext.user.fid) : 'none');
                
                // Store only safe insets data in our state
                if (rawContext.safeAreaInsets) {
                  setMiniAppContext({
                    safeAreaInsets: {
                      top: Number(rawContext.safeAreaInsets.top || 0),
                      right: Number(rawContext.safeAreaInsets.right || 0),
                      bottom: Number(rawContext.safeAreaInsets.bottom || 0),
                      left: Number(rawContext.safeAreaInsets.left || 0)
                    },
                    hideHeader: !!rawContext.hideHeader
                  });
                }
                
                // Extract user data safely using our helper function
                const userData = await getUserInfoFromContext();
                
                if (userData && userData.fid) {
                  console.log('🔑 Found valid user data with username:', userData.username || 'unknown');
                  
                  // Store the user info in localStorage for persistence
                  try {
                    localStorage.setItem('farcaster_user', JSON.stringify(userData));
                    localStorage.setItem('miniAppUserInfo', JSON.stringify(userData));
                  } catch (storageError) {
                    console.error('Failed to store user data:', storageError.message || 'Unknown error');
                  }
                  
                  // Dispatch event for components to react to authentication
                  try {
                    const eventData = {
                      fid: typeof userData.fid === 'function' ? null : userData.fid,
                      username: typeof userData.username === 'function' ? null : String(userData.username || ''),
                      displayName: typeof userData.displayName === 'function' ? null : String(userData.displayName || ''),
                      pfp: typeof userData.pfp === 'function' ? null : userData.pfp
                    };
                    const authEvent = new CustomEvent('miniAppAuthenticated', { 
                      detail: eventData
                    });
                    window.dispatchEvent(authEvent);
                  } catch (eventError) {
                    console.error('Failed to dispatch auth event:', eventError.message || 'Unknown error');
                  }
                } else {
                  console.log('⚠️ User data extraction failed');
                }
              } else {
                console.log('⚠️ No authenticated user found in context');
              }
            } catch (contextError) {
              console.warn('Could not get context:', contextError.message || 'Unknown error');
            }
            
            // STEP 2: Dismiss splash screen regardless of auth status
            let splashDismissed = false;
            try {
              console.log('Calling ready() to dismiss splash screen');
              // Try to use sdk.actions.ready() directly first (recommended method)
              if (sdk && sdk.actions && typeof sdk.actions.ready === 'function') {
                console.log('Directly calling sdk.actions.ready()');
                await sdk.actions.ready();
                splashDismissed = true;
                console.log('✅ Splash screen dismissed with sdk.actions.ready()');
              } else {
                // Fall back to our helper function that tries various methods
                await dismissSplashScreen();
                splashDismissed = true;
              }
            } catch (readyError) {
              console.warn('Could not dismiss splash screen:', readyError);
            }
            
            // STEP 3: Set up event listeners for Mini App interactions
            try {
              setupMiniAppEventListeners();
            } catch (eventError) {
              console.warn('Error setting up event listeners:', eventError);
            }
            
          } catch (miniAppError) {
            console.error('Error initializing Mini App:', miniAppError);
            
            // Try to dismiss splash screen as a last resort
            try {
              await dismissSplashScreen();
            } catch (e) {
              console.error('Final attempt to dismiss splash screen failed:', e);
            }
          }
        } else {
          console.log('Running in standard web environment');
        }
        
        // Force the splash screen to be dismissed after 3 seconds as an emergency fallback
        setTimeout(() => {
          if (isInMiniApp) {
            console.log('🚨 Emergency splash screen timeout - forcing dismissal');
            if (sdk && sdk.actions && typeof sdk.actions.ready === 'function') {
              console.log('Emergency: Directly calling sdk.actions.ready()');
              sdk.actions.ready().catch(e => console.error('Emergency direct ready() dismissal failed:', e));
            } else {
              dismissSplashScreen().catch(e => console.error('Emergency splash screen dismissal failed:', e));
            }
          }
          setLoading(false);
        }, 3000);
        
        // Complete loading and show UI
        setLoading(false);
      } catch (error) {
        console.error('Error during app initialization:', error);
        setAppError(error);
        setLoading(false);
        
        // Even in error state, try to dismiss splash screen
        if (isMiniAppEnvironment()) {
          if (sdk && sdk.actions && typeof sdk.actions.ready === 'function') {
            sdk.actions.ready().catch(e => {});
          } else {
            dismissSplashScreen().catch(e => {});
          }
        }
      }
    };
    
    initApp();

    // Initialize the Mini App SDK
    if (typeof window !== 'undefined') {
      // Make auth context available globally for components that need it
      window.authContextRef = authContextRef;
    }

    // Log SDK initialization for diagnostics
    if (typeof window !== 'undefined') {
      DiagnosticLogger.info('Initializing App', { isBrowser: true });
      
      if (window.sdk) {
        DiagnosticLogger.info('SDK found in window', { 
          sdkVersion: window.sdk.version, 
          hasMethods: !!window.sdk.getContext
        });
      } else {
        DiagnosticLogger.warn('SDK not found in window');
      }
    }
  }, []);
  
  // Listen for authentication events
  useEffect(() => {
    const handleMiniAppAuth = (event) => {
      console.log('App received miniAppAuthenticated event with data:', event.detail);
      if (event.detail && event.detail.fid) {
        setMiniAppContext(event.detail);
      }
    };
    
    window.addEventListener('miniAppAuthenticated', handleMiniAppAuth);
    
    return () => {
      window.removeEventListener('miniAppAuthenticated', handleMiniAppAuth);
    };
  }, []);
  
  // Add keyboard shortcut for diagnostic panel
  useEffect(() => {
    // Listen for Ctrl+Shift+D to toggle diagnostic panel
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'd') {
        e.preventDefault();
        setShowDiagnosticPanel(prev => !prev);
        // Dispatch event for external listeners
        window.dispatchEvent(new Event('toggle-diagnostic-panel'));
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    // Add diagnostic opening on triple click on footer
    let clickCount = 0;
    let clickTimer;
    
    const handleFooterClick = () => {
      clickCount++;
      
      if (clickCount === 1) {
        clickTimer = setTimeout(() => {
          clickCount = 0;
        }, 800);
      }
      
      if (clickCount === 3) {
        clearTimeout(clickTimer);
        clickCount = 0;
        setShowDiagnosticPanel(prev => !prev);
        window.dispatchEvent(new Event('toggle-diagnostic-panel'));
      }
    };
    
    const footer = document.querySelector('footer');
    if (footer) {
      footer.addEventListener('click', handleFooterClick);
    }
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (footer) {
        footer.removeEventListener('click', handleFooterClick);
      }
      clearTimeout(clickTimer);
    };
  }, []);
  
  // Handle any critical app errors
  if (appError) {
    return (
      <ErrorDisplay 
        error={appError} 
        onRetry={() => setAppError(null)} 
      />
    );
  }
  
  // Loading state
  if (loading) {
    return <LoadingScreen />;
  }
  
  // Adjust styles for Mini App environment if needed
  const appStyles = isMiniApp 
    ? { 
        maxWidth: '100%', 
        padding: miniAppContext?.safeAreaInsets 
          ? `${miniAppContext.safeAreaInsets.top}px ${miniAppContext.safeAreaInsets.right}px ${miniAppContext.safeAreaInsets.bottom}px ${miniAppContext.safeAreaInsets.left}px` 
          : '0',
        height: '100vh',
        overflowY: 'auto'
      } 
    : {};
  
  // Add miniApp class name for CSS targeting
  const appClassName = isMiniApp ? 'app mini-app' : 'app';
  
  // Return the app with a proper provider hierarchy
  return (
    <ErrorBoundary
      onError={error => console.error('App error boundary caught:', error)}
      FallbackComponent={({ error, resetErrorBoundary }) => 
        <ErrorDisplay error={error} onRetry={resetErrorBoundary} />
      }
    >
      <AuthKitProvider config={{
        domain: window.location.hostname || 'gall3ry.vercel.app',
        siweUri: `${window.location.origin || 'https://gall3ry.vercel.app'}/api/login`,
        rpcUrl: 'https://mainnet.optimism.io',
        walletConnectProjectId: process.env.REACT_APP_WALLET_CONNECT_ID || 'DEFAULT',
        transport: 'deferredInjected' // Use deferred to prevent conflicts with other providers
      }}>
        <AuthProvider ref={authContextRef}>
          <WalletProvider>
            {/* Conditionally render MiniAppAuthHandler when in a Mini App environment */}
            {isMiniApp && <MiniAppAuthHandler />}
            
            <div className={appClassName} style={appStyles}>
              {/* Hide header in Mini App if needed or adjust its appearance */}
              {(!isMiniApp || (isMiniApp && !miniAppContext?.hideHeader)) && (
                <header className="app-header">
                  <div className="app-header-container">
                    <Link to="/" className="logo-link">GALL3RY</Link>
                    <div className="auth-container">
                      <AuthStatusIndicator />
                      <SignInButton />
                    </div>
                  </div>
                </header>
              )}
              
              <main className="app-content">
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/simple" element={<SimpleGalleryPage />} />
                  <Route path="/me" element={
                    <NFTProvider>
                      <UserProfilePage />
                    </NFTProvider>
                  } />
                  <Route path="/user/:username" element={
                    <NFTProvider>
                      <UserProfilePage />
                    </NFTProvider>
                  } />
                </Routes>
              </main>
              
              {/* Conditionally show footer based on environment */}
              {!isMiniApp && (
                <footer className="app-footer">
                  <span>vibe coded with 💜 by</span><a 
                    href="https://warpcast.com/svvvg3.eth" 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="footer-link"
                  >
                    @svvvg3.eth
                  </a>
                </footer>
              )}
            </div>
          </WalletProvider>
        </AuthProvider>
      </AuthKitProvider>
      
      {/* Add Diagnostic Panel */}
      {showDiagnosticPanel && <DiagnosticPanel />}
    </ErrorBoundary>
  );
}

// Main wrapper component that provides the router
function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
