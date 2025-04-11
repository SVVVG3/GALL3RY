import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Link } from 'react-router-dom';
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
        <Router>
          <div className="app">
            <header className="app-header">
              <div className="container">
                <div className="logo">
                  <Link to="/">
                    <h1>GALL3RY</h1>
                  </Link>
                </div>
                
                <nav className="main-nav">
                  <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
                    Home
                  </NavLink>
                  <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'active' : ''}>
                    My Collections
                  </NavLink>
                </nav>
                
                <div className="auth-actions">
                  <AuthButtons />
                </div>
              </div>
            </header>
            
            <main className="app-content">
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/dashboard" element={<UserDashboard />} />
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

// Combined HomePage component with Discover functionality
const HomePage = () => {
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const { isAuthenticated, profile, token } = useAuth();
  
  const handleFolderSelect = (folderId) => {
    setSelectedFolderId(folderId);
  };
  
  // Render the main content based on selected tab
  const renderContent = () => {
    if (selectedFolderId) {
      return (
        <div className="selected-folder-view">
          <button 
            className="back-button" 
            onClick={() => setSelectedFolderId(null)}
          >
            &larr; Back to Gallery
          </button>
          
          <FolderDetail 
            folderId={selectedFolderId} 
            isReadOnly={true}
          />
        </div>
      );
    }
    
    return <FarcasterUserSearch />;
  };
  
  return (
    <div className="home-container">
      <div className="hero-section">
        <p>Search Farcaster users to explore their NFT collections</p>
      </div>
      
      {renderContent()}
    </div>
  );
};

// Authentication buttons component
const AuthButtons = () => {
  const { isAuthenticated, profile, logout } = useAuth();
  
  if (isAuthenticated && profile) {
    return (
      <>
        <Link to={`/user/${profile.username}`} className="user-profile-link">
          <div className="user-avatar">
            <img 
              src={profile.avatarUrl} 
              alt={profile.username}
              onError={(e) => {
                e.target.src = 'https://via.placeholder.com/40?text=User';
              }}
            />
          </div>
          <span className="username">{profile.username || 'User'}</span>
        </Link>
        <button onClick={logout} className="btn btn-outline">Sign Out</button>
      </>
    );
  }
  
  return <SignInButton />;
};

export default App;
