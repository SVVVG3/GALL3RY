import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../contexts/ProfileContext';
import FarcasterUserSearch from '../components/FarcasterUserSearch';
import { NFTProvider } from '../contexts/NFTContext';
import NFTGallery from '../components/NFTGallery';
import SimpleMiniAppSignIn from '../components/SimpleMiniAppSignIn';
import { isMiniAppEnvironment } from '../utils/miniAppUtils';
import { sdk } from '@farcaster/frame-sdk';

/**
 * Simple HomePage Component with minimal dependencies
 */
const HomePage = () => {
  const { isAuthenticated, user } = useAuth();
  const { profile } = useProfile();
  const [isMiniApp, setIsMiniApp] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authStatus, setAuthStatus] = useState('idle'); // 'idle', 'loading', 'success', 'error'

  useEffect(() => {
    setIsMiniApp(isMiniAppEnvironment());
    
    // Check SDK status and log for debugging
    if (typeof window !== 'undefined') {
      console.log('HomePage - SDK Status:', {
        sdkDefined: !!sdk,
        hasActions: sdk && !!sdk.actions,
        hasContext: sdk && !!sdk.context,
        hasGetContextMethod: sdk && typeof sdk.getContext === 'function'
      });
    }
  }, []);

  const handleSignInSuccess = (userData) => {
    console.log('SignIn Success:', userData);
    setAuthStatus('success');
    setAuthError(null);
  };

  const handleSignInError = (error) => {
    console.error('SignIn Error:', error);
    setAuthStatus('error');
    setAuthError(error.message || 'Authentication failed');
    
    // Reset error after 5 seconds
    setTimeout(() => {
      setAuthError(null);
      setAuthStatus('idle');
    }, 5000);
  };

  return (
    <div className="home-page">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6 text-center text-purple-600">
          Farcaster NFT Gallery
        </h1>
        
        {isMiniApp && !isAuthenticated && (
          <div className="mini-app-signin-container mb-6 p-4 bg-purple-50 rounded-lg">
            <h2 className="text-lg font-semibold mb-2 text-purple-800">Welcome to the Mini App</h2>
            <p className="text-sm text-gray-600 mb-4">
              Sign in with your Farcaster account to view and share your NFTs
            </p>
            
            <SimpleMiniAppSignIn 
              onSuccess={handleSignInSuccess} 
              onError={handleSignInError}
            />
            
            {authStatus === 'error' && authError && (
              <div className="error-message mt-3 p-2 bg-red-100 text-red-700 rounded">
                {authError}
              </div>
            )}
          </div>
        )}
        
        {isAuthenticated && user && (
          <div className="user-info mb-6 p-4 bg-purple-50 rounded-lg">
            <h2 className="text-lg font-semibold mb-2">Welcome, {user.displayName || user.username}</h2>
            <p className="text-sm text-gray-600">
              FID: {user.fid} | Username: @{user.username}
            </p>
          </div>
        )}
        
        <NFTProvider>
          <FarcasterUserSearch />
          <NFTGallery />
        </NFTProvider>
      </div>
    </div>
  );
};

export default HomePage; 