import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './App.css';
import './styles/app.css';
import './styles/folder.css';
// Import Farcaster Auth Kit
import '@farcaster/auth-kit/styles.css';
import { AuthKitProvider } from '@farcaster/auth-kit';
import SignInButton from './components/SignInButton';

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

// Simplified app with minimal functionality
function App() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Load some basic data on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);
  
  // Handle any errors
  if (error) {
    return (
      <div className="error-container">
        <h1>Error</h1>
        <p>{error.message || 'An unknown error occurred'}</p>
        <button onClick={() => window.location.reload()}>Refresh</button>
      </div>
    );
  }
  
  // Loading state
  if (loading) {
    return <LoadingScreen />;
  }
  
  // Render a simplified app structure
  return (
    <AuthKitProvider config={farcasterConfig}>
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
            <div className="container">
              <div style={{ textAlign: 'center', marginTop: '4rem' }}>
                <h2>Welcome to GALL3RY</h2>
                <p>Simplified version for debugging</p>
                <p>
                  {isBrowser 
                    ? 'Browser environment detected' 
                    : 'Browser environment NOT detected'}
                </p>
                <p>
                  LocalStorage Test: 
                  {(() => {
                    try {
                      safeStorage.setItem('test', 'Working!');
                      const result = safeStorage.getItem('test');
                      safeStorage.removeItem('test');
                      return result || 'Not working';
                    } catch (e) {
                      return `Error: ${e.message}`;
                    }
                  })()}
                </p>
              </div>
            </div>
          </main>
          
          <footer className="app-footer">
            <div className="container">
              <p>vibe coded with 💜 by <a href="https://warpcast.com/svvvg3.eth" target="_blank" rel="noopener noreferrer">@svvvg3.eth</a></p>
            </div>
          </footer>
        </div>
      </Router>
    </AuthKitProvider>
  );
}

export default App;
