import React, { useEffect, useState } from 'react';
import FarcasterSignInButton from './FarcasterSignInButton';
import farcasterAuthService from '../services/farcasterAuthService';
import { isMiniAppEnvironment } from '../utils/miniAppUtils';
import '../styles/Navigation.css';

/**
 * Navigation Component
 * Updated to provide fallback auth options in Mini App environment
 */
const Navigation = () => {
  const { useProfileHook } = farcasterAuthService;
  const { isAuthenticated, profile } = useProfileHook();
  const [isInMiniApp, setIsInMiniApp] = useState(false);
  
  // Check if we're in a Mini App environment
  useEffect(() => {
    setIsInMiniApp(isMiniAppEnvironment());
  }, []);
  
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
            
            {/* In Mini App mode, always show sign-in option as a fallback */}
            {isInMiniApp && (
              <div className="mini-app-signin-container" style={{ marginLeft: '10px' }}>
                <FarcasterSignInButton className="mini-app-fallback-signin" />
              </div>
            )}
          </div>
        ) : (
          <FarcasterSignInButton className="nav-sign-in" />
        )}
      </div>
    </nav>
  );
};

export default Navigation; 