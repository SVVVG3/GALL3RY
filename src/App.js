import React, { useState, useEffect, Suspense, useRef, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ToastContainer } from 'react-toastify';
import { ErrorBoundary } from 'react-error-boundary';
// Import Privy Provider
import { PrivyProvider, usePrivy } from '@privy-io/react-auth';

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
  
  // Handle successful Privy authentication
  useEffect(() => {
    if (isInMiniApp) {
      console.log(`Attempting to dismiss splash screen in mini app environment`);
      
      // Try to dismiss splash screen regardless of auth state
      const attemptDismissSplash = async () => {
        try {
          const result = await dismissSplashScreen();
          console.log("Splash screen dismiss attempt result:", result);
          
          // After splash screen is dismissed, prompt user to add the app if not already added
          if (result && !hasPromptedAddApp.current) {
            hasPromptedAddApp.current = true;
            
            // Small delay to ensure the app UI is visible before showing the prompt
            setTimeout(async () => {
              try {
                // Check if app is already added using our helper function
                const appAlreadyAdded = await isAppAdded();
                
                if (!appAlreadyAdded) {
                  console.log("Prompting user to add the app...");
                  await promptAddFrame();
                } else {
                  console.log("App is already added, not showing prompt");
                }
              } catch (error) {
                console.error("Error checking if app is added or prompting to add:", error);
              }
            }, 1500);
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
  
  if (loading) {
    return <LoadingScreen />;
  }
  
  return (
    <>
      {/* Add Privy Farcaster Auth for Mini App environments */}
      {isInMiniApp && <PrivyFarcasterAuth />}
      
      {/* Use the same header for both environments but with mini app class when needed */}
      <header className={`app-header ${isInMiniApp ? 'mini-app-header' : ''}`}>
        <div className={`app-header-container ${isInMiniApp ? 'mini-app-header-container' : ''}`}>
          <Navigation />
        </div>
      </header>
      
      <main className={isInMiniApp ? 'mini-app-main' : 'app-main'}>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<HomePage />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/profile/:fid" element={<ProfilePage />} />
            <Route path="/nft/:contractAddress/:tokenId" element={<NFTDetailPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
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
    </>
  );
}

function App() {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ['farcaster'],
        appearance: {
          theme: 'light',
          accentColor: '#6d28d9' // Purple color to match your existing UI
        }
      }}
    >
      <AuthProvider>
        <WalletProvider>
          <Router>
            <Suspense fallback={<LoadingScreen />}>
              <CustomErrorBoundary>
                <AppContent />
              </CustomErrorBoundary>
            </Suspense>
          </Router>
          <ToastContainer position="bottom-right" />
        </WalletProvider>
      </AuthProvider>
    </PrivyProvider>
  );
}

export default App;
