import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '@farcaster/auth-kit';
import '../styles/modal.css';
import '../styles/CollectionFriendsModal.css';

/**
 * Modal component that displays which Farcaster friends own NFTs from the same collection
 * Uses React Portal to render outside the normal DOM hierarchy
 */
const CollectionFriendsModal = ({ isOpen, onClose, contractAddress, collectionName }) => {
  const { isAuthenticated } = useAuth();
  const { profile } = useProfile();
  const modalRef = useRef(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [friends, setFriends] = useState([]);
  const [totalFriends, setTotalFriends] = useState(0);
  const [usingMockData, setUsingMockData] = useState(false);
  
  // Close modal when user hits escape key
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscKey);
    return () => {
      window.removeEventListener('keydown', handleEscKey);
    };
  }, [onClose]);
  
  // Handle clicking outside the modal to close it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);
  
  // Prevent body scrolling when modal is open - enhanced version
  useEffect(() => {
    if (!isOpen) return;
    
    // Save current body style
    const originalStyle = window.getComputedStyle(document.body);
    const originalOverflow = originalStyle.overflow;
    const originalPaddingRight = originalStyle.paddingRight;
    
    // Get scrollbar width
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    
    // Apply styles to prevent scrolling
    document.body.style.overflow = 'hidden';
    document.body.style.paddingRight = `${scrollbarWidth}px`;
    
    return () => {
      // Restore original styles
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;
    };
  }, [isOpen]);
  
  // Fetch collection friends from multiple API endpoints with retries
  useEffect(() => {
    if (!isOpen || !contractAddress) return;

    // If user isn't authenticated, don't try to fetch data
    if (!isAuthenticated || !profile?.fid) {
      setIsLoading(false);
      setUsingMockData(true);
      setFriends(generateMockFriends());
      return;
    }

    const fetchCollectionFriends = async () => {
      setIsLoading(true);
      setError(null);
      setUsingMockData(false);

      try {
        // Try primary API endpoint first
        const apiUrl = `/api/collection-friends?contractAddress=${contractAddress}&fid=${profile.fid}`;
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
          throw new Error(`API returned ${response.status}`);
        }
        
        const data = await response.json();
        setFriends(data.friends || []);
        setTotalFriends(data.total || data.friends?.length || 0);
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching collection friends from primary API:", error);
        
        try {
          // Try secondary API endpoint
          const backupApiUrl = `/api/collection-friends-backup?contractAddress=${contractAddress}&fid=${profile.fid}`;
          const backupResponse = await fetch(backupApiUrl);
          
          if (!backupResponse.ok) {
            throw new Error(`Backup API returned ${backupResponse.status}`);
          }
          
          const backupData = await backupResponse.json();
          setFriends(backupData.friends || []);
          setTotalFriends(backupData.total || backupData.friends?.length || 0);
          setIsLoading(false);
        } catch (backupError) {
          console.error("Error fetching from backup API:", backupError);
          
          // Use mock data as last resort
          console.log("Using mock data as fallback");
          const mockFriends = generateMockFriends();
          setFriends(mockFriends);
          setTotalFriends(mockFriends.length);
          setUsingMockData(true);
          setIsLoading(false);
        }
      }
    };

    fetchCollectionFriends();
  }, [isOpen, contractAddress, profile?.fid, isAuthenticated]);
  
  // Generate mock friends data for fallback
  const generateMockFriends = useCallback(() => {
    const names = [
      "Alex", "Jordan", "Taylor", "Morgan", "Casey", 
      "Riley", "Avery", "Quinn", "Rowan", "Skyler"
    ];
    
    return Array.from({ length: 8 }, (_, i) => ({
      id: `mock-${i}`,
      username: `${names[i % names.length].toLowerCase()}${100 + i}`,
      displayName: names[i % names.length],
      pfp: null, // No profile picture for mock data
      fid: 1000 + i
    }));
  }, []);
  
  // Prevent click events from bubbling up and closing the modal unexpectedly
  const handleModalClick = (e) => {
    e.stopPropagation();
  };
  
  // Function to render appropriate content based on authentication state
  const renderContent = () => {
    if (!isAuthenticated) {
      return (
        <div className="unauthenticated-message">
          <p>Sign in with Farcaster to see which of your friends own NFTs from this collection.</p>
          <div className="auth-prompt">
            <button className="sign-in-button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      );
    }

    if (isLoading) {
      return (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading friends...</p>
        </div>
      );
    }

    if (error && !usingMockData) {
      return (
        <div className="error-message">
          <p>Error loading collection friends: {error.message}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      );
    }

    if (usingMockData) {
      return (
        <>
          <div className="mock-data-notice">
            <p>Using sample data for demonstration. Connect with Farcaster to see your real friends.</p>
          </div>
          <div className="friends-list">
            {friends.map(friend => (
              <a 
                key={friend.id || friend.fid} 
                href={`https://warpcast.com/${friend.username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="friend-card"
              >
                <div className="friend-avatar">
                  {friend.pfp ? (
                    <img src={friend.pfp} alt={friend.displayName} />
                  ) : (
                    <div className="avatar-placeholder">
                      {friend.displayName?.charAt(0) || friend.username?.charAt(0) || '?'}
                    </div>
                  )}
                </div>
                <div className="friend-info">
                  <div className="friend-name">{friend.displayName || friend.username}</div>
                  <div className="friend-username">@{friend.username}</div>
                </div>
              </a>
            ))}
          </div>
        </>
      );
    }

    if (friends.length === 0) {
      return (
        <div className="no-results">
          <p>No friends found with NFTs from this collection.</p>
        </div>
      );
    }

    return (
      <div className="friends-list">
        {friends.map(friend => (
          <a 
            key={friend.id || friend.fid} 
            href={`https://warpcast.com/${friend.username}`}
            target="_blank"
            rel="noopener noreferrer"
            className="friend-card"
          >
            <div className="friend-avatar">
              {friend.pfp ? (
                <img src={friend.pfp} alt={friend.displayName} />
              ) : (
                <div className="avatar-placeholder">
                  {friend.displayName?.charAt(0) || friend.username?.charAt(0) || '?'}
                </div>
              )}
            </div>
            <div className="friend-info">
              <div className="friend-name">{friend.displayName || friend.username}</div>
              <div className="friend-username">@{friend.username}</div>
            </div>
          </a>
        ))}
      </div>
    );
  };
  
  if (!isOpen) return null;
  
  // Use createPortal to render the modal at the root level of the document
  // This prevents z-index stacking context issues
  return createPortal(
    <div 
      className="modal-overlay" 
      onClick={onClose}
      data-testid="modal-overlay"
    >
      <div 
        ref={modalRef}
        className="collection-friends-modal"
        onClick={handleModalClick}
        data-testid="friends-modal"
      >
        <div className="modal-header">
          <h2 className="modal-title">
            {collectionName ? `${collectionName} Owners` : 'Collection Owners'}
          </h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>
        
        <div className="collection-friends-content">
          <div className="collection-info">
            <p>
              {totalFriends > 0 
                ? `${totalFriends} friends own NFTs from this collection` 
                : 'Discover which friends own this collection'}
            </p>
          </div>
          {renderContent()}
        </div>
      </div>
    </div>,
    document.body // Mount directly to body element
  );
};

export default CollectionFriendsModal; 