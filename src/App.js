import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import './App.css';
import './styles/app.css';
import './styles/folder.css';
// Import Farcaster Auth Kit
import '@farcaster/auth-kit/styles.css';
import { AuthKitProvider } from '@farcaster/auth-kit';
import NftGrid from './components/NFTGrid';
import SearchBar from './components/SearchBar';
import SignInButton from './components/SignInButton';
import FolderManager from './components/FolderManager';
import PublicFolderManager from './components/PublicFolderManager';
import { useAuth } from './contexts/AuthContext';
import zapperService from './services/zapperService';
import UserDashboard from './pages/UserDashboard';
import { AuthProvider } from './contexts/AuthContext';
import FarcasterUserSearch from './components/FarcasterUserSearch';
import FolderDetail from './components/FolderDetail';
import { NFTProvider } from './contexts/NFTContext';

// Configure Farcaster Auth Kit
const farcasterConfig = {
  rpcUrl: process.env.REACT_APP_OPTIMISM_RPC_URL || 'https://mainnet.optimism.io',
  domain: process.env.REACT_APP_FARCASTER_DOMAIN || 'gall3ry.vercel.app',
  siweUri: process.env.REACT_APP_FARCASTER_SIWE_URI || 'https://gall3ry.vercel.app/login',
};

function App() {
  return (
    <AuthKitProvider config={farcasterConfig}>
      <AuthProvider>
        <NFTProvider>
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
                    <AuthButtons />
                  </div>
                </div>
              </header>
              
              <main className="app-content">
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/user/:username" element={<UserProfilePage />} />
                </Routes>
              </main>
              
              <footer className="app-footer">
                <div className="container">
                  <p>vibe coded with 💜 by <a href="https://warpcast.com/svvvg3.eth" target="_blank" rel="noopener noreferrer">@svvvg3.eth</a></p>
                </div>
              </footer>
            </div>
          </Router>
        </NFTProvider>
      </AuthProvider>
    </AuthKitProvider>
  );
}

// User Profile Page component that uses FarcasterUserSearch
const UserProfilePage = () => {
  const { profile } = useAuth();
  const [username, setUsername] = useState('');
  
  useEffect(() => {
    // Get username from URL
    const pathParts = window.location.pathname.split('/');
    if (pathParts.length >= 3) {
      setUsername(pathParts[2]);
    }
  }, []);
  
  // Use the existing FarcasterUserSearch component
  // We'll initialize it with the username from the URL
  return (
    <div className="user-profile-page">
      <FarcasterUserSearch initialUsername={username} />
    </div>
  );
};

// HomePage component simplified to just show FarcasterUserSearch
const HomePage = () => {
  return (
    <div className="home-container">
      <p className="welcome-text">Search Farcaster users to explore their NFT collections</p>
      <FarcasterUserSearch />
    </div>
  );
};

// Authentication buttons component
const AuthButtons = () => {
  const { isAuthenticated, profile, logout } = useAuth();
  
  if (isAuthenticated && profile) {
    // Check if we're already on someone's profile page
    const isOnProfilePage = window.location.pathname.startsWith('/user/');
    const currentUsername = isOnProfilePage ? window.location.pathname.split('/')[2] : '';
    const isOnOwnProfile = currentUsername === profile.username;
    
    return (
      <>
        <Link 
          to={`/user/${profile.username}`} 
          className={`user-profile-link ${isOnOwnProfile ? 'current-profile' : ''}`}
          onClick={(e) => {
            if (isOnOwnProfile) {
              e.preventDefault();
              window.scrollTo(0, 0);
            } else if (isOnProfilePage && currentUsername !== profile.username) {
              // Force page to reload when switching from one profile to another
              // This ensures the FarcasterUserSearch component reinitializes with the new username
              e.preventDefault();
              window.location.href = `/user/${profile.username}`;
            }
          }}
        >
          <span className="username">@{profile.username || 'User'}</span>
        </Link>
        <button onClick={logout} className="btn btn-outline">Sign Out</button>
      </>
    );
  }
  
  return <SignInButton />;
};

export default App;
