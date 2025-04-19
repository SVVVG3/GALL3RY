import React, { useState, useEffect, Suspense, useRef, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ToastContainer } from 'react-toastify';

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

// IMPORTANT: Add a check for browser environment first
if (typeof window !== 'undefined') {
  // Make SDK globally accessible
  window.farcasterSdk = sdk;
  
  // Initialize only when document is ready
  const initSDK = () => {
    try {
      console.log("Initializing Farcaster SDK...");
      
      // Safely initialize SDK based on its actual structure
      if (sdk) {
        // Check if SDK has init method directly
        if (typeof sdk.init === 'function') {
          sdk.init();
          console.log("✅ SDK initialized with sdk.init()");
        } 
        // Check if SDK is already initialized property
        else if (typeof sdk.initialized !== 'undefined') {
          console.log("✅ SDK already initialized");
        }
        // Log error if no init method found
        else {
          console.warn("⚠️ SDK init method not found, using as-is");
        }
        
        // Expose SDK globally for components that might use window.sdk
        window.sdk = sdk;
        console.log("✅ SDK exposed globally");
      } else {
        console.warn("⚠️ SDK not available");
      }
    } catch (e) {
      console.error("❌ SDK init error:", e.message || String(e));
    }
  };

  // Initialize immediately if document is ready
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initSDK();
  } else {
    // Otherwise wait for DOMContentLoaded
    window.addEventListener('DOMContentLoaded', initSDK);
  }
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
class ErrorBoundary extends React.Component {
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

// Add a new function to handle splash screen dismissal
// This needs to be as simple as possible
const dismissSplashScreen = async () => {
  console.log('⚠️ Attempting to dismiss splash screen');
  try {
    if (!sdk) {
      console.warn('⚠️ SDK not available for dismissing splash screen');
      return false;
    }
    
    // Try different methods to dismiss splash screen
    
    // Method 1: Try sdk.actions.ready()
    if (sdk.actions && typeof sdk.actions.ready === 'function') {
      try {
        await sdk.actions.ready();
        console.log('✅ Called sdk.actions.ready() successfully');
        return true;
      } catch (e) {
        console.warn('⚠️ sdk.actions.ready() failed:', e);
      }
    }
    
    // Method 2: Try sdk.ready()
    if (typeof sdk.ready === 'function') {
      try {
        await sdk.ready();
        console.log('✅ Called sdk.ready() successfully');
        return true;
      } catch (e) {
        console.warn('⚠️ sdk.ready() failed:', e);
      }
    }
    
    // If we get here, none of the methods worked
    console.warn('⚠️ No suitable ready() method found in SDK');
    return false;
  } catch (e) {
    console.error('❌ Error trying to dismiss splash screen:', e);
    return false;
  }
};

// Try to dismiss splash screen as early as possible - before React even renders
if (typeof window !== 'undefined') {
  dismissSplashScreen().catch(e => console.error('Error in early splash screen dismissal:', e));
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
        
        if (context && context.user) {
          // Create a clean user data object with primitive values
          const userData = {
            fid: context.user.fid ? Number(context.user.fid) : null,
            username: context.user.username ? String(context.user.username) : null,
            displayName: context.user.displayName ? String(context.user.displayName) : 
                        (context.user.username ? String(context.user.username) : null),
            pfp: {
              url: context.user.pfpUrl ? String(context.user.pfpUrl) : null
            }
          };
          
          // Only return if we have at least fid and username
          if (userData.fid && userData.username) {
            console.log('Found valid user in context:', {
              fid: userData.fid,
              username: userData.username
            });
            return userData;
          }
        }
      } catch (error) {
        console.error('Error getting context:', error);
      }
    }
    
    // Fallback to direct context access if method failed
    if (sdk.context && sdk.context.user) {
      const userData = {
        fid: sdk.context.user.fid ? Number(sdk.context.user.fid) : null,
        username: sdk.context.user.username ? String(sdk.context.user.username) : null,
        displayName: sdk.context.user.displayName ? String(sdk.context.user.displayName) : 
                    (sdk.context.user.username ? String(sdk.context.user.username) : null),
        pfp: {
          url: sdk.context.user.pfpUrl ? String(sdk.context.user.pfpUrl) : null
        }
      };
      
      // Only return if we have at least fid and username
      if (userData.fid && userData.username) {
        console.log('Found valid user in sdk.context:', {
          fid: userData.fid,
          username: userData.username
        });
        return userData;
      }
    }
    
    console.log('No valid user info found in SDK context');
    return null;
  } catch (error) {
    console.error('Error in getUserInfoFromContext:', error);
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
                    const authEvent = new CustomEvent('miniAppAuthenticated', { 
                      detail: {
                        fid: userData.fid,
                        username: userData.username,
                        displayName: userData.displayName,
                        pfp: userData.pfp
                      }
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
              console.log('🔄 Calling ready() to dismiss splash screen');
              await dismissSplashScreen();
              splashDismissed = true;
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
            dismissSplashScreen().catch(e => console.error('Emergency splash screen dismissal failed:', e));
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
          dismissSplashScreen().catch(e => {});
        }
      }
    };
    
    initApp();

    // Initialize the Mini App SDK
    if (typeof window !== 'undefined') {
      // Make auth context available globally for components that need it
      window.authContextRef = authContextRef;
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
            {/* Include the MiniAppAuthHandler to handle automatic authentication in Mini App */}
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
