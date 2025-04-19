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
        
        // If we're in a Mini App, initialize it early to avoid white screen
        let miniAppInitialized = false;
        if (isInMiniApp) {
          try {
            console.log('Running in Mini App environment, initializing...');
            
            // Generate a secure nonce for authentication
            const nonce = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            
            // Try to authenticate the user with Farcaster if needed
            let authResult = null;
            try {
              const { handleMiniAppAuthentication } = await import('./utils/miniAppUtils');
              authResult = await handleMiniAppAuthentication(nonce);
              
              if (authResult) {
                console.log('Received auth result from Farcaster', authResult);
                
                // Import and use the auth context to save authentication state
                try {
                  // Get the auth context to update state
                  const authContext = document.querySelector('[data-auth-context]')?.__authContext;
                  
                  if (authContext && typeof authContext.login === 'function') {
                    // Extract FID from the message if possible
                    const fidMatch = authResult.message && authResult.message.match(/fid: (\d+)/);
                    const fid = fidMatch ? parseInt(fidMatch[1], 10) : null;
                    
                    if (fid) {
                      console.log(`Extracted FID ${fid} from auth message, updating auth state`);
                      // Update the auth context with the new auth state
                      authContext.login({ 
                        fid, 
                        token: authResult.signature, 
                        message: authResult.message 
                      });
                    }
                  } else {
                    console.log('Auth context not available yet, will rely on the component authentication');
                  }
                } catch (authContextError) {
                  console.warn('Error updating auth context:', authContextError);
                }
              } else {
                console.log('No auth result returned, user may have cancelled');
              }
            } catch (authError) {
              console.warn('Authentication error:', authError);
              // Continue even if auth fails - some features might be limited
            }
            
            // Initialize Mini App SDK and get context right away regardless of auth status
            // Tell Farcaster we're getting ready to display content
            console.log('⚠️ Calling initializeMiniApp to hide splash screen');
            
            // Force the splash screen to be dismissed after 5 seconds as an emergency fallback
            const splashTimeout = setTimeout(() => {
              console.log('🚨 Emergency splash screen timeout - forcing display of app');
              setLoading(false); // Force loading to complete
              
              // Try to hide the splash element directly if it exists (aggressive approach)
              try {
                const splashElements = document.querySelectorAll('[data-splash], .splash-screen, #splash');
                if (splashElements.length > 0) {
                  console.log('🔍 Found potential splash elements:', splashElements.length);
                  splashElements.forEach(el => {
                    el.style.display = 'none';
                    console.log('🔲 Hiding splash element:', el);
                  });
                }
              } catch (e) {
                console.warn('Error hiding splash elements:', e);
              }
            }, 5000);
            
            const context = await initializeMiniApp({
              disableNativeGestures: false
            });
            console.log('✅ Splash screen dismissal requested');
            
            // Clear the timeout if we successfully initialize
            clearTimeout(splashTimeout);
            
            // Try one more time to call ready directly just to be safe
            try {
              const { sdk } = await import('@farcaster/frame-sdk');
              if (sdk.actions && typeof sdk.actions.ready === 'function') {
                console.log('🔄 Making one final direct ready() call for extra certainty');
                await sdk.actions.ready();
                console.log('✅ Final ready call successful');
              }
            } catch (finalReadyError) {
              console.warn('Final ready call failed:', finalReadyError);
            }
            
            setMiniAppContext(context);
            miniAppInitialized = true;
            
            // Set up event listeners for Mini App interactions
            setupMiniAppEventListeners();
            
            console.log('Mini App fully initialized');
          } catch (miniAppError) {
            console.error('Error initializing Mini App:', miniAppError);
            // Continue with regular web app rendering even if Mini App init fails
          }
        } else {
          console.log('Running in standard web environment');
        }
        
        // Set theme-color meta tag to white to match body
        try {
          const metaThemeColor = document.querySelector('meta[name="theme-color"]');
          if (metaThemeColor) {
            metaThemeColor.setAttribute('content', '#ffffff');
          } else {
            const meta = document.createElement('meta');
            meta.name = 'theme-color';
            meta.content = '#ffffff';
            document.head.appendChild(meta);
          }
        } catch (error) {
          console.error('Failed to set theme-color:', error);
        }
        
        // Complete loading and show UI
        setLoading(false);
      } catch (error) {
        console.error('Error during app initialization:', error);
        setAppError(error);
        setLoading(false);
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
              <div className="app" style={appStyles}>
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
