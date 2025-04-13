import React, { useState, useEffect, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './App.css';
import './styles/app.css';
import './styles/folder.css';
import './styles/errors.css'; // Import our new error styles
// Import Farcaster Auth Kit styles
import '@farcaster/auth-kit/styles.css';

// Import all components directly to avoid lazy loading issues
import { AuthProvider } from './contexts/AuthContext';
import { WalletProvider } from './contexts/WalletContext';
import { NFTProvider } from './contexts/NFTContext';
import SignInButton from './components/SignInButton';
import FarcasterUserSearch from './components/FarcasterUserSearch';
import UserProfilePage from './components/UserProfilePage';

// Check if we're in a browser environment with a robust check
const isBrowser = typeof window !== 'undefined' && 
                 window.document !== undefined && 
                 window.localStorage !== undefined;

// Safe localStorage wrapper
const safeStorage = {
  getItem: (key) => {
    if (!isBrowser) return null;
    try {
      return localStorage.getItem(key);
    } catch (error) {
      console.error('Error accessing localStorage.getItem:', error);
      return null;
    }
  },
  setItem: (key, value) => {
    if (!isBrowser) return;
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      console.error('Error accessing localStorage.setItem:', error);
    }
  },
  removeItem: (key) => {
    if (!isBrowser) return;
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Error accessing localStorage.removeItem:', error);
    }
  }
};

// Configure Farcaster Auth Kit
const getFarcasterConfig = () => ({
  rpcUrl: process.env.REACT_APP_OPTIMISM_RPC_URL || 'https://mainnet.optimism.io',
  domain: process.env.REACT_APP_FARCASTER_DOMAIN || 'gall3ry.vercel.app',
  siweUri: process.env.REACT_APP_FARCASTER_SIWE_URI || 'https://gall3ry.vercel.app/login',
});

// Loading component for suspense fallback
const LoadingScreen = () => (
  <div className="loading-container">
    <div className="loading-spinner"></div>
    <p>Loading app...</p>
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

// Home page component with proper error boundaries
const HomePage = () => {
  return (
    <div className="home-container">
      <div className="content-wrapper">
        <h2>Search Farcaster users to explore their NFT collections</h2>
        
        {/* We're simplifying the component hierarchy for better error isolation */}
        <ErrorBoundary>
          <NFTProvider>
            <FarcasterUserSearch />
          </NFTProvider>
        </ErrorBoundary>
      </div>
    </div>
  );
};

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
  
  // Initialize app on mount - reduced timer for faster loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 100); // Reduced from 1000ms to 100ms
    
    return () => clearTimeout(timer);
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
  
  // Return the app with a simplified provider hierarchy
  return (
    <ErrorBoundary onError={(error) => setAppError(error)}>
      <AuthProvider>
        <WalletProvider>
          <Router>
            <div className="app">
              <header className="app-header">
                <Link to="/" className="logo-link">GALL3RY</Link>
                <div className="auth-container">
                  <SignInButton />
                </div>
              </header>
              
              <main className="app-content">
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/user/:username" element={
                    <NFTProvider>
                      <UserProfilePage />
                    </NFTProvider>
                  } />
                </Routes>
              </main>
              
              <footer className="app-footer">
                <a 
                  href="https://github.com/SVVVG3/GALL3RY"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-link"
                >
                  vibe coded with 💜 by @svvvg3.eth
                </a>
              </footer>
            </div>
          </Router>
        </WalletProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
