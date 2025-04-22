import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePrivy } from '@privy-io/react-auth';
import farcasterService, { fetchAllFollowing } from '../services/farcasterService';
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
  const [debugInfo, setDebugInfo] = useState({});
  const [timeMarkers, setTimeMarkers] = useState({});

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      // Reset all state when modal opens
      setLoading(true);
      setError(null);
      setFriends([]);
      setUsingMockData(false);
      setTotalFriends(0);
      setDebugInfo({});
      setTimeMarkers({
        start: new Date().toISOString()
      });
      
      console.log('🔄 MODAL OPENED: Resetting state');
      // Add detailed debug information about the collection
      console.log('COLLECTION DEBUG:', {
        collectionAddress,
        collectionName,
        collectionAddressType: typeof collectionAddress,
        isEmpty: !collectionAddress,
        length: collectionAddress?.length
      });
    }
  }, [isOpen, collectionAddress, collectionName]);
  
  // Debug authentication states
  useEffect(() => {
    if (isOpen) {
      console.log('🔐 Modal Authentication Status:', { 
        authContext: isAuthenticated, 
        privyAuthenticated, 
        isUserAuthenticated,
        authUser: user ? 'User exists' : 'No auth user',
        privyUser: privyUser ? 'Privy user exists' : 'No privy user'
      });
      
      console.log('📋 Collection Data:', {
        address: collectionAddress || 'No address provided',
        name: collectionName || 'No name provided'
      });
      
      if (privyUser?.farcaster) {
        console.log('🎭 Farcaster Data:', {
          fid: privyUser.farcaster.fid,
          username: privyUser.farcaster.username,
          displayName: privyUser.farcaster.displayName,
          hasConnectedAddresses: Array.isArray(privyUser.farcaster.addresses) && 
                                 privyUser.farcaster.addresses.length > 0
        });
      } else {
        console.log('⚠️ No Farcaster data found in Privy user');
      }
    }
  }, [isOpen, isAuthenticated, privyAuthenticated, isUserAuthenticated, user, privyUser, collectionAddress, collectionName]);

  useEffect(() => {
    if (!isOpen) return;
    
    const fetchFriends = async () => {
      try {
        const debug = {
          timestamps: {
            startTime: new Date().toISOString()
          },
          authState: {
            isUserAuthenticated,
            hasPrivyUser: !!privyUser,
            hasPrivyFarcaster: !!privyUser?.farcaster,
            hasAuthUser: !!user
          },
          collection: {
            address: collectionAddress,
            name: collectionName
          }
        };
        
        setDebugInfo(prevDebug => ({ ...prevDebug, ...debug, status: 'Starting fetch process...' }));
        console.log('🔍 Starting friend fetch process');
        console.log('PRE-CHECK VALUES:', {
          isAuthenticated: isUserAuthenticated,
          hasCollectionAddress: !!collectionAddress,
          collectionAddress,
          collectionAddressType: typeof collectionAddress,
          validAddress: typeof collectionAddress === 'string' && collectionAddress.length > 0 && collectionAddress.startsWith('0x'),
          fid: privyUser?.farcaster?.fid,
          preCheckPassed: isUserAuthenticated && !!collectionAddress
        });
        
        // Check if authenticated through either method
        if (isUserAuthenticated && collectionAddress) {
          // Try to get fid from the user if authenticated with Privy
          const fid = privyUser?.farcaster?.fid;
          
          if (!fid) {
            console.warn('⚠️ No Farcaster FID found in user data, falling back to mock data');
            debug.error = 'No Farcaster FID found';
            debug.fidCheck = false;
            setDebugInfo(prevDebug => ({ ...prevDebug, ...debug }));
            
            const mockFriends = getMockFriends();
            setFriends(mockFriends);
            setUsingMockData(true);
            setLoading(false);
            return;
          }
          
          console.log(`👤 Using Farcaster FID: ${fid} for collection ${collectionAddress}`);
          debug.fid = fid;
          debug.fidCheck = true;
          
          setDebugInfo(prevDebug => ({ 
            ...prevDebug, 
            ...debug, 
            status: 'Fetching following users...',
            timestamps: {
              ...prevDebug.timestamps,
              beforeFollowingFetch: new Date().toISOString()
            }
          }));
          
          // 1. Get following users from Farcaster
          try {
            console.log('🌐 Starting Neynar API call to get all following users...');
            console.log('API Parameters:', { fid });
            
            const followingStartTime = Date.now();
            // Add try/catch to explicitly log any errors during API call
            try {
              // Use fetchAllFollowing instead of getUserFollowing to get all following users
              const following = await fetchAllFollowing(fid);
              const followingEndTime = Date.now();
              
              // Check if following is valid and has users array
              if (!following || !following.users) {
                throw new Error('Invalid response from fetchAllFollowing: missing users array');
              }
              
              console.log(`✅ Found ${following.users.length} following users - API call took ${followingEndTime - followingStartTime}ms`);
              
              // Log a sample of the following users for debugging
              if (following.users.length > 0) {
                console.log('📊 Sample of following users:', following.users.slice(0, 3).map(u => ({
                  username: u.username,
                  fid: u.fid,
                  hasAddresses: Array.isArray(u.addresses) && u.addresses.length > 0,
                  addressCount: u.addresses ? u.addresses.length : 0
                })));
              }
              
              debug.following = {
                count: following.users.length,
                success: following.success,
                pagesRetrieved: following.pagesRetrieved,
                responseTime: followingEndTime - followingStartTime,
                hasUsers: following.users.length > 0,
                fromCache: following.fromCache
              };
              
              setDebugInfo(prevDebug => ({ 
                ...prevDebug, 
                ...debug, 
                status: 'Processing following users...',
                timestamps: {
                  ...prevDebug.timestamps,
                  afterFollowingFetch: new Date().toISOString()
                }
              }));
              
              if (following.users.length === 0) {
                console.warn('⚠️ No following users found, falling back to mock data');
                debug.followingEmpty = true;
                setDebugInfo(prevDebug => ({ ...prevDebug, ...debug }));
                
                const mockFriends = getMockFriends();
                setFriends(mockFriends);
                setUsingMockData(true);
                setLoading(false);
                return;
              }
              
              // Count how many users have associated addresses
              const usersWithAddresses = following.users.filter(user => 
                Array.isArray(user.addresses) && user.addresses.length > 0
              ).length;
              
              console.log(`👥 Users with connected addresses: ${usersWithAddresses}/${following.users.length}`);
              
              // Get a sample of addresses for debugging
              const sampleAddresses = following.users.slice(0, 3).map(user => ({
                username: user.username,
                addresses: user.addresses || []
              }));
              debug.sampleFollowing = sampleAddresses;
              debug.usersWithAddresses = usersWithAddresses;
              
              setDebugInfo(prevDebug => ({ 
                ...prevDebug, 
                ...debug, 
                status: 'Fetching collection owners...',
                timestamps: {
                  ...prevDebug.timestamps,
                  beforeOwnersCall: new Date().toISOString()
                }
              }));
              
              // 2. Get all owners of the collection
              console.log(`🖼️ Starting Alchemy API call for contract: ${collectionAddress}`);
              console.log('API Parameters:', { collectionAddress });
              
              try {
                const ownersStartTime = Date.now();
                console.log('TRYING TO FETCH OWNERS:', {
                  time: new Date().toISOString(),
                  collectionAddress,
                  alchemyServiceReady: !!alchemyService?.getOwnersForContract
                });
                
                const owners = await alchemyService.getOwnersForContract(collectionAddress);
                const ownersEndTime = Date.now();
                
                console.log(`✅ Found ${owners.length} collection owners - API call took ${ownersEndTime - ownersStartTime}ms`);
                
                if (owners.length > 0) {
                  console.log('📊 Sample of owner addresses:', owners.slice(0, 5));
                }
                
                debug.owners = {
                  count: owners.length,
                  success: true,
                  responseTime: ownersEndTime - ownersStartTime,
                  sample: owners.slice(0, 5)
                };
                
                setDebugInfo(prevDebug => ({ 
                  ...prevDebug, 
                  ...debug, 
                  status: 'Processing collection owners...',
                  timestamps: {
                    ...prevDebug.timestamps,
                    afterOwnersCall: new Date().toISOString()
                  }
                }));
                
                if (owners.length === 0) {
                  console.warn('⚠️ No collection owners found, falling back to mock data');
                  debug.ownersEmpty = true;
                  setDebugInfo(prevDebug => ({ ...prevDebug, ...debug }));
                  
                  const mockFriends = getMockFriends();
                  setFriends(mockFriends);
                  setUsingMockData(true);
                  setLoading(false);
                  return;
                }
                
                // 3. Create a set of owner addresses (lowercase) for faster lookup
                const ownerAddresses = new Set(owners.map(addr => addr.toLowerCase()));
                debug.ownersSet = Array.from(ownerAddresses).slice(0, 5);
                
                // 4. Filter following users who own the collection
                console.log('🔄 Checking for intersection between following users and collection owners...');
                
                const startIntersection = Date.now();
                
                const friendsWithCollection = following.users.filter(followingUser => {
                  if (!followingUser.addresses || followingUser.addresses.length === 0) {
                    return false;
                  }
                  
                  const hasMatch = followingUser.addresses.some(address => {
                    const normalizedAddress = address.toLowerCase();
                    const isOwner = ownerAddresses.has(normalizedAddress);
                    if (isOwner) {
                      console.log(`✅ Match found: ${followingUser.username} (${normalizedAddress}) owns the collection`);
                    }
                    return isOwner;
                  });
                  
                  return hasMatch;
                });
                
                const endIntersection = Date.now();
                
                console.log(`✨ Found ${friendsWithCollection.length} friends who own the collection - Took ${endIntersection - startIntersection}ms`);
                if (friendsWithCollection.length > 0) {
                  console.log('📊 Matched friends:', friendsWithCollection.map(f => f.username));
                }
                
                debug.matchesFound = friendsWithCollection.length;
                debug.matches = friendsWithCollection.map(f => f.username);
                debug.intersectionTime = endIntersection - startIntersection;
                
                setDebugInfo(prevDebug => ({ 
                  ...prevDebug, 
                  ...debug, 
                  status: 'Formatting results...',
                  timestamps: {
                    ...prevDebug.timestamps,
                    afterIntersection: new Date().toISOString()
                  }
                }));
                
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
                  debug.finalResult = 'Real friends found!';
                } else {
                  // No friends found, but we tried with real data
                  setFriends([]);
                  setTotalFriends(0);
                  setUsingMockData(false);
                  debug.finalResult = 'No friends found with real data';
                }
                
                setDebugInfo(prevDebug => ({ 
                  ...prevDebug, 
                  ...debug, 
                  status: 'Complete!',
                  timestamps: {
                    ...prevDebug.timestamps,
                    complete: new Date().toISOString()
                  }
                }));
              } catch (ownersError) {
                console.error('❌ Error fetching collection owners:', ownersError);
                console.error('ERROR DETAILS:', {
                  message: ownersError.message,
                  stack: ownersError.stack?.substring(0, 200),
                  responseStatus: ownersError.response?.status,
                  responseData: ownersError.response?.data
                });
                
                debug.ownersError = ownersError.message;
                debug.ownersSuccess = false;
                setDebugInfo(prevDebug => ({ ...prevDebug, ...debug }));
                
                // Try with the correct format if the contract address includes a network prefix
                if (collectionAddress.includes(':')) {
                  const cleanAddress = collectionAddress.split(':')[1];
                  console.log(`🔄 Trying with cleaned address: ${cleanAddress}`);
                  try {
                    const cleanedStartTime = Date.now();
                    const owners = await alchemyService.getOwnersForContract(cleanAddress);
                    const cleanedEndTime = Date.now();
                    
                    console.log(`✅ Found ${owners.length} collection owners with cleaned address - API call took ${cleanedEndTime - cleanedStartTime}ms`);
                    
                    debug.cleanedAddressOwners = {
                      count: owners.length,
                      success: true,
                      responseTime: cleanedEndTime - cleanedStartTime,
                      sample: owners.slice(0, 5)
                    };
                    
                    // Continue with the same logic...
                    if (owners.length > 0) {
                      const ownerAddresses = new Set(owners.map(addr => addr.toLowerCase()));
                      const friendsWithCollection = following.users.filter(followingUser => {
                        return followingUser.addresses && followingUser.addresses.some(address => 
                          ownerAddresses.has(address.toLowerCase())
                        );
                      });
                      
                      console.log(`✨ Found ${friendsWithCollection.length} friends with cleaned address`);
                      
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
                        debug.finalResult = 'Real friends found with cleaned address!';
                        setDebugInfo(prevDebug => ({ 
                          ...prevDebug, 
                          ...debug, 
                          status: 'Complete with cleaned address!',
                          timestamps: {
                            ...prevDebug.timestamps,
                            completeWithCleanedAddress: new Date().toISOString()
                          }
                        }));
                        setLoading(false);
                        return;
                      }
                    }
                  } catch (cleanedError) {
                    console.error('❌ Error with cleaned address:', cleanedError);
                    debug.cleanedAddressError = cleanedError.message;
                  }
                }
                
                // Fall back to mock data
                console.log('🔄 Falling back to mock data due to errors fetching collection owners');
                const mockFriends = getMockFriends();
                setFriends(mockFriends);
                setUsingMockData(true);
                debug.finalResult = 'Using mock data due to owners error';
                setDebugInfo(prevDebug => ({ ...prevDebug, ...debug }));
              }
            } catch (apiCallError) {
              console.error('❌ ERROR IN FOLLOWING USERS API CALL:', apiCallError);
              console.error('API CALL ERROR DETAILS:', {
                message: apiCallError.message,
                stack: apiCallError.stack?.substring(0, 200),
                responseStatus: apiCallError.response?.status,
                responseData: apiCallError.response?.data
              });
              throw apiCallError; // rethrow to be caught by the outer try/catch
            }
          } catch (followingError) {
            console.error('❌ Error fetching following users:', followingError);
            debug.followingError = followingError.message;
            debug.followingSuccess = false;
            setDebugInfo(prevDebug => ({ ...prevDebug, ...debug }));
            
            // Fall back to mock data
            console.log('🔄 Falling back to mock data due to errors fetching following users');
            const mockFriends = getMockFriends();
            setFriends(mockFriends);
            setUsingMockData(true);
          }
        } else {
          // Not authenticated or no collection address
          const reason = !isUserAuthenticated ? 'Not authenticated' : 'No collection address';
          console.log(`⚠️ Cannot fetch friends: ${reason}`);
          debug.reason = reason;
          setDebugInfo(prevDebug => ({ ...prevDebug, ...debug }));
          setFriends([]);
          setUsingMockData(false);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('❌ Error fetching friends:', err);
        console.error('FULL ERROR DETAILS:', {
          message: err.message,
          stack: err.stack?.substring(0, 200),
          responseStatus: err.response?.status,
          responseData: err.response?.data
        });
        setError('Failed to load friends. Please try again later.');
        setDebugInfo(prevDebug => ({ 
          ...prevDebug, 
          generalError: err.message,
          stack: err.stack,
          timestamps: {
            ...prevDebug.timestamps,
            error: new Date().toISOString()
          }
        }));
        
        // Fall back to mock data in case of error
        console.log('🔄 Falling back to mock data due to general error');
        const mockFriends = getMockFriends();
        setFriends(mockFriends);
        setUsingMockData(true);
        setLoading(false);
      }
    };
    
    fetchFriends();
  }, [isOpen, isUserAuthenticated, collectionAddress, privyUser]);
  
  const getMockFriends = () => {
    console.log('📊 Generating mock friend data');
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
          <p className="modal-debug-status">{debugInfo.status || 'Initializing...'}</p>
        </div>
      );
    }
    
    if (error) {
      return (
        <div className="modal-error">
          <p>{error}</p>
          <button className="modal-close-btn" onClick={onClose}>Close</button>
          {Object.keys(debugInfo).length > 0 && (
            <details className="modal-debug-info" open>
              <summary>Debug Info</summary>
              <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
            </details>
          )}
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
          {Object.keys(debugInfo).length > 0 && (
            <details className="modal-debug-info" open>
              <summary>Debug Info</summary>
              <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
            </details>
          )}
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
        {(usingMockData || Object.keys(debugInfo).length > 0) && (
          <details className="modal-debug-info">
            <summary>Debug Info</summary>
            <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
          </details>
        )}
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