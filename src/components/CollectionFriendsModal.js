import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePrivy } from '@privy-io/react-auth';
import farcasterService from '../services/farcasterService';
import alchemyService from '../services/alchemyService';
import '../styles/CollectionFriendsModal.css';
import { useSelector } from 'react-redux';
import farcasterStateService from '../services/farcasterStateService';
import { selectFollowing } from '../redux/farcasterSlice';

/**
 * Modal component that displays which Farcaster friends own NFTs from the same collection
 * Uses React Portal to render outside the normal DOM hierarchy
 */
const CollectionFriendsModal = ({ isOpen, onClose, collectionAddress, collectionName, network }) => {
  // Fix for modals in React
  useEffect(() => {
    if (isOpen) {
      const preventBackgroundScrolling = (e) => {
        // Don't prevent scrolling inside the modal content
        if (modalRef.current && modalRef.current.contains(e.target)) {
          return true; // Allow scrolling inside the modal
        }
        e.preventDefault();
        e.stopPropagation();
        return false;
      };
      
      // Add these classes to fix modal interactions
      document.body.classList.add('modal-open');
      
      // Prevent wheel events from propagating to background
      document.addEventListener('wheel', preventBackgroundScrolling, { passive: false });
      
      return () => {
        document.body.classList.remove('modal-open');
        document.removeEventListener('wheel', preventBackgroundScrolling);
      };
    }
  }, [isOpen]);
  
  const modalRef = useRef(null);
  const { user, isAuthenticated } = useAuth();
  const { authenticated: privyAuthenticated, user: privyUser } = usePrivy();
  
  // Consider both authentication methods
  const isUserAuthenticated = isAuthenticated || privyAuthenticated;
  
  const [friends, setFriends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchingFollowing, setFetchingFollowing] = useState(false);
  const [error, setError] = useState(null);
  const [usingMockData, setUsingMockData] = useState(false);
  const [totalFriends, setTotalFriends] = useState(0);
  const [debugInfo, setDebugInfo] = useState({});
  const [timeMarkers, setTimeMarkers] = useState({});

  // Get following data from Redux store
  const followingState = useSelector(selectFollowing);

  // Helper function to normalize contract addresses
  const normalizeContractAddress = (address) => {
    if (!address) return '';
    
    // Remove any network prefix (e.g., "eth:" or "polygon:")
    if (address.includes(':')) {
      const parts = address.split(':');
      if (parts.length >= 2) {
        const cleanAddress = parts[parts.length - 2].startsWith('0x') ? parts[parts.length - 2] : parts[parts.length - 1];
        console.log(`Normalized contract address from ${address} to ${cleanAddress}`);
        return cleanAddress;
      }
    }
    
    // Ensure the address starts with 0x
    if (!address.startsWith('0x')) {
      console.log(`Adding 0x prefix to ${address}`);
      return `0x${address}`;
    }
    
    return address;
  };

  // Helper function to extract chain from address with prefix
  const extractChainFromAddress = (address) => {
    if (!address || !address.includes(':')) return 'eth'; // Default to Ethereum
    
    const [network, _] = address.split(':');
    // Map common network abbreviations to Alchemy network identifiers
    const networkMappings = {
      'eth': 'eth',
      'ethereum': 'eth',
      'polygon': 'polygon',
      'matic': 'polygon',
      'optimism': 'opt',
      'opt': 'opt',
      'arbitrum': 'arb',
      'arb': 'arb',
      'base': 'base',
      'zora': 'zora'
    };
    
    // Return mapped network or default to 'eth' if unknown
    console.log(`Extracted network ${network} from address: ${address}`);
    return networkMappings[network.toLowerCase()] || 'eth';
  };

  // Initialize following data when user is authenticated
  useEffect(() => {
    if (isUserAuthenticated && privyUser?.farcaster?.fid) {
      const fid = privyUser.farcaster.fid;
      
      // Pre-fetch following data if not already in store
      if (!followingState.users.length || followingState.fid !== fid) {
        console.log(`Pre-fetching following list for FID ${fid}`);
        farcasterStateService.getFollowing({ fid });
      }
    }
  }, [isUserAuthenticated, privyUser]);

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
          
          // 1. Get following users from Farcaster (using Redux store or API)
          let following;
          const followingStartTime = Date.now();
          
          try {
            // Set following loading state
            setFetchingFollowing(true);
            
            // Check if we have valid following data in Redux
            if (
              followingState.users.length > 0 && 
              followingState.fid === fid &&
              followingState.lastFetched && 
              !followingState.isFetching
            ) {
              console.log(`Using following list from Redux store: ${followingState.users.length} users`);
              following = { 
                users: followingState.users,
                success: true,
                fromCache: true 
              };
            } else {
              // Fetch following users if not in Redux or data is stale
              console.log('Following not in Redux or stale, fetching from API...');
              following = await farcasterStateService.getFollowing({ fid });
              following = { 
                users: following,
                success: true,
                fromCache: false 
              };
            }
            
            // Clear following loading state
            setFetchingFollowing(false);
            
            const followingEndTime = Date.now();
            
            // Check if following is valid
            if (!following || !following.users || !Array.isArray(following.users)) {
              throw new Error('Invalid following data: missing or invalid users array');
            }
            
            console.log(`✅ Found ${following.users.length} following users - Retrieval took ${followingEndTime - followingStartTime}ms`);
            
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
              
              // Normalize the contract address before calling the API
              const normalizedAddress = normalizeContractAddress(collectionAddress);
              console.log(`Using normalized contract address: ${normalizedAddress}`);
              
              // Extract network/chain information from the address if available,
              // but prefer the network parameter if it was passed in
              const resolvedNetwork = network || extractChainFromAddress(collectionAddress);
              console.log(`Using network ${resolvedNetwork} for collection ${normalizedAddress}`);
              
              // Call getOwnersForContract with both contractAddress and network parameters
              const owners = await alchemyService.getOwnersForContract(normalizedAddress, resolvedNetwork);
              const ownersEndTime = Date.now();
              
              console.log(`✅ Found ${owners.length} collection owners - API call took ${ownersEndTime - ownersStartTime}ms`);
              
              if (owners.length > 0) {
                console.log('📊 Sample of owner addresses:', owners.slice(0, 5));
              }
              
              debug.owners = {
                count: owners.length,
                success: true,
                responseTime: ownersEndTime - ownersStartTime,
                sample: owners.slice(0, 5),
                network: resolvedNetwork
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
                console.warn('⚠️ No collection owners found - showing empty state');
                debug.ownersEmpty = true;
                setDebugInfo(prevDebug => ({ ...prevDebug, ...debug }));
                
                // Return empty data instead of mock data
                setFriends([]);
                setTotalFriends(0);
                setUsingMockData(false);
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
              if (collectionAddress.includes(':') || !collectionAddress.startsWith('0x')) {
                // Use our existing normalize function
                const cleanAddress = normalizeContractAddress(collectionAddress);
                console.log(`🔄 Trying with normalized address: ${cleanAddress}`);
                try {
                  // Extract network/chain information from the address if available,
                  // but prefer the network parameter if it was passed in
                  const resolvedNetwork = network || extractChainFromAddress(collectionAddress);
                  console.log(`Using network ${resolvedNetwork} for cleaned address ${cleanAddress}`);
                  
                  const cleanedStartTime = Date.now();
                  // Call getOwnersForContract with both contractAddress and network parameters
                  const owners = await alchemyService.getOwnersForContract(cleanAddress, resolvedNetwork);
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
              
              // Return empty data instead of using mock data
              console.log('No collection owners found or error occurred - showing empty state');
              setFriends([]);
              setTotalFriends(0);
              setUsingMockData(false);
              debug.finalResult = 'No data available';
              setDebugInfo(prevDebug => ({ ...prevDebug, ...debug }));
            }
          } catch (followingError) {
            console.error('Error fetching following users:', followingError);
            debug.followingError = followingError.message;
            setDebugInfo(prevDebug => ({ ...prevDebug, ...debug }));
            
            // Make sure to clear the following loading state
            setFetchingFollowing(false);
            
            // Fall back to mock data
            const mockFriends = getMockFriends();
            setFriends(mockFriends);
            setUsingMockData(true);
            setLoading(false);
            return;
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
        
        // Make sure all loading states are cleared
        setFetchingFollowing(false);
        setLoading(false);
        
        // Return empty data instead of using mock data
        console.log('No collection owners found or error occurred - showing empty state');
        setFriends([]);
        setTotalFriends(0);
        setUsingMockData(false);
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
        avatar: 'https://cdn.stamp.fyi/avatar/eth:0x2703483b1a5a7c577e8680de9df8be03c6f30e3c?s=300',
      },
      {
        id: '2',
        name: 'Varun Srinivasan',
        username: 'v',
        avatar: 'https://cdn.stamp.fyi/avatar/eth:0xd8da6bf26964af9d7eed9e03e53415d37aa96045?s=300',
      },
      {
        id: '3',
        name: 'Dan Savage',
        username: 'svvvg3.eth',
        avatar: 'https://cdn.stamp.fyi/avatar/fc:466111?s=300',
      },
    ];
  };
  
  // Properly handle clicks on the modal itself to prevent closing
  const handleModalClick = (e) => {
    // Stop propagation to prevent the overlay's onClick from firing
    e.stopPropagation();
    // Prevent any default behaviors
    e.preventDefault();
    // Log for debugging
    console.log('Modal container clicked, prevented close');
  };

  // Handle click on the overlay
  const handleOverlayClick = (e) => {
    // Only close if the click is directly on the overlay element itself
    if (e.target === e.currentTarget) {
      console.log('Overlay clicked, closing modal');
      onClose();
    } else {
      console.log('Click on modal child, not closing');
      e.stopPropagation();
    }
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

  // Add a debugging effect to find scrollbar issues when modal opens
  useEffect(() => {
    if (isOpen && modalRef.current) {
      console.log('Modal debugging: Inspecting for scrollbar issues');
      
      // Check for any computed styles or scrollbar issues
      setTimeout(() => {
        if (modalRef.current) {
          const modalEl = modalRef.current;
          const friendsListEl = modalEl.querySelector('.friends-list');
          const friendItems = modalEl.querySelectorAll('.friend-item');
          
          console.log('Modal container width:', modalEl.offsetWidth);
          
          if (friendsListEl) {
            console.log('Friends list layout:', {
              scrollWidth: friendsListEl.scrollWidth,
              clientWidth: friendsListEl.clientWidth,
              offsetWidth: friendsListEl.offsetWidth,
              style: window.getComputedStyle(friendsListEl)
            });
            
            // Apply extra style fixes if needed
            friendsListEl.style.width = '100%';
            friendsListEl.style.maxWidth = modalEl.offsetWidth + 'px';
            friendsListEl.style.boxSizing = 'border-box';
          }
          
          // Enforce full width on each friend item
          friendItems.forEach(item => {
            item.style.width = '100%';
            item.style.maxWidth = '100%';
            item.style.boxSizing = 'border-box';
          });
        }
      }, 300);
    }
  }, [isOpen]);

  // Debug scrolling issues - with direct DOM fixes
  useEffect(() => {
    if (isOpen && friends.length > 0 && !loading) {
      console.log('Applying direct DOM fixes for scrolling:');
      
      // Apply immediate fixes
      if (modalRef.current) {
        const modalEl = modalRef.current;
        const modalContent = modalEl.querySelector('.modal-content');
        const friendsList = modalEl.querySelector('.friends-list');
        
        // Apply immediate fixes to modal content
        if (modalContent) {
          // Force scrollable styles
          Object.assign(modalContent.style, {
            overflowY: 'auto !important',
            maxHeight: 'calc(80vh - 64px) !important', 
            display: 'block !important',
            position: 'relative !important',
            flex: '1 !important'
          });
        }
        
        // Force scrollable styles on the friends list
        if (friendsList) {
          Object.assign(friendsList.style, {
            overflowY: 'auto !important',
            maxHeight: 'calc(80vh - 80px) !important',
            display: 'block !important',
            width: '100% !important',
            padding: '0 !important',
            margin: '0 !important'
          });
          
          // Make each friend item non-scrollable
          const friendItems = friendsList.querySelectorAll('.friend-item');
          friendItems.forEach(item => {
            Object.assign(item.style, {
              overflow: 'hidden !important',
              flexShrink: '0 !important'
            });
          });
        }
      }
      
      // Log debug info after timeout to capture post-render state
      setTimeout(() => {
        if (modalRef.current) {
          const modalEl = modalRef.current;
          const modalContent = modalEl.querySelector('.modal-content');
          const friendsList = modalEl.querySelector('.friends-list');
          
          console.log('Modal dimensions after fixes:', {
            modalHeight: modalEl.offsetHeight,
            contentHeight: modalContent?.offsetHeight,
            listHeight: friendsList?.offsetHeight,
            listScrollHeight: friendsList?.scrollHeight,
            listChildCount: friendsList?.children.length,
            contentOverflow: modalContent ? window.getComputedStyle(modalContent).overflowY : 'none',
            listOverflow: friendsList ? window.getComputedStyle(friendsList).overflowY : 'none'
          });
        }
      }, 100);
    }
  }, [isOpen, friends.length, loading]);

  // Fix any global event issues that might be interfering with the modal
  useEffect(() => {
    if (isOpen) {
      // Log that modal is open
      console.log('Modal is opened - applying global fixes');
      
      // Fix for body scrolling while modal is open
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      
      // Capture events on document to ensure modal stays interactive
      const handleDocumentClick = (e) => {
        // Check if the click is within our modal
        if (modalRef.current && !modalRef.current.contains(e.target)) {
          console.log('Document click outside modal detected');
        } else {
          console.log('Document click inside modal detected');
          // Allow the event to continue for modal contents
          e.stopPropagation();
        }
      };
      
      // Add debug listener to document
      document.addEventListener('click', handleDocumentClick, true);
      
      return () => {
        // Restore original body style
        document.body.style.overflow = originalStyle;
        // Remove the debug listener
        document.removeEventListener('click', handleDocumentClick, true);
        console.log('Modal is closed - cleaning up global fixes');
      };
    }
  }, [isOpen]);

  // Only render if modal is open
  if (!isOpen) return null;

  return createPortal(
    <div 
      className="modal-overlay" 
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10000,
        pointerEvents: 'auto'
      }}
    >
      <div 
        className="modal-container" 
        ref={modalRef} 
        onClick={handleModalClick}
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          width: '95%',
          maxWidth: '550px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 10001,
          pointerEvents: 'auto'
        }}
      >
        <div 
          className="modal-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '16px',
            borderBottom: '1px solid #eee',
            backgroundColor: 'white',
            flexShrink: 0
          }}
        >
          <h3 style={{ 
            margin: 0,
            maxWidth: 'calc(100% - 40px)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>Friends owning {collectionName}</h3>
          <div 
            className="modal-close-wrapper"
            style={{
              position: 'relative',
              width: '40px',
              height: '40px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 10020
            }}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              console.log('Close wrapper clicked');
              onClose();
            }}
          >
            <button 
              className="modal-close-button" 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                console.log('Close button clicked');
                onClose();
              }}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '24px',
                cursor: 'pointer',
                color: '#777',
                padding: '8px 12px',
                lineHeight: 1,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 10020,
                position: 'absolute',
                top: 0,
                right: 0,
                width: '100%',
                height: '100%'
              }}
              aria-label="Close modal"
            >
              ×
            </button>
          </div>
        </div>
        
        {loading ? (
          <div 
            className="modal-content"
            style={{
              padding: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              minHeight: '200px'
            }}
          >
            <div className="modal-loading">
              <div 
                className="spinner"
                style={{
                  border: '4px solid #f3f3f3',
                  borderTop: '4px solid #8b5cf6',
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  animation: 'spin 2s linear infinite',
                  marginBottom: '16px'
                }}
              ></div>
              <p>{fetchingFollowing ? 'Loading your Farcaster following...' : 'Checking for friends who own this collection...'}</p>
            </div>
          </div>
        ) : error ? (
          <div 
            className="modal-content"
            style={{
              padding: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              minHeight: '200px'
            }}
          >
            <div className="modal-error">
              <p>{error}</p>
              <button className="modal-close-btn" onClick={onClose}>Close</button>
            </div>
          </div>
        ) : !isUserAuthenticated ? (
          <div 
            className="modal-content"
            style={{
              padding: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              minHeight: '200px'
            }}
          >
            <div className="modal-auth-required">
              <p>Please connect with Farcaster to see friends who own this collection.</p>
              <button className="modal-close-btn" onClick={onClose}>Close</button>
            </div>
          </div>
        ) : friends.length === 0 ? (
          <div 
            className="modal-content"
            style={{
              padding: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              minHeight: '200px'
            }}
          >
            <div className="modal-no-friends">
              <p>No Collection Data Can Be Found For This Collection</p>
            </div>
          </div>
        ) : (
          <div 
            className="modal-content"
            onClick={(e) => {
              e.stopPropagation();
              console.log('Content area clicked, preventing close');
            }}
            style={{
              overflowY: 'auto',
              flex: 1,
              padding: 0,
              maxHeight: 'calc(80vh - 64px)',
              WebkitOverflowScrolling: 'touch', // For momentum scrolling on iOS
              zIndex: 10002,
              pointerEvents: 'auto',
              overflowX: 'hidden'
            }}
            onWheel={(e) => e.stopPropagation()}
          >
            {usingMockData && (
              <div 
                className="mock-data-disclaimer"
                style={{
                  backgroundColor: '#fff3cd',
                  color: '#856404',
                  padding: '8px 16px',
                  borderBottom: '1px solid #f5c6cb',
                  fontSize: '14px',
                  textAlign: 'center',
                  width: '100%'
                }}
              >
                Using sample data for demonstration purposes
              </div>
            )}
            <ul 
              className="friends-list"
              onClick={(e) => {
                e.stopPropagation();
                console.log('Friends list clicked, preventing close');
              }}
              style={{
                listStyle: 'none',
                margin: 0,
                padding: 0,
                width: '100%',
                overflowY: 'auto',
                zIndex: 10003,
                pointerEvents: 'auto'
              }}
            >
              {friends.map((friend) => (
                <li 
                  key={friend.id} 
                  className="friend-item"
                  onClick={(e) => {
                    e.stopPropagation();
                    console.log(`Friend ${friend.username} clicked, preventing close`);
                  }}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '48px 1fr',
                    gap: '12px',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderBottom: '1px solid #eee',
                    backgroundColor: 'white',
                    pointerEvents: 'auto',
                    cursor: 'default'
                  }}
                >
                  <div 
                    className="friend-avatar"
                    style={{
                      width: '48px',
                      height: '48px',
                      borderRadius: '50%',
                      overflow: 'hidden'
                    }}
                  >
                    {friend.avatar ? (
                      <img 
                        src={friend.avatar} 
                        alt={friend.name}
                        style={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover'
                        }}
                      />
                    ) : (
                      <div 
                        className="default-avatar"
                        style={{
                          width: '100%',
                          height: '100%',
                          backgroundColor: '#6c757d',
                          color: 'white',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '24px',
                          fontWeight: 'bold'
                        }}
                      >
                        {friend.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div 
                    className="friend-info"
                    style={{
                      overflow: 'hidden',
                      minWidth: 0
                    }}
                  >
                    <h4 style={{
                      margin: '0 0 4px 0',
                      fontSize: '16px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>{friend.name}</h4>
                    <p style={{
                      margin: 0,
                      fontSize: '14px',
                      color: '#6c757d',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>@{friend.username}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default CollectionFriendsModal; 