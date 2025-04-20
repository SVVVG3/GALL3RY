import React, { useEffect, useState } from 'react';
import PrivyFarcasterButton from './PrivyFarcasterButton';
import { usePrivy } from '@privy-io/react-auth';
import { isMiniAppEnvironment } from '../utils/miniAppUtils';
import '../styles/Navigation.css';

/**
 * Navigation Component
 * Updated to provide cleaner UI with only GALL3RY logo and sign-in button
 */
const Navigation = () => {
  const { ready, authenticated, user } = usePrivy();
  const [isInMiniApp, setIsInMiniApp] = useState(false);
  
  // Check if we're in a Mini App environment
  useEffect(() => {
    setIsInMiniApp(isMiniAppEnvironment());
  }, []);
  
  return (
    <nav className="navigation">
      <div className="nav-logo">
        <a href="/" className="logo-link">
          <h1 className="app-title">GALL3RY</h1>
        </a>
      </div>
      
      <div className="nav-auth">
        {authenticated && user ? (
          <div className="user-info">
            {user.farcaster?.pfp && (
              <img 
                src={user.farcaster.pfp} 
                alt={user.farcaster.username || 'User'} 
                className="user-avatar"
              />
            )}
            <span className="username">@{user.farcaster?.username}</span>
          </div>
        ) : (
          <PrivyFarcasterButton 
            className="sign-in-button" 
            buttonText="Sign in"
          />
        )}
      </div>
    </nav>
  );
};

export default Navigation; 