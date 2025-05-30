import React, { useState, useEffect, Suspense, useRef, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ToastContainer } from 'react-toastify';
import { ErrorBoundary } from 'react-error-boundary';
// Import Privy Provider
import { PrivyProvider, usePrivy } from '@privy-io/react-auth';
// Import Redux Provider
import { Provider as ReduxProvider } from 'react-redux';
import store from './redux/store';

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

// Import the SDK directly but initialize only in browser
import { sdk } from '@farcaster/frame-sdk';
import { isMiniAppEnvironment, dismissSplashScreen, promptAddFrame, isAppAdded } from './utils/miniAppUtils';
import { AuthProvider } from './contexts/AuthContext';
import { WalletProvider } from './contexts/WalletContext';
import { NFTProvider } from './contexts/NFTContext';
import PrivyFarcasterAuth from './components/PrivyFarcasterAuth';
import Navigation from './components/Navigation';
import AddAppPrompt from './components/AddAppPrompt';
import FarcasterDataLoader from './components/FarcasterDataLoader';
import DebugImageLoader from './components/DebugImageLoader'; // Import our debug component

// Import page components
const HomePage = lazy(() => import('./pages/HomePage'));
const ExplorePage = lazy(() => import('./pages/ExplorePage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const NFTDetailPage = lazy(() => import('./pages/NFTDetailPage'));
const NotFound = lazy(() => import('./pages/NotFound'));

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

// IMPORTANT: Add a check for browser environment first
if (typeof window !== 'undefined') {
  // Make SDK globally accessible for debugging
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
    }
  } catch (e) {
    console.error('❌ Error initializing SDK:', e);
    sendDiagnosticLog('SDK_INIT_ERROR', { error: e.message || String(e) });
  }
}

// Loading component for suspense fallback
const LoadingScreen = () => (
  <div className="loading-screen">
    <div className="spinner"></div>
    <p>Loading GALL3RY...</p>
  </div>
);

// Error display component
const ErrorDisplay = ({ error, onRetry }) => (
  <div className="error-container">
    <h1>Something went wrong</h1>
    <p className="error-message">{error?.message || String(error) || 'Unknown error'}</p>
    <button className="retry-button" onClick={onRetry}>Try Again</button>
  </div>
);

// Custom error boundary component
class CustomErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error, errorInfo) {
    console.error("Application error:", error);
    console.error("Component stack:", errorInfo.componentStack);
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <ErrorDisplay 
          error={this.state.error}
          onRetry={() => {
            this.setState({ hasError: false, error: null });
            window.location.reload();
          }}
        />
      );
    }
    
    return this.props.children;
  }
}

// Privy App ID from environment variable
const PRIVY_APP_ID = process.env.REACT_APP_PRIVY_APP_ID;

// Main app content with routes
function AppContent() {
  const { ready, authenticated, user } = usePrivy();
  const [isInMiniApp, setIsInMiniApp] = useState(false);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const hasPromptedAddApp = useRef(false);
  const appInitialized = useRef(false);
  
  // Check if we're in a Mini App environment
  useEffect(() => {
    const checkEnvironment = async () => {
      try {
        const isMA = await isMiniAppEnvironment();
        setIsInMiniApp(isMA);
        setLoading(false);
      } catch (error) {
        console.error('Error checking environment:', error);
        setLoading(false);
      }
    };
    
    checkEnvironment();
  }, []);
  
  // Set up event listeners for Mini App events
  useEffect(() => {
    if (isInMiniApp && sdk) {
      try {
        // Set up event listeners for app added/removed events
        const onFrameAdded = () => {
          console.log("Event received: App was added by user");
          hasPromptedAddApp.current = true; // Mark as prompted so we don't show it again
        };
        
        const onFrameRemoved = () => {
          console.log("Event received: App was removed by user");
          hasPromptedAddApp.current = false; // Reset so we could prompt again if appropriate
        };
        
        // Register the event listeners if sdk.on is available
        if (typeof sdk.on === 'function') {
          sdk.on('frameAdded', onFrameAdded);
          sdk.on('frameRemoved', onFrameRemoved);
          
          console.log("Registered Mini App event listeners");
        }
        
        // Cleanup function to remove event listeners
        return () => {
          if (typeof sdk.removeListener === 'function') {
            sdk.removeListener('frameAdded', onFrameAdded);
            sdk.removeListener('frameRemoved', onFrameRemoved);
            console.log("Removed Mini App event listeners");
          }
        };
      } catch (error) {
        console.error("Error setting up Mini App event listeners:", error);
      }
    }
  }, [isInMiniApp]);
  
  // Handle successful Privy authentication and splash screen dismissal
  useEffect(() => {
    if (isInMiniApp) {
      console.log(`Attempting to dismiss splash screen in mini app environment`);
      
      // Try to dismiss splash screen regardless of auth state
      const attemptDismissSplash = async () => {
        try {
          const result = await dismissSplashScreen();
          console.log("Splash screen dismiss attempt result:", result);
          
          // Set app as initialized after splash screen is dismissed
          if (result) {
            appInitialized.current = true;
            console.log("App initialized, ready to prompt for add if needed");
          }
        } catch (err) {
          console.error('Error dismissing splash screen:', err);
        }
      };
      
      // Try immediately
      attemptDismissSplash();
      
      // Also try after a timeout to ensure it's attempted even if auth is slow
      const timeoutId = setTimeout(() => {
        console.log("Trying splash screen dismissal after timeout");
        attemptDismissSplash();
      }, 1000);
      
      return () => clearTimeout(timeoutId);
    }
  }, [isInMiniApp]);
  
  // Also try after authentication change
  useEffect(() => {
    if (authenticated && user?.farcaster?.fid && isInMiniApp) {
      console.log(`User authenticated with Farcaster: FID ${user.farcaster.fid}, dismissing splash screen`);
      dismissSplashScreen().catch(err => {
        console.error('Error dismissing splash screen after auth:', err);
      });
    }
  }, [authenticated, user, isInMiniApp]);
  
  // DEDICATED EFFECT FOR APP ADD PROMPT: This runs separately from splash screen
  // dismissal to ensure proper timing and avoid race conditions
  useEffect(() => {
    // Only run if we're in a mini app and not loading
    if (!isInMiniApp || loading) return;
    
    // Don't run if we've already prompted
    if (hasPromptedAddApp.current) {
      console.log("Already prompted to add app, skipping");
      return;
    }
    
    // Wait for app to be fully initialized before showing prompt
    const promptForAppAdd = async () => {
      // Use a timeout to ensure the app UI is fully visible and stable
      console.log("Scheduling add app prompt with delay");
      
      setTimeout(async () => {
        try {
          console.log("Checking if app is already added...");
          
          // Set prompted flag early to prevent multiple attempts if this crashes
          hasPromptedAddApp.current = true;
          
          // Check if app is already added using our helper function - with error handling
          let appAlreadyAdded = false;
          try {
            appAlreadyAdded = await isAppAdded();
          } catch (checkError) {
            console.error("Error checking if app is added:", checkError);
            // Continue anyway since we want to show the prompt
          }
          
          if (!appAlreadyAdded) {
            console.log("App not added, showing prompt to add app");
            
            // Function to safely call the SDK
            const safeSDKCall = async () => {
              // Simple wrapper that prevents errors from propagating
              try {
                if (sdk) {
                  // Check if actions exists
                  if (sdk.actions) {
                    // Check if addFrame exists and is a function
                    if (typeof sdk.actions.addFrame === 'function') {
                      console.log("Calling sdk.actions.addFrame()");
                      await sdk.actions.addFrame();
                      console.log("addFrame call completed");
                      return true;
                    } else {
                      console.log("sdk.actions.addFrame is not a function");
                    }
                  } else {
                    console.log("sdk.actions is undefined");
                  }
                } else {
                  console.log("sdk is undefined");
                }
              } catch (error) {
                console.error("Error in safe SDK call:", error.message || String(error));
              }
              return false;
            };
            
            // Try direct SDK call first
            const directSuccess = await safeSDKCall();
            
            // If direct call fails, try the helper
            if (!directSuccess) {
              try {
                console.log("Falling back to promptAddFrame helper");
                await promptAddFrame();
              } catch (helperError) {
                console.error("Helper also failed:", helperError.message || String(helperError));
              }
            }
          } else {
            console.log("App is already added, no need to show prompt");
          }
        } catch (error) {
          console.error("Critical error in add app flow:", error.message || String(error));
        }
      }, 2500); // Increased delay for stability
    };
    
    // Wait for app initialization before prompting
    const checkInitAndPrompt = () => {
      if (appInitialized.current) {
        promptForAppAdd();
      } else {
        // Check again in a moment
        setTimeout(checkInitAndPrompt, 500);
      }
    };
    
    // Start the check cycle
    checkInitAndPrompt();
    
    // No cleanup needed, we control the flow with hasPromptedAddApp
  }, [isInMiniApp, loading]);
  
  if (loading) {
    return <LoadingScreen />;
  }
  
  return (
    <>
      {/* Add Privy Farcaster Auth for Mini App environments */}
      {isInMiniApp && <PrivyFarcasterAuth />}
      
      {/* Add our new direct AddAppPrompt component - ONLY in Mini App environment */}
      {isInMiniApp && <AddAppPrompt />}
      
      {/* Use the same header for both environments but with mini app class when needed */}
      <header className={`app-header ${isInMiniApp ? 'mini-app-header' : ''}`}>
        <div className={`app-header-container ${isInMiniApp ? 'mini-app-header-container' : ''}`}>
          <Navigation />
        </div>
      </header>
      
      {/* Show add app prompt in Mini App environment on supported pages */}
      {isInMiniApp && !hasPromptedAddApp.current && (
        <AddAppPrompt />
      )}
      
      {/* Main content area with route handling */}
      <main className="app-content">
        <AnimatePresence mode="wait">
          <Suspense fallback={<LoadingScreen />}>
            <Routes location={location} key={location.pathname}>
              <Route path="/" element={<HomePage />} />
              <Route path="/explore" element={<ExplorePage />} />
              <Route path="/profile/:username" element={<ProfilePage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/nft/:contractAddress/:tokenId" element={<NFTDetailPage />} />
              {/* Add debug routes */}
              <Route path="/debug/image-loader" element={<DebugImageLoader />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AnimatePresence>
      </main>
      
      {/* Only show footer in web environment */}
      {!isInMiniApp && (
        <footer className="app-footer">
          <div className="app-footer-container">
            <p>vibe coded with 💜 by <a href="https://warpcast.com/svvvg3.eth" target="_blank" rel="noopener noreferrer">@svvvg3.eth</a></p>
          </div>
        </footer>
      )}
      
      {/* Toast notifications container */}
      <ToastContainer 
        position="bottom-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
    </>
  );
}

function App() {
  return (
    <ReduxProvider store={store}>
      <CustomErrorBoundary>
        <PrivyProvider
          appId={PRIVY_APP_ID}
          config={{
            loginMethods: ['wallet', 'farcaster'],
            appearance: {
              theme: 'light',
              accentColor: '#7000FF'
            }
          }}
        >
          <AuthProvider>
            <WalletProvider>
              <NFTProvider>
                <Router>
                  <Suspense fallback={<LoadingScreen />}>
                    <AppContent />
                  </Suspense>
                </Router>
              </NFTProvider>
            </WalletProvider>
          </AuthProvider>
        </PrivyProvider>
      </CustomErrorBoundary>
    </ReduxProvider>
  );
}

export default App;
