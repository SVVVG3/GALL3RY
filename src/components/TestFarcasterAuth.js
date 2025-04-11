import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import farcasterAuthService from '../services/farcasterAuthService';
import '../styles/TestFarcasterAuth.css';

/**
 * Test component to inspect Farcaster auth data and profile picture issues
 */
const TestFarcasterAuth = () => {
  const { profile, token } = useAuth();
  
  const handleRefreshToken = async () => {
    try {
      await farcasterAuthService.refreshToken();
      alert('Token refreshed successfully');
    } catch (error) {
      console.error('Error refreshing token:', error);
      alert('Error refreshing token: ' + error.message);
    }
  };

  return (
    <div className="test-farcaster-container">
      <h3>Farcaster Auth Debug</h3>
      <div className="auth-info">
        <div className="profile-info">
          <h4>Profile</h4>
          <pre>{JSON.stringify(profile, null, 2)}</pre>
        </div>
        <div className="token-info">
          <h4>Token</h4>
          <div className="token-content">
            {token ? (
              <>
                <p><strong>Status:</strong> Active</p>
                <p><strong>Expires:</strong> {new Date(token.exp * 1000).toLocaleString()}</p>
                <button onClick={handleRefreshToken}>Refresh Token</button>
              </>
            ) : (
              <p>No token available</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestFarcasterAuth; 