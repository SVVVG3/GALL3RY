import React, { useState, useEffect, Suspense, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './App.css';
import './styles/app.css';
import './styles/folder.css';
import './styles/errors.css'; // Import our new error styles
// Import Farcaster Auth Kit styles
import '@farcaster/auth-kit/styles.css';
import { AuthKitProvider } from '@farcaster/auth-kit';

// Import the SDK directly and initialize IMMEDIATELY at the top level
import { sdk } from '@farcaster/frame-sdk';

// Initialize the SDK as early as possible - before ANY other code
try {
  // Following the official docs, initialize immediately
  sdk.init();
  console.log("SDK initialized successfully");
  
  // SAFE: Only log primitive boolean values
  console.log("SDK state after init:", {
    initialized: true,
    hasContext: sdk && !!sdk.context,
    hasUser: sdk && sdk.context && sdk.context.user ? true : false
  });
  
  // Immediately try to dismiss splash screen as recommended in docs
  if (sdk.actions && typeof sdk.actions.ready === 'function') {
    sdk.actions.ready().catch(e => {
      console.warn("Early splash screen dismissal failed:", e.message || "Unknown error");
    });
  }
} catch (error) {
  console.error("Failed to initialize SDK:", error.message || "Unknown error");
}

// Import Mini App utilities
import { initializeMiniApp, setupMiniAppEventListeners, isMiniAppEnvironment } from './utils/miniAppUtils';

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
    // Make sure SDK is initialized
    if (sdk && !sdk.initialized && typeof sdk.init === 'function') {
      sdk.init();
    }
    
    // Call ready() to dismiss splash screen
    if (sdk && sdk.actions && typeof sdk.actions.ready === 'function') {
      await sdk.actions.ready();
      console.log('✅ Called ready() successfully');
      return true;
    } else {
      console.warn('⚠️ sdk.actions.ready is not available');
      return false;
    }
  } catch (e) {
    console.error('❌ Error calling ready():', e);
    return false;
  }
};

// Try to dismiss splash screen as early as possible - before React even renders
if (typeof window !== 'undefined') {
  dismissSplashScreen().catch(e => console.error('Error in early splash screen dismissal:', e));
}

// Simple function to get user context
const getWarpcastContext = async () => {
  try {
    if (sdk && typeof sdk.getContext === 'function') {
      const context = await sdk.getContext();
      console.log('Early context check:', context);
      return context;
    }
  } catch (e) {
    console.warn('Error getting early context:', e);
  }
  return null;
};

// Helper function to get user info from SDK context
const getUserInfoFromContext = () => {
  if (!sdk || !sdk.context || !sdk.context.user) {
    return null;
  }
  
  try {
    // SAFE: Create a clean object with ONLY primitive values
    // NEVER return or log the original SDK objects directly
    const userData = {
      fid: sdk.context.user.fid ? Number(sdk.context.user.fid) : null,
      username: sdk.context.user.username ? String(sdk.context.user.username) : null,
      displayName: sdk.context.user.displayName ? String(sdk.context.user.displayName) : null,
      pfp: { url: sdk.context.user.pfpUrl ? String(sdk.context.user.pfpUrl) : null }
    };
    
    // Add fallbacks for missing values
    if (userData.fid && !userData.username) {
      userData.username = `user${userData.fid}`;
    }
    if (userData.fid && !userData.displayName) {
      userData.displayName = userData.username || `User ${userData.fid}`;
    }
    
    return userData;
  } catch (error) {
    console.error("Error extracting user info from context:", error.message || "Unknown error");
    return null;
  }
};

// Main App function with simplified provider hierarchy
function App() {
  const [loading, setLoading] = useState(true);
  const [appError, setAppError] = useState(null);
  const [miniAppContext, setMiniAppContext] = useState(null);
  const [isMiniApp, setIsMiniApp] = useState(false);
  const authContextRef = useRef(null);
  
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
                const userData = getUserInfoFromContext();
                
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
            <Router>
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
            </Router>
          </WalletProvider>
        </AuthProvider>
      </AuthKitProvider>
    </ErrorBoundary>
  );
}

export default App;
