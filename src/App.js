import React, { useState, useEffect, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './App.css';
import './styles/app.css';
import './styles/folder.css';
import './styles/errors.css'; // Import our new error styles
// Import Farcaster Auth Kit styles
import '@farcaster/auth-kit/styles.css';
import { AuthKitProvider } from '@farcaster/auth-kit';

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

// Import the SDK directly at the top level to ensure it's available immediately
import { sdk } from '@farcaster/frame-sdk';

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
    // Just call ready() directly with the SDK we imported
    await sdk.actions.ready();
    console.log('✅ Called ready() successfully');
    return true;
  } catch (e) {
    console.error('❌ Error calling ready():', e);
    return false;
  }
};

// Try to dismiss splash screen as early as possible - before React even renders
if (typeof window !== 'undefined') {
  dismissSplashScreen().catch(e => console.error('Error in early splash screen dismissal:', e));
}

// Add this function before the App component
const getWarpcastContext = async () => {
  try {
    if (typeof sdk.getContext === 'function') {
      const context = await sdk.getContext();
      console.log('Early context check:', context);
      return context;
    }
  } catch (e) {
    console.warn('Error getting early context:', e);
  }
  return null;
};

// Main App function with simplified provider hierarchy
function App() {
  const [loading, setLoading] = useState(true);
  const [appError, setAppError] = useState(null);
  const [miniAppContext, setMiniAppContext] = useState(null);
  const [isMiniApp, setIsMiniApp] = useState(false);
  
  // Initialize app on mount - reduced timer for faster loading
  useEffect(() => {
    const initApp = async () => {
      try {
        // Check if we're in a Mini App environment
        const isInMiniApp = isMiniAppEnvironment();
        setIsMiniApp(isInMiniApp);
        
        // If we're in a Mini App environment, initialize it early to avoid white screen
        if (isInMiniApp) {
          try {
            console.log('Running in Mini App environment, initializing...');
            
            // Initialize the global miniApp object for SDK access
            if (typeof window !== 'undefined' && !window.miniApp) {
              window.miniApp = {
                getUserInfo: async () => {
                  console.log('Getting user info from Mini App SDK');
                  try {
                    // Try to get context from the SDK
                    const context = await sdk.getContext();
                    console.log('Got context from SDK:', context);
                    
                    if (context && context.user) {
                      return {
                        fid: context.user.fid,
                        username: context.user.username || `user${context.user.fid}`,
                        displayName: context.user.displayName || context.user.username || `User ${context.user.fid}`,
                        pfp: {
                          url: context.user.pfpUrl || null
                        }
                      };
                    }
                    // Fallback to empty user info
                    return null;
                  } catch (error) {
                    console.error('Error getting Mini App user info:', error);
                    return null;
                  }
                }
              };
            }
            
            // STEP 1: Try to get context FIRST - before anything else
            let context = null;
            try {
              console.log('🔍 Checking for Warpcast context');
              context = await getWarpcastContext();
              if (context && context.user && context.user.fid) {
                console.log('✅ Found authenticated user in context:', context.user);
                setMiniAppContext(context);
                
                // If we have user data in context, auto-login the user
                const { user } = context;
                const userData = {
                  fid: user.fid,
                  username: user.username || `user${user.fid}`,
                  displayName: user.displayName || `User ${user.fid}`,
                  pfp: user.pfpUrl || null,
                  token: 'context-auth' // Mark as context-based auth
                };
                
                console.log('🔑 Auto-login from context with user data:', userData);
                // Import useAuth directly from context if you need to access login function here
                // Otherwise use your app's authentication state management
                // login(userData);
              } else {
                console.log('⚠️ No authenticated user found in context');
              }
            } catch (contextError) {
              console.warn('Could not get context:', contextError);
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
            
            // STEP 3: Try authentication but don't block on it
            let authCompleted = false;
            try {
              // Generate a secure nonce for authentication
              const nonce = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
              
              // Use direct SDK import rather than dynamic import
              if (sdk.actions && typeof sdk.actions.signIn === 'function') {
                console.log('🔑 Attempting authentication');
                
                // Start auth but don't await it to avoid blocking the app
                const authPromise = sdk.actions.signIn({ nonce });
                
                // Set a timeout to ensure we continue even if auth hangs
                const authTimeoutPromise = new Promise((resolve) => {
                  setTimeout(() => {
                    console.log('⏱️ Authentication timed out, continuing with app initialization');
                    resolve(null);
                  }, 2000); // 2 second timeout
                });
                
                // Race the auth promise against the timeout
                const authResult = await Promise.race([authPromise, authTimeoutPromise]);
                
                if (authResult) {
                  console.log('Authentication result:', authResult);
                  authCompleted = true;
                }
              }
            } catch (authError) {
              console.warn('Authentication error:', authError);
              // Continue even if auth fails - MiniAppAuthHandler will try again
            }
            
            // STEP 4: Try to dismiss splash screen again if not already done
            if (!splashDismissed) {
              console.log('🔄 Trying to dismiss splash screen again');
              try {
                await dismissSplashScreen();
              } catch (secondReadyError) {
                console.warn('Second attempt to dismiss splash screen failed:', secondReadyError);
              }
            }
            
            // STEP 5: Set up event listeners for Mini App interactions
            try {
              setupMiniAppEventListeners();
            } catch (eventError) {
              console.warn('Error setting up event listeners:', eventError);
            }
            
            console.log('Mini App fully initialized, auth completed:', authCompleted);
          } catch (miniAppError) {
            console.error('Error initializing Mini App:', miniAppError);
            // Continue with regular web app rendering even if Mini App init fails
            
            // Try to dismiss splash screen one last time
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
        <AuthProvider>
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
