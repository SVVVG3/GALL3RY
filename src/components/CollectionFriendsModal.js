import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePrivy } from '@privy-io/react-auth';
import farcasterService from '../services/farcasterService';
import alchemyService from '../services/alchemyService';
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
  
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [usingMockData, setUsingMockData] = useState(false);
  const [totalFriends, setTotalFriends] = useState(0);

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

  useEffect(() => {
    if (!isOpen) return;
    
    // Reset state when modal opens
    setLoading(true);
    setError(null);
    
    const fetchFriends = async () => {
      try {
        // Check if authenticated through either method
        if (isUserAuthenticated && collectionAddress) {
          // Try to get fid from the user if authenticated with Privy
          const fid = privyUser?.farcaster?.fid;
          
          if (!fid) {
            console.warn('No Farcaster FID found in user data, falling back to mock data');
            const mockFriends = getMockFriends();
            setFriends(mockFriends);
            setUsingMockData(true);
            setLoading(false);
            return;
          }
          
          console.log(`Fetching friends who own collection ${collectionAddress} for FID: ${fid}`);
          
          // 1. Get following users from Farcaster
          const following = await farcasterService.getUserFollowing(fid, 100);
          console.log(`Found ${following.users.length} following users`);
          
          if (following.users.length === 0) {
            console.warn('No following users found, falling back to mock data');
            const mockFriends = getMockFriends();
            setFriends(mockFriends);
            setUsingMockData(true);
            setLoading(false);
            return;
          }
          
          // 2. Get all owners of the collection
          const owners = await alchemyService.getOwnersForContract(collectionAddress);
          console.log(`Found ${owners.length} collection owners`);
          
          if (owners.length === 0) {
            console.warn('No collection owners found, falling back to mock data');
            const mockFriends = getMockFriends();
            setFriends(mockFriends);
            setUsingMockData(true);
            setLoading(false);
            return;
          }
          
          // 3. Create a set of owner addresses (lowercase) for faster lookup
          const ownerAddresses = new Set(owners.map(addr => addr.toLowerCase()));
          
          // 4. Filter following users who own the collection
          const friendsWithCollection = following.users.filter(followingUser => {
            // Check if any of the user's addresses are in the owners list
            return followingUser.addresses && followingUser.addresses.some(address => 
              ownerAddresses.has(address.toLowerCase())
            );
          });
          
          console.log(`Found ${friendsWithCollection.length} friends who own the collection`);
          
          // 5. Format for display
          const formattedFriends = friendsWithCollection.map(friend => ({
            id: friend.fid.toString(),
            name: friend.displayName || friend.username,
            username: friend.username,
            avatar: friend.imageUrl,
            addresses: friend.addresses
          }));
          
          if (formattedFriends.length > 0) {
            setFriends(formattedFriends);
            setTotalFriends(formattedFriends.length);
            setUsingMockData(false);
          } else {
            // No friends found, but we tried with real data
            setFriends([]);
            setTotalFriends(0);
            setUsingMockData(false);
          }
        } else {
          // Not authenticated or no collection address
          setFriends([]);
          setUsingMockData(false);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Error fetching friends:', err);
        setError('Failed to load friends. Please try again later.');
        
        // Fall back to mock data in case of error
        const mockFriends = getMockFriends();
        setFriends(mockFriends);
        setUsingMockData(true);
        setLoading(false);
      }
    };
    
    fetchFriends();
  }, [isOpen, isUserAuthenticated, collectionAddress, privyUser]);
  
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
      <>
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
      </>
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