import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '@farcaster/auth-kit';
import '../styles/modal.css';
import '../styles/CollectionFriendsModal.css';

/**
 * Modal component that displays which Farcaster friends own NFTs from the same collection
 */
const CollectionFriendsModal = ({ isOpen, onClose, contractAddress, collectionName }) => {
  const { isAuthenticated } = useAuth();
  const { profile } = useProfile();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [friends, setFriends] = useState([]);
  const [totalFriends, setTotalFriends] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  
  // Close modal when Escape key is pressed
  useEffect(() => {
    const handleEscapeKey = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen, onClose]);
  
  // Fetch collection friends when modal opens
  useEffect(() => {
    const fetchCollectionFriends = async () => {
      if (!isOpen || !contractAddress || !profile?.fid) {
        return;
      }
      
      setLoading(true);
      setError(null);
      
      try {
        const apiUrl = `/api/collection-friends?contractAddress=${contractAddress}&fid=${profile.fid}&limit=50`;
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        setFriends(data.friends || []);
        setTotalFriends(data.totalFriends || 0);
        setHasMore(data.hasMore || false);
      } catch (error) {
        console.error('Error fetching collection friends:', error);
        setError(error.message || 'Failed to load friends data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchCollectionFriends();
  }, [isOpen, contractAddress, profile?.fid]);
  
  // Stop scroll on body when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [isOpen]);
  
  if (!isOpen) return null;
  
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content collection-friends-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Collection Friends</h3>
          <button className="modal-close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="collection-info">
            <p>Friends who hold NFTs from {collectionName || 'this collection'}</p>
          </div>
          
          {loading && (
            <div className="loading-container">
              <div className="loading-spinner"></div>
              <p>Finding friends who hold this collection...</p>
            </div>
          )}
          
          {error && (
            <div className="error-message">
              <p>Error: {error}</p>
              <button onClick={() => {
                setLoading(true);
                setError(null);
                // Re-trigger the useEffect by changing a dependency
                setFriends([]);
              }}>Try Again</button>
            </div>
          )}
          
          {!loading && !error && friends.length === 0 && (
            <div className="no-results">
              <p>None of your Farcaster friends hold NFTs from this collection.</p>
            </div>
          )}
          
          {!loading && !error && friends.length > 0 && (
            <div className="friends-list">
              {friends.map(friend => (
                <a 
                  key={friend.fid} 
                  href={`https://warpcast.com/${friend.username}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="friend-card"
                >
                  <div className="friend-avatar">
                    {friend.pfpUrl ? (
                      <img 
                        src={friend.pfpUrl} 
                        alt={`${friend.username}'s profile`} 
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = '/assets/placeholder-profile.png';
                        }}
                      />
                    ) : (
                      <div className="avatar-placeholder">{friend.username.charAt(0).toUpperCase()}</div>
                    )}
                  </div>
                  <div className="friend-info">
                    <div className="friend-name">{friend.displayName}</div>
                    <div className="friend-username">@{friend.username}</div>
                  </div>
                </a>
              ))}
            </div>
          )}
          
          {hasMore && (
            <div className="load-more">
              <p>There are more friends who hold this collection.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CollectionFriendsModal; 