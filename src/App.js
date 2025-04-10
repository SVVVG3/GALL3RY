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
import DiscoveryPage from './pages/DiscoveryPage';
import LoginPage from './pages/LoginPage';
import { AuthProvider } from './contexts/AuthContext';

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
                <NavLink to="/discover" className={({ isActive }) => isActive ? 'active' : ''}>
                  Discover
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
              <Route path="/discover" element={<DiscoveryPage />} />
            </Routes>
          </main>
          
          <footer className="app-footer">
            <div className="container">
              <p>&copy; {new Date().getFullYear()} GALL3RY. All rights reserved.</p>
            </div>
          </footer>
        </div>
      </Router>
    </AuthProvider>
  );
}

// Simple HomePage component
const HomePage = () => {
  return (
    <div className="home-container">
      <div className="hero-section">
        <h1>Organize & Share Your NFT Collection</h1>
        <p>Create beautiful galleries, organize your NFTs, and share your collection with the world.</p>
        <div className="hero-actions">
          <NavLink to="/dashboard" className="btn btn-primary">Get Started</NavLink>
          <NavLink to="/discover" className="btn btn-secondary">Explore Collections</NavLink>
        </div>
      </div>
      
      <div className="features-section">
        <div className="feature-card">
          <div className="feature-icon">🖼️</div>
          <h3>Organize Your NFTs</h3>
          <p>Group your NFTs into collections and folders for better organization.</p>
        </div>
        
        <div className="feature-card">
          <div className="feature-icon">🌐</div>
          <h3>Share Publicly</h3>
          <p>Make your collections public and share them with the world.</p>
        </div>
        
        <div className="feature-card">
          <div className="feature-icon">🔍</div>
          <h3>Discover Collections</h3>
          <p>Explore public collections from other users and find inspiration.</p>
        </div>
      </div>
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
