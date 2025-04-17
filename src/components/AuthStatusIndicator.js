import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/AuthStatusIndicator.css';

/**
 * Component that shows auth status and provides a link to the user's NFTs
 */
const AuthStatusIndicator = () => {
  const { isAuthenticated, profile } = useAuth();
  
  if (!isAuthenticated || !profile) {
    return null; // Don't show anything if not authenticated
  }
  
  return (
    <div className="auth-status-indicator">
      <Link to={`/user/${profile.username}`} className="my-nfts-link">
        My NFTs
      </Link>
    </div>
  );
};

export default AuthStatusIndicator; 