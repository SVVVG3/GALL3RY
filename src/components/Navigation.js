import React, { useEffect, useState } from 'react';
import PrivyFarcasterButton from './PrivyFarcasterButton';
import { usePrivy } from '@privy-io/react-auth';
import { isMiniAppEnvironment } from '../utils/miniAppUtils';
import StyleToggle from './StyleToggle';
import '../styles/Navigation.css';

/**
 * Navigation Component
 * Updated to provide cleaner UI with GALL3RY logo, style toggle, and sign-in button
 */
const Navigation = () => {
  const { ready, authenticated, user } = usePrivy();
  const [isInMiniApp, setIsInMiniApp] = useState(false);
  
  // Check if we're in a Mini App environment
  useEffect(() => {
    // Use the function directly instead of as async
    const inMiniApp = isMiniAppEnvironment();
    console.log('Navigation detected mini app:', inMiniApp);
    setIsInMiniApp(inMiniApp);
  }, []);
  
  return (
    <nav className={`navigation ${isInMiniApp ? 'mini-app-navigation' : ''}`}>
      <div className="nav-logo">
        <a href="/" className="logo-link">
          <h1 className="app-title">GALL3RY</h1>
        </a>
      </div>
      
      <div className="nav-controls">
        <StyleToggle />
        
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
      </div>
      
      <style jsx>{`
        .nav-controls {
          display: flex;
          align-items: center;
          gap: 15px;
        }
      `}</style>
    </nav>
  );
};

export default Navigation; 