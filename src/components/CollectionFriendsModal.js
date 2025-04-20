import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePrivy } from '@privy-io/react-auth';
import '../styles/CollectionFriendsModal.css';

/**
 * Modal component that displays which Farcaster friends own NFTs from the same collection
 * Uses React Portal to render outside the normal DOM hierarchy
 */
const CollectionFriendsModal = ({ isOpen, onClose, collectionAddress, collectionName }) => {
  const modalRef = useRef(null);
  const { user, isAuthenticated } = useAuth();
  const { authenticated: privyAuthenticated, user: privyUser } = usePrivy();
  
  // Consider both authentication methods
  const isUserAuthenticated = isAuthenticated || privyAuthenticated;
  
  // Debug authentication states
  useEffect(() => {
    if (isOpen) {
      console.log('Modal Authentication Status:', { 
        authContext: isAuthenticated, 
        privyAuthenticated, 
        isUserAuthenticated,
        authUser: user,
        privyUser 
      });
    }
  }, [isOpen, isAuthenticated, privyAuthenticated, isUserAuthenticated, user, privyUser]);
  
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [usingMockData, setUsingMockData] = useState(false);
  const [totalFriends, setTotalFriends] = useState(0);

  useEffect(() => {
    if (!isOpen) return;
    
    // Reset state when modal opens
    setLoading(true);
    setError(null);
    
    const fetchFriends = async () => {
      try {
        // In a real app, fetch friends data from your API
        // For now we'll simulate a delay and use mock data
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Check if authenticated through either method
        if (isUserAuthenticated) {
          // This would be replaced with real API call
          const mockFriends = getMockFriends();
          setFriends(mockFriends);
          setUsingMockData(true); // Always using mock data for now
        } else {
          setFriends([]);
          setUsingMockData(false);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching friends:', err);
        setError('Failed to load friends. Please try again later.');
        setLoading(false);
      }
    };
    
    fetchFriends();
  }, [isOpen, isUserAuthenticated]);
  
  const getMockFriends = () => {
    return [
      {
        id: '1',
        name: 'dwr.eth',
        username: 'dwr',
        avatar: 'https://pbs.twimg.com/profile_images/1617678299480051713/gYsHfb5j_400x400.jpg',
      },
      {
        id: '2',
        name: 'Varun Srinivasan',
        username: 'v',
        avatar: 'https://pbs.twimg.com/profile_images/1631445005312847873/89BCz1TG_400x400.jpg',
      },
      {
        id: '3',
        name: 'Ted Livingston',
        username: 'ted',
        avatar: 'https://pbs.twimg.com/profile_images/1720555225536462848/qh2fJVy0_400x400.jpg',
      },
    ];
  };
  
  // Close modal when clicking outside
  const handleModalClick = (e) => {
    e.stopPropagation();
  };

  // Handle escape key press
  useEffect(() => {
    const handleEscKey = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose]);

  // Handle rendering content based on loading/error state
  const renderContent = () => {
    if (loading) {
      return (
        <div className="modal-loading">
          <div className="spinner"></div>
          <p>Loading friends...</p>
        </div>
      );
    }
    
    if (error) {
      return (
        <div className="modal-error">
          <p>{error}</p>
          <button className="modal-close-btn" onClick={onClose}>Close</button>
        </div>
      );
    }
    
    if (!isUserAuthenticated) {
      return (
        <div className="modal-auth-required">
          <p>Please connect with Farcaster to see friends who own this collection.</p>
          <button className="modal-close-btn" onClick={onClose}>Close</button>
        </div>
      );
    }
    
    if (friends.length === 0) {
      return (
        <div className="modal-no-friends">
          <p>No friends found who own this collection.</p>
        </div>
      );
    }
    
    return (
      <div className="modal-friends-content">
        {usingMockData && (
          <div className="mock-data-disclaimer">
            <p>Using sample data for demonstration. Connect with Farcaster to see your real friends.</p>
          </div>
        )}
        <div className="friends-list">
          {friends.map((friend) => (
            <div key={friend.id} className="friend-item">
              <div className="friend-avatar">
                {friend.avatar ? (
                  <img src={friend.avatar} alt={friend.name} />
                ) : (
                  <div className="default-avatar">
                    {friend.name.charAt(0)}
                  </div>
                )}
              </div>
              <div className="friend-info">
                <h4>{friend.name}</h4>
                <p>@{friend.username}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Only render if modal is open
  if (!isOpen) return null;

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-container" ref={modalRef} onClick={handleModalClick}>
        <div className="modal-header">
          <h3>Friends owning {collectionName}</h3>
          <button className="modal-close-button" onClick={onClose}>×</button>
        </div>
        <div className="modal-content">
          {renderContent()}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CollectionFriendsModal; 