import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import './App.css';
import './styles/app.css';
import './styles/folder.css';
import NftGrid from './components/NFTGrid';
import SearchBar from './components/SearchBar';
import SignInButton from './components/SignInButton';
import FolderManager from './components/FolderManager';
import PublicFolderManager from './components/PublicFolderManager';
import { useAuth } from './contexts/AuthContext';
import zapperService from './services/zapperService';
import UserDashboard from './pages/UserDashboard';
import LoginPage from './pages/LoginPage';
import { AuthProvider } from './contexts/AuthContext';
import FarcasterUserSearch from './components/FarcasterUserSearch';
import FolderDetail from './components/FolderDetail';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app">
          <header className="app-header">
            <div className="container">
              <div className="logo">
                <h1>GALL3RY</h1>
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
              <Route path="/login" element={<LoginPage />} />
              <Route path="/dashboard" element={<UserDashboard />} />
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
  );
}

// Combined HomePage component with Discover functionality
const HomePage = () => {
  const [activeTab, setActiveTab] = useState('search'); // 'search' or 'collections'
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
    
    if (activeTab === 'search') {
      return <FarcasterUserSearch />;
    }
    
    return (
      <PublicFolderManager 
        userId={isAuthenticated ? profile?.fid : null}
        token={token}
        onFolderSelect={handleFolderSelect}
      />
    );
  };
  
  return (
    <div className="home-container">
      <div className="hero-section">
        <h1>Discover NFTs in the Farcaster Ecosystem</h1>
        <p>Search Farcaster users to explore their NFT collections or browse shared galleries.</p>
      </div>
      
      <div className="discovery-tabs">
        <button 
          className={`tab-button ${activeTab === 'search' ? 'active' : ''}`}
          onClick={() => setActiveTab('search')}
        >
          Search Farcaster Users
        </button>
        <button 
          className={`tab-button ${activeTab === 'collections' ? 'active' : ''}`}
          onClick={() => setActiveTab('collections')}
        >
          Public Collections
        </button>
      </div>
      
      {renderContent()}
    </div>
  );
};

// Authentication buttons component
const AuthButtons = () => {
  const { isAuthenticated, profile, login, logout } = useAuth();
  
  if (isAuthenticated && profile) {
    return (
      <>
        <span className="user-greeting">Hi, {profile.username || 'User'}</span>
        <button onClick={logout} className="btn btn-outline">Sign Out</button>
      </>
    );
  }
  
  return (
    <NavLink to="/login" className="btn btn-primary">Sign In</NavLink>
  );
};

export default App;
