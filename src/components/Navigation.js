import React from 'react';
import FarcasterSignInButton from './FarcasterSignInButton';
import farcasterAuthService from '../services/farcasterAuthService';
import '../styles/Navigation.css';

/**
 * Navigation Component
 */
const Navigation = () => {
  const { useProfileHook } = farcasterAuthService;
  const { isAuthenticated, profile } = useProfileHook();
  
  return (
    <nav className="navigation">
      <div className="nav-logo">
        <h1 className="app-title">GALL3RY</h1>
      </div>
      
      <div className="nav-links">
        <a href="/" className="nav-link">Home</a>
        <a href="/explore" className="nav-link">Explore</a>
        {isAuthenticated && (
          <>
            <a href="/my-nfts" className="nav-link">My NFTs</a>
            <a href="/folders" className="nav-link">My Folders</a>
          </>
        )}
      </div>
      
      <div className="nav-auth">
        {isAuthenticated ? (
          <div className="user-info">
            {profile.pfp && (
              <img 
                src={profile.pfp.url || profile.pfp} 
                alt={profile.username || 'User'} 
                className="user-avatar"
              />
            )}
            <span className="username">@{profile.username}</span>
          </div>
        ) : (
          <FarcasterSignInButton className="nav-sign-in" />
        )}
      </div>
    </nav>
  );
};

export default Navigation; 