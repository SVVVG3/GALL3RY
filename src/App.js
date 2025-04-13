import React, { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './App.css';
import './styles/app.css';
import './styles/folder.css';
// Import Farcaster Auth Kit
import '@farcaster/auth-kit/styles.css';
import { AuthKitProvider } from '@farcaster/auth-kit';
import SignInButton from './components/SignInButton';
import { AuthProvider } from './contexts/AuthContext';

// Lazy load NFT components to avoid initial loading issues
const NFTProvider = lazy(() => import('./contexts/NFTContext').then(module => ({
  default: module.NFTProvider
})));

const FarcasterUserSearch = lazy(() => import('./components/FarcasterUserSearch'));

// Check if we're in a browser environment with a more robust check
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
const farcasterConfig = {
  rpcUrl: process.env.REACT_APP_OPTIMISM_RPC_URL || 'https://mainnet.optimism.io',
  domain: process.env.REACT_APP_FARCASTER_DOMAIN || 'gall3ry.vercel.app',
  siweUri: process.env.REACT_APP_FARCASTER_SIWE_URI || 'https://gall3ry.vercel.app/login',
};

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
    <button onClick={onRetry}>Try Again</button>
  </div>
);

// Home page component
const HomePage = () => {
  return (
    <div className="home-container">
      <div style={{ textAlign: 'center', marginTop: '2rem', marginBottom: '2rem' }}>
        {/* NFT UI with error boundary */}
        <Suspense fallback={<LoadingScreen />}>
          <ErrorBoundary>
            <NFTContent />
          </ErrorBoundary>
        </Suspense>
      </div>
    </div>
  );
};

// NFT Content component - safely wrapped
const NFTContent = () => {
  const [error, setError] = useState(null);
  
  if (error) {
    return (
      <ErrorDisplay 
        error={error} 
        onRetry={() => setError(null)} 
      />
    );
  }
  
  return (
    <div className="nft-container">
      <h3 style={{ marginBottom: '1.5rem' }}>Search Farcaster users to explore their NFT collections</h3>
      <Suspense fallback={<div>Loading user search...</div>}>
        <FarcasterUserSearch />
      </Suspense>
    </div>
  );
};

// Error boundary specific for NFT components
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("NFT component error:", error);
    console.error("Component stack:", errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', border: '1px solid #f0f0f0', borderRadius: '8px', margin: '20px 0' }}>
          <h3 style={{ color: '#e53e3e' }}>NFT Component Error</h3>
          <p>We encountered an error loading the NFT functionality.</p>
          <details style={{ marginTop: '10px' }}>
            <summary style={{ cursor: 'pointer' }}>Error details</summary>
            <pre style={{ background: '#f7fafc', padding: '10px', overflow: 'auto', fontSize: '0.8em' }}>
              {this.state.error && this.state.error.toString()}
            </pre>
          </details>
          <button 
            onClick={() => this.setState({ hasError: false, error: null })} 
            style={{ marginTop: '10px', padding: '5px 10px' }}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Main App function
function App() {
  const [loading, setLoading] = useState(true);
  const [appError, setAppError] = useState(null);
  const [isClient, setIsClient] = useState(false);
  
  // Initialize app on mount - reduced timer for faster loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
      setIsClient(true);
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
  
  // Render app with authentication but delay NFT functionality
  return (
    <AuthKitProvider config={farcasterConfig}>
      <AuthProvider>
        <Router>
          <div className="app">
            <header className="app-header">
              <div className="container">
                <div className="logo">
                  <Link to="/">
                    <h1>GALL3RY</h1>
                  </Link>
                </div>
                
                <div className="auth-actions">
                  <SignInButton />
                </div>
              </div>
            </header>
            
            <main className="app-content">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/user/:username" element={
                  <Suspense fallback={<LoadingScreen />}>
                    <UserProfilePage />
                  </Suspense>
                } />
              </Routes>
            </main>
            
            <footer className="app-footer">
              <div className="container">
                <p>vibe coded with 💜 by <a href="https://warpcast.com/svvvg3.eth" target="_blank" rel="noopener noreferrer">@svvvg3.eth</a></p>
              </div>
            </footer>
          </div>
        </Router>
      </AuthProvider>
    </AuthKitProvider>
  );
}

// User Profile Page component with lazy loading
const UserProfilePage = () => {
  const [username, setUsername] = useState('');
  
  useEffect(() => {
    // Get username from URL
    const pathParts = window.location.pathname.split('/');
    if (pathParts.length >= 3) {
      setUsername(pathParts[2]);
    }
  }, []);
  
  return (
    <div className="user-profile-page">
      <Suspense fallback={<LoadingScreen />}>
        <ErrorBoundary>
          <FarcasterUserSearch initialUsername={username} />
        </ErrorBoundary>
      </Suspense>
    </div>
  );
};

export default App;
