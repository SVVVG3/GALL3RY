import React, { useState, useEffect, Suspense } from 'react';
import { useParams } from 'react-router-dom';
import FarcasterUserSearch from './FarcasterUserSearch';
import { useNFT } from '../contexts/NFTContext';
import '../styles/UserProfilePage.css';

/**
 * UserProfilePage component
 * Displays a Farcaster user's NFTs based on the username in the URL
 */
const UserProfilePage = () => {
  const { username } = useParams();
  const { isLoading } = useNFT();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Set loading and error states
    setLoading(false);
    setError(null);
  }, [username]);

  // Handle error display
  if (error) {
    return (
      <div className="error-container">
        <h1>Error</h1>
        <p>{error}</p>
        <button 
          onClick={() => setError(null)} 
          className="retry-button"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="user-profile-page">
      <div className="profile-header">
        <h1>@{username}'s NFTs</h1>
        <p className="profile-description">
          Explore NFTs owned by this Farcaster user
        </p>
      </div>

      <div className="profile-content">
        <Suspense fallback={<div className="loading-indicator">Loading user NFTs...</div>}>
          <FarcasterUserSearch initialUsername={username} />
        </Suspense>
      </div>
    </div>
  );
};

export default UserProfilePage; 