import React, { useState } from 'react';
import FarcasterUserSearch from '../components/FarcasterUserSearch';
import '../styles/HomePage.css';
import { NFTProvider } from '../contexts/NFTContext';
import SimpleMiniAppSignIn from '../components/SimpleMiniAppSignIn';
import { useAuth } from '../contexts/AuthContext';
import { isMiniAppEnvironment } from '../utils/miniAppUtils';

/**
 * Simple HomePage Component with minimal dependencies
 */
const HomePage = () => {
  const [nftsDisplayed, setNftsDisplayed] = useState(false);
  const { isAuthenticated, user, login } = useAuth();
  const [isMiniApp, setIsMiniApp] = useState(false);

  // Check if we're in a mini app environment on mount
  React.useEffect(() => {
    setIsMiniApp(isMiniAppEnvironment());
  }, []);

  // Callback to track when NFTs are being displayed
  const handleNFTsDisplayChange = (isDisplaying) => {
    setNftsDisplayed(isDisplaying);
  };

  // Handle successful sign-in
  const handleSignInSuccess = (userData) => {
    console.log("Simple sign-in successful with user:", userData);
    if (login && userData) {
      login(userData);
    }
  };

  return (
    <div className="home-container home-container-compact">
      <div className={`search-section ${nftsDisplayed ? 'nfts-displayed' : ''}`}>
        {isMiniApp && (
          <div className="mini-app-test-section" style={{ textAlign: 'center', marginBottom: '20px' }}>
            <h3>Test Sign In</h3>
            <SimpleMiniAppSignIn onSuccess={handleSignInSuccess} />
            
            {isAuthenticated && user && (
              <div style={{ marginTop: '10px', padding: '10px', backgroundColor: '#f0f0f0', borderRadius: '8px' }}>
                <p><strong>Signed in as:</strong> {user.username || `User ${user.fid}`}</p>
                <p><strong>FID:</strong> {user.fid}</p>
              </div>
            )}
          </div>
        )}
        
        <NFTProvider>
          <FarcasterUserSearch onNFTsDisplayChange={handleNFTsDisplayChange} />
        </NFTProvider>
      </div>
    </div>
  );
};

export default HomePage; 