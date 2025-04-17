import React, { useState, useEffect, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import FarcasterUserSearch from './FarcasterUserSearch';
import { ErrorBoundary } from 'react-error-boundary';
import '../styles/UserProfilePage.css';
import { useAuth } from '../contexts/AuthContext';

/**
 * UserProfilePage component with better error handling
 * Displays a Farcaster user's NFTs based on the username in the URL
 */
const UserProfilePage = () => {
  const { username } = useParams();
  const { isAuthenticated, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Set loading and error states
    setLoading(false);
    setError(null);
    
    // Handle the special case where 'me' is used as username parameter
    if (username === 'me') {
      if (isAuthenticated && profile?.username) {
        // Redirect to the actual username URL
        navigate(`/user/${profile.username}`, { replace: true });
      } else if (!isAuthenticated) {
        // If not authenticated but trying to access 'me', show error
        setError(new Error("Please sign in to view your profile"));
      }
    }
  }, [username, isAuthenticated, profile, navigate]);

  // ErrorFallback component
  const ErrorFallback = ({ error, resetErrorBoundary }) => (
    <div className="error-container">
      <h1>Error Loading Profile</h1>
      <p>{error?.message || "An error occurred while loading the profile"}</p>
      <button 
        onClick={resetErrorBoundary} 
        className="retry-button"
      >
        Try Again
      </button>
    </div>
  );

  return (
    <div className="user-profile-page">
      <div className="profile-header">
        <h1>@{username}'s NFTs</h1>
        <p className="profile-description">
          Explore NFTs owned by this Farcaster user
        </p>
      </div>

      <div className="profile-content">
        <ErrorBoundary 
          FallbackComponent={ErrorFallback}
          onReset={() => setError(null)}
        >
          <Suspense fallback={<div className="loading-indicator">Loading user NFTs...</div>}>
            <FarcasterUserSearch initialUsername={username} />
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  );
};

export default UserProfilePage; 