import React, { useState, useEffect } from 'react';
import zapperService from '../services/zapperService';
import NftGrid from './NFTGrid';
import '../styles/FarcasterUserSearch.css';

/**
 * Component for searching Farcaster users and displaying their NFTs
 * @param {Object} props - Component props
 * @param {string} props.initialUsername - Optional initial username to search for
 */
const FarcasterUserSearch = ({ initialUsername }) => {
  // Search state
  const [searchQuery, setSearchQuery] = useState(initialUsername || '');
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingNfts, setIsLoadingNfts] = useState(false);
  const [isLoadingMoreNfts, setIsLoadingMoreNfts] = useState(false);
  const [searchError, setSearchError] = useState(null);
  
  // User data state
  const [userProfile, setUserProfile] = useState(null);
  const [userNfts, setUserNfts] = useState([]);
  const [fetchNftsError, setFetchNftsError] = useState(null);
  
  // NFT Count state
  const [totalNftCount, setTotalNftCount] = useState(0);
  const [hasEstimatedCount, setHasEstimatedCount] = useState(false);
  
  // Pagination state
  const [hasMoreNfts, setHasMoreNfts] = useState(false);
  const [endCursor, setEndCursor] = useState(null);
  const [walletAddresses, setWalletAddresses] = useState([]);
  
  // UI state
  const [selectedNft, setSelectedNft] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [walletsExpanded, setWalletsExpanded] = useState(false);
  
  // Sorting state
  const [sortMethod, setSortMethod] = useState('value'); // Change default sort to value
  const [sortOrder, setSortOrder] = useState('desc'); // Default to descending order (highest first)
  
  // NFT filter state
  const [nftFilterText, setNftFilterText] = useState('');

  // Effect for initial search if username is provided
  useEffect(() => {
    if (initialUsername) {
      performSearch(initialUsername);
    }
  }, [initialUsername]);

  // Load all available NFTs with pagination
  const loadAllNfts = async () => {
    if (!userProfile?.addresses || userProfile.addresses.length === 0) {
      console.warn('No addresses available for loading NFTs');
      return;
    }
    
    console.log('LOADING ALL NFTS: Starting');
    setIsLoadingNfts(true);
    
    // Start with initial state
    let currentCursor = null;
    let hasMore = true;
    let allLoadedNfts = [...userNfts]; // Start with any existing NFTs
    let batchesProcessed = 0;
    let successfulLoads = 0;
    let failedAttempts = 0;
    const MAX_BATCHES = 10; // Maximum number of batches to fetch
    const MAX_FAILURES = 3; // Maximum consecutive failures before giving up
    
    try {
      // Continue fetching while there are more NFTs and we haven't hit max batches
      while (hasMore && batchesProcessed < MAX_BATCHES && failedAttempts < MAX_FAILURES) {
        console.log(`LOADING ALL NFTS: Batch ${batchesProcessed + 1}, cursor: ${currentCursor || 'initial'}`);
        
        // Use our improved fetchUserNfts function
        const result = await fetchUserNfts(userProfile.addresses, currentCursor, true);
        batchesProcessed++;
        
        if (!result) {
          console.warn(`LOADING ALL NFTS: Batch ${batchesProcessed} failed to load`);
          failedAttempts++;
          // Add delay when encountering errors
          await new Promise(resolve => setTimeout(resolve, 1000 * failedAttempts));
          continue;
        }
        
        // Reset failed attempts counter after a successful load
        failedAttempts = 0;
        successfulLoads++;
        
        // Update our tracking variables
        allLoadedNfts = result.nfts; // The function now returns the combined array
        hasMore = result.hasMore;
        currentCursor = result.cursor;
        
        console.log(`LOADING ALL NFTS: Batch ${batchesProcessed} loaded ${allLoadedNfts.length} NFTs total`);
        
        // If no more NFTs to load, break the loop
        if (!hasMore) {
          console.log('LOADING ALL NFTS: No more NFTs to load');
          break;
        }
        
        // Add a small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Final state update (should be unnecessary due to internal updates in fetchUserNfts, but for safety)
      setUserNfts(allLoadedNfts);
      setHasMoreNfts(hasMore);
      setEndCursor(currentCursor);
      
      // Log completion
      console.log(`LOADING ALL NFTS: Completed with ${batchesProcessed} batches, ${successfulLoads} successful, ${allLoadedNfts.length} NFTs loaded`);
    } catch (error) {
      console.error('Error in loadAllNfts:', error);
    } finally {
      setIsLoadingNfts(false);
      setIsLoadingMoreNfts(false);
    }
  };

  // Handle form submission
  const handleSearch = (e) => {
    e.preventDefault();
    performSearch(searchQuery);
  };

  // Add this method to better debug and handle wallet addresses
  const extractWalletAddresses = (profile) => {
    const addresses = [];
    
    // Log the full profile for debugging
    console.log('Raw profile data:', profile);
    
    // First check custody address - this should be a main address
    if (profile.custodyAddress) {
      console.log('Found custody address:', profile.custodyAddress);
      if (typeof profile.custodyAddress === 'string' && 
          profile.custodyAddress.startsWith('0x') && 
          profile.custodyAddress.length === 42) {
        addresses.push(profile.custodyAddress);
      }
    }
    
    // Then check connected addresses - this is the main array from Zapper API
    if (Array.isArray(profile.connectedAddresses)) {
      console.log(`Found ${profile.connectedAddresses.length} connected addresses:`, profile.connectedAddresses);
      
      // Filter out any non-ethereum addresses
      const ethAddresses = profile.connectedAddresses.filter(addr => 
        typeof addr === 'string' && addr.startsWith('0x') && addr.length === 42
      );
      
      addresses.push(...ethAddresses);
    }
    
    // Remove duplicates and convert to lowercase
    const uniqueAddresses = [...new Set(addresses.map(addr => addr.toLowerCase()))];
    console.log(`Extracted ${uniqueAddresses.length} unique Ethereum addresses`);
    
    return uniqueAddresses;
  };

  // Shared search logic extracted to a function
  const performSearch = async (query) => {
    if (!query.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    setUserProfile(null);
    setUserNfts([]);
    setFetchNftsError(null);
    setWalletsExpanded(false);
    setHasMoreNfts(false);
    setEndCursor(null);
    setWalletAddresses([]);
    setTotalNftCount(0);
    setHasEstimatedCount(false);

    try {
      console.log(`Searching for Farcaster user: ${query}`);
      
      // Clean username input by removing @ symbol if present and trim whitespace
      const cleanQuery = query.trim().replace(/^@/, '');
      
      // Add a slight delay to prevent rapid clicking issues on mobile
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Show mobile-friendly error for empty searches
      if (!cleanQuery) {
        setSearchError('Please enter a Farcaster username');
        setIsSearching(false);
        return;
      }
      
      // Fetch Farcaster profile using our improved zapperService method
      const profile = await zapperService.getFarcasterProfile(cleanQuery);
      
      // Set profile data in state when received
      setUserProfile(profile);
      console.log('Profile found:', profile);
      
      // Extract wallet addresses using our helper method
      const uniqueAddresses = extractWalletAddresses(profile);
      
      console.log(`Total unique addresses for ${profile.username}: ${uniqueAddresses.length}`);
      
      // If we have valid addresses, fetch NFTs
      if (uniqueAddresses.length > 0) {
        setWalletAddresses(uniqueAddresses);
        await fetchUserNfts(uniqueAddresses);
        
        // After initial fetch, start the aggressive loader to get all NFTs
        setTimeout(() => {
          loadAllNfts();
        }, 1000); // Slight delay to let UI update first
      } else {
        console.log('No addresses found for this user to fetch NFTs');
        setFetchNftsError('No wallet addresses found for this Farcaster user.');
      }
    } catch (error) {
      console.error('Error searching for user:', error);
      
      // Provide more specific error messages to help users
      if (error.message.includes('Could not find Farcaster profile') || error.message.includes('User not found')) {
        setSearchError(`Could not find a Farcaster profile for "${query}". Please check the username and try again.`);
      } else if (error.message.includes('Failed to fetch') || error.message.includes('Network request failed') || error.message.includes('Network error')) {
        setSearchError('Network error. Please check your internet connection and try again.');
      } else if (error.message.includes('timeout') || error.message.includes('Timeout')) {
        setSearchError('Request timed out. The server might be busy, please try again later.');
      } else {
        setSearchError(error.message || 'Failed to find Farcaster user. Please try again.');
      }
    } finally {
      setIsSearching(false);
    }
  };

  /**
   * Fetches NFTs for a list of addresses, with proper error handling and state updates
   * @param {Array<string>} addresses - List of Ethereum addresses to fetch NFTs for
   * @param {string|null} cursor - Pagination cursor for fetching more NFTs
   * @param {boolean} isLoadMore - Whether this is a "load more" operation or initial load
   * @returns {Object|null} - Object containing NFTs, cursor and hasMore flag, or null on error
   */
  const fetchUserNfts = async (addresses, cursor = null, isLoadMore = false) => {
    // Validate addresses
    if (!addresses || addresses.length === 0) {
      console.warn('fetchUserNfts called with no addresses');
      setIsLoadingNfts(false);
      setIsLoadingMoreNfts(false);
      return null;
    }

    // Set appropriate loading state
    if (isLoadMore) {
      setIsLoadingMoreNfts(true);
    } else {
      setIsLoadingNfts(true);
    }

    try {
      // Log the fetch attempt
      console.log(`Fetching NFTs for ${addresses.length} addresses, cursor: ${cursor || 'initial'}, loadMore: ${isLoadMore}`);
      
      // Fetch NFTs from the API
      const response = await zapperService.getNftsForAddresses(addresses, 50, cursor, true);
      
      // Log the response summary
      console.log(`Received ${response?.items?.length || response?.nfts?.length || 0} NFTs, hasMore: ${response?.hasMore}, cursor: ${response?.cursor}`);

      // Return early if no valid items array in response
      if (!response || (!response.items && !response.nfts)) {
        console.warn('No valid response or items from getNftsForAddresses');
        return null;
      }

      // Use either items or nfts from the response
      const nftsArray = response.items || response.nfts || [];
      
      // Filter out any invalid NFT objects
      // The API now returns objects with collection directly, not within a token property
      const validNfts = nftsArray.filter(nft => 
        nft && nft.collection && nft.collection.name);
      
      console.log(`Filtered to ${validNfts.length} valid NFTs`);

      // Update the state based on whether we're loading more or initial load
      let updatedNfts;
      if (isLoadMore) {
        // When loading more, append to existing NFTs
        updatedNfts = [...userNfts, ...validNfts];
      } else {
        // Initial load replaces existing NFTs
        updatedNfts = validNfts;
      }
      
      // Update the state
      setUserNfts(updatedNfts);
      setHasMoreNfts(response.hasMore);
      setEndCursor(response.cursor);

      // Return the result object for the caller
      return {
        nfts: updatedNfts,
        hasMore: response.hasMore,
        cursor: response.cursor
      };
    } catch (error) {
      console.error('Error in fetchUserNfts:', error);
      return null;
    } finally {
      // Reset loading states
      if (isLoadMore) {
        setIsLoadingMoreNfts(false);
      } else {
        setIsLoadingNfts(false);
      }
    }
  };
  
  // Helper to map network IDs to network names
  const getNetworkFromId = (networkId) => {
    if (!networkId) return 'ethereum';
    
    const networkMap = {
      1: 'ethereum',
      10: 'optimism',
      137: 'polygon',
      42161: 'arbitrum',
      8453: 'base'
    };
    
    return networkMap[networkId] || 'ethereum';
  };

  // Handle loading more NFTs
  const handleLoadMore = async () => {
    if (!hasMoreNfts || isLoadingMoreNfts || !walletAddresses.length) return;
    
    console.log(`Loading more NFTs with cursor: ${endCursor}`);
    
    try {
      // Track the current count before loading more
      const prevCount = userNfts.length;
      
      // Attempt to load the next batch
      await fetchUserNfts(walletAddresses, endCursor, true);
      
      // Check if we actually got more NFTs
      const newCount = userNfts.length;
      const loadedCount = newCount - prevCount;
      
      console.log(`Load more complete - Added ${loadedCount} NFTs (${prevCount} → ${newCount})`);
      
      // If we got no new NFTs but the API says there are more, it might be lying
      if (loadedCount === 0 && hasMoreNfts) {
        console.warn("No NFTs loaded but API claims there are more - forcing hasMoreNfts to false");
        setHasMoreNfts(false);
      }
    } catch (error) {
      console.error('Error loading more NFTs:', error);
      setFetchNftsError(`Failed to load more NFTs: ${error.message}`);
    }
  };
  
  // Auto-load NFTs until we reach a threshold or there are no more
  useEffect(() => {
    const autoLoadMoreNfts = async () => {
      // Only auto-load if:
      // 1. We have NFTs already (initial load complete)
      // 2. There are more NFTs to load
      // 3. Not already loading more
      // 4. We have less than 2000 NFTs loaded (higher limit to ensure we get all)
      if (userNfts.length > 0 && hasMoreNfts && !isLoadingMoreNfts && userNfts.length < 2000) {
        console.log(`AUTO-LOADING MORE NFTs - Currently have ${userNfts.length}, hasMore=${hasMoreNfts}`);
        // Add a small delay to avoid overwhelming the API and browser
        await new Promise(resolve => setTimeout(resolve, 500));
        await handleLoadMore();
      } else {
        console.log(`AUTO-LOAD CHECK: userNfts=${userNfts.length}, hasMore=${hasMoreNfts}, isLoading=${isLoadingMoreNfts}`);
      }
    };
    
    autoLoadMoreNfts();
  }, [userNfts, hasMoreNfts, isLoadingMoreNfts]);

  // Handle NFT click to open modal
  const handleNftClick = (nft) => {
    console.log('NFT clicked:', nft);
    setSelectedNft(nft);
    setIsModalOpen(true);
    setImageError(false);
  };

  // Handle image loading error in modal
  const handleImageError = () => {
    console.log('Image failed to load in NFT modal');
    setImageError(true);
  };

  // Toggle wallets dropdown
  const toggleWallets = () => {
    setWalletsExpanded(!walletsExpanded);
  };

  // Get wallet count
  const getWalletCount = () => {
    if (!userProfile) return 0;
    
    let count = 0;
    if (userProfile.connectedAddresses?.length) count += userProfile.connectedAddresses.length;
    if (userProfile.custodyAddress) count += 1;
    
    return count;
  };

  // Sort NFTs based on current sort method
  const getSortedNfts = () => {
    if (!userNfts || userNfts.length === 0) return [];
    
    console.log(`Sorting ${userNfts.length} NFTs using method: ${sortMethod}`);
    // Log a sample NFT to understand the data structure
    if (userNfts.length > 0) {
      console.log("Sample NFT for sorting:", userNfts[0]);
    }
    
    const sortedNfts = [...userNfts];
    
    switch (sortMethod) {
      case 'nameAsc': // A-Z by NFT name
        return sortedNfts.sort((a, b) => {
          const nameA = (a.name || a.tokenId || '').toLowerCase();
          const nameB = (b.name || b.tokenId || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });
        
      case 'collection': // By collection name
        return sortedNfts.sort((a, b) => {
          const collectionA = (a.collection?.name || '').toLowerCase();
          const collectionB = (b.collection?.name || '').toLowerCase();
          return collectionA.localeCompare(collectionB);
        });
        
      case 'value': // By value (highest first)
        console.log("Sorting by value...");
        return sortedNfts.sort((a, b) => {
          // Try to extract value from different possible formats
          const getValueFromNft = (nft) => {
            // Start with 0 as default
            let value = 0;
            let source = 'none';
            
            // Check for collection floor price (most reliable value)
            if (nft.collection?.floorPriceEth !== undefined && nft.collection.floorPriceEth !== null) {
              value = parseFloat(nft.collection.floorPriceEth);
              source = 'collection.floorPriceEth';
            } 
            // Check for valueEth (directly from API)
            else if (nft.valueEth !== undefined && nft.valueEth !== null) {
              value = parseFloat(nft.valueEth);
              source = 'valueEth';
            }
            // Check for estimatedValue (new API format)
            else if (nft.estimatedValue?.valueWithDenomination !== undefined) {
              value = parseFloat(nft.estimatedValue.valueWithDenomination);
              source = 'estimatedValue.valueWithDenomination';
            }
            // Check for lastSale (new API format)
            else if (nft.lastSaleValue !== undefined && nft.lastSaleValue !== null) {
              value = parseFloat(nft.lastSaleValue);
              source = 'lastSaleValue';
            }
            else if (nft.lastSale?.valueWithDenomination !== undefined) {
              value = parseFloat(nft.lastSale.valueWithDenomination);
              source = 'lastSale.valueWithDenomination';
            }
            
            // Ensure we have a valid number
            if (isNaN(value)) {
              value = 0;
            }
            
            // Only log the first few NFTs to avoid console flooding
            if (nft.id && nft.id.endsWith('0')) {
              console.log(`NFT ${nft.id?.substring(0, 10) || nft.tokenId}... value = ${value} (source: ${source})`);
            }
            
            return value;
          };
          
          const valueA = getValueFromNft(a);
          const valueB = getValueFromNft(b);
          
          // Sort descending (highest first)
          return valueB - valueA;
        });
        
      case 'recent': // By acquisition date (latest first)
        console.log("Sorting by recent...");
        return sortedNfts.sort((a, b) => {
          // Get timestamps with fallbacks to various possible sources
          const getTimestamp = (nft) => {
            let timestamp = 0;
            let source = 'none';
            
            // Try all possible timestamp fields in order of preference
            if (nft.ownedAt && typeof nft.ownedAt === 'number' && nft.ownedAt > 0) {
              timestamp = nft.ownedAt;
              source = 'ownedAt';
            } 
            else if (typeof nft.acquisitionTimestamp === 'number' && nft.acquisitionTimestamp > 0) {
              timestamp = nft.acquisitionTimestamp;
              source = 'acquisitionTimestamp';
            } 
            else if (typeof nft.latestTransferTimestamp === 'number' && nft.latestTransferTimestamp > 0) {
              timestamp = nft.latestTransferTimestamp;
              source = 'latestTransferTimestamp';
            } 
            else if (nft.balances && nft.balances.length > 0) {
              // Try to get timestamp from balances
              const latestBalance = nft.balances[0];
              if (latestBalance && latestBalance.acquiredAt) {
                timestamp = latestBalance.acquiredAt;
                source = 'balances.acquiredAt';
              }
            }
            
            // Only log the first few NFTs to avoid console flooding
            if (nft.id && nft.id.endsWith('0')) {
              console.log(`NFT ${nft.id?.substring(0, 10) || nft.tokenId}... timestamp = ${timestamp} (source: ${source})`);
              if (timestamp > 0) {
                console.log(` - Date: ${new Date(timestamp * 1000).toISOString()}`);
              }
            }
            
            return timestamp;
          };
          
          const timestampA = getTimestamp(a);
          const timestampB = getTimestamp(b);
          
          // Special case: If both are 0, sort by name as fallback
          if (timestampA === 0 && timestampB === 0) {
            const nameA = (a.name || '').toLowerCase();
            const nameB = (b.name || '').toLowerCase();
            return nameA.localeCompare(nameB);
          }
          
          // Special case: If only one has a timestamp, prioritize it
          if (timestampA === 0) return 1;  // B comes first
          if (timestampB === 0) return -1; // A comes first
          
          // Otherwise, sort descending (newest first)
          return timestampB - timestampA;
        });
        
      default:
        return sortedNfts;
    }
  };
  
  // Filter NFTs based on the filter text
  const getFilteredNfts = () => {
    const sortedNfts = getSortedNfts();
    
    if (!nftFilterText.trim()) {
      return sortedNfts; // Return all sorted NFTs if no filter text
    }
    
    const filterTextLower = nftFilterText.toLowerCase().trim();
    
    return sortedNfts.filter(nft => {
      // Get token name, defaulting to empty string if undefined
      const tokenName = (nft.name || nft.tokenId || '').toLowerCase();
      
      // Get collection name, defaulting to empty string if undefined
      const collectionName = (nft.collection?.name || '').toLowerCase();
      
      // Return true if either token name or collection name contains the filter text
      return tokenName.includes(filterTextLower) || collectionName.includes(filterTextLower);
    });
  };

  // Handle sort method change
  const handleSortChange = (method) => {
    console.log(`Changing sort method from ${sortMethod} to ${method}`);
    
    // Log a sample of NFTs before sorting to debug value issues
    if (method === 'value' && userNfts.length > 0) {
      console.log("SAMPLE VALUES BEFORE SORTING:");
      for (let i = 0; i < Math.min(5, userNfts.length); i++) {
        const nft = userNfts[i];
        console.log(`NFT ${i+1}: ${nft.name} - Values:`, {
          id: nft.id,
          tokenId: nft.tokenId,
          valueEth: nft.valueEth,
          collectionName: nft.collection?.name,
          collectionFloorPriceEth: nft.collection?.floorPriceEth,
          lastSaleValue: nft.lastSaleValue || nft.lastSale?.valueWithDenomination,
          estimatedValue: nft.estimatedValue?.valueWithDenomination
        });
      }
    }
    
    setSortMethod(method);
  };
  
  // Clear filter text
  const clearFilter = () => {
    setNftFilterText('');
  };

  // Log when NFT data changes
  useEffect(() => {
    console.log(`NFT state updated: ${userNfts.length} NFTs available, has more: ${hasMoreNfts}`);
  }, [userNfts, hasMoreNfts]);

  // Try to make a better estimate of total NFT count
  const estimateTotalNftCount = () => {
    if (hasEstimatedCount && totalNftCount > 0) {
      // We already have an estimate from the API
      return totalNftCount;
    }
    
    if (userNfts.length === 0) {
      return 0; // No NFTs loaded yet
    }
    
    // If we have loaded NFTs but no totalCount from API
    const walletCount = getWalletCount();
    
    // On Farcaster, users with 5+ wallets often have large collections (100+ NFTs)
    if (walletCount >= 5) {
      // For users with many wallets, be more aggressive with estimates
      return Math.max(
        userNfts.length * 3,
        Math.round(userNfts.length / walletCount) * walletCount * 5
      );
    } else if (walletCount >= 3) {
      // For users with several wallets
      return Math.max(
        userNfts.length * 2, 
        100 // Many Farcaster users have 100+ NFTs
      );
    } else if (walletCount === 2) {
      // For users with two wallets
      return userNfts.length * (hasMoreNfts ? 2 : 1.5);
    } else {
      // Just one wallet
      return userNfts.length * (hasMoreNfts ? 1.5 : 1.2);
    }
  };

  // Render component
  return (
    <div className="farcaster-user-search">
      {/* Search Form */}
      <form onSubmit={handleSearch} className="search-form">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Enter Farcaster username or FID"
          className="search-input"
          disabled={isSearching}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
        />
        <button 
          type="submit" 
          className="search-button"
          disabled={isSearching || !searchQuery.trim()}
        >
          Search
        </button>
      </form>
      
      {/* Loading or Error Messages */}
      {isSearching && <div className="loading-message">Searching...</div>}
      {searchError && <div className="error-message">{searchError}</div>}
      
      {/* User Profile */}
      {userProfile && (
        <div className="user-profile">
          <div className="profile-header">
            {userProfile.avatarUrl && (
              <img 
                src={userProfile.avatarUrl} 
                alt={`${userProfile.displayName || userProfile.username} avatar`}
                onError={(e) => { 
                  console.error('Profile avatar failed to load:', userProfile.avatarUrl);
                  e.target.src = 'https://via.placeholder.com/150?text=No+Image'; 
                }}
                className="profile-avatar"
              />
            )}
            <div className="profile-info">
              <h3 className="display-name">{userProfile.displayName || userProfile.username}</h3>
              <p className="username">
                <a 
                  href={`https://warpcast.com/${userProfile.username}`} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="warpcast-link"
                >
                  @{userProfile.username}
                </a> · FID: {userProfile.fid}
              </p>
              
              {/* NFT Count Display */}
              {!isLoadingNfts && userNfts.length > 0 && (
                <p className="nft-count">
                  <span className="nft-count-number" style={{ fontWeight: 'bold', fontSize: '18px' }}>
                    {hasMoreNfts ? (
                      <>
                        {userNfts.length}
                        <span className="nft-count-plus" style={{ color: '#7b3fe4', marginLeft: '1px' }}>+</span>
                      </>
                    ) : userNfts.length}
                  </span> 
                  <span className="nft-count-label" style={{ marginLeft: '4px' }}>NFTs</span>
                  {hasMoreNfts && 
                    <span className="nft-count-estimate" style={{ 
                      fontSize: '14px',
                      color: '#666',
                      marginLeft: '6px',
                      fontStyle: 'italic'
                    }}>
                      (loaded {userNfts.length} of {estimateTotalNftCount()})
                    </span>
                  }
                </p>
              )}
              {isLoadingNfts && (
                <p className="nft-count loading">
                  Loading NFTs...
                </p>
              )}
            </div>
          </div>
          
          {/* Connected Wallets Dropdown */}
          {(userProfile.connectedAddresses?.length > 0 || userProfile.custodyAddress) && (
            <div className="connected-wallets">
              <div 
                className="wallets-header" 
                onClick={toggleWallets}
              >
                <h4>
                  <span>Connected Wallets ({getWalletCount()})</span>
                  <span className={`dropdown-arrow ${walletsExpanded ? 'expanded' : ''}`}>▼</span>
                </h4>
              </div>
              
              {walletsExpanded && (
                <ul className="wallet-list">
                  {userProfile.connectedAddresses?.map((address, index) => (
                    <li key={index} className="wallet-item">
                      <span className="wallet-address">
                        {address.substring(0, 6)}...{address.substring(address.length - 4)}
                      </span>
                      <a 
                        href={`https://etherscan.io/address/${address}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="etherscan-link"
                      >
                        View on Etherscan
                      </a>
                    </li>
                  ))}
                  {userProfile.custodyAddress && (
                    <li className="wallet-item">
                      <span className="wallet-address custody">
                        {userProfile.custodyAddress.substring(0, 6)}...
                        {userProfile.custodyAddress.substring(userProfile.custodyAddress.length - 4)}
                        <span className="custody-label">(Custody)</span>
                      </span>
                      <a 
                        href={`https://etherscan.io/address/${userProfile.custodyAddress}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="etherscan-link"
                      >
                        View on Etherscan
                      </a>
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* Debug Info */}
      {process.env.NODE_ENV === 'development' && userProfile && (
        <div className="debug-info" style={{margin: '10px 0', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px'}}>
          <h4>Debug Info:</h4>
          <p>Loading NFTs: {isLoadingNfts ? 'Yes' : 'No'}</p>
          <p>Loading More NFTs: {isLoadingMoreNfts ? 'Yes' : 'No'}</p>
          <p>NFT Count: {userNfts.length}</p>
          <p>Has More NFTs: {hasMoreNfts ? 'Yes' : 'No'}</p>
          <p>End Cursor: {endCursor || 'None'}</p>
          <p>Connected Addresses: {userProfile.connectedAddresses?.length || 0}</p>
          <p>Has Custody Address: {userProfile.custodyAddress ? 'Yes' : 'No'}</p>
        </div>
      )}

      {/* Fetch NFTs Error Message */}
      {fetchNftsError && (
        <div className="error-message">
          <p>{fetchNftsError}</p>
        </div>
      )}

      {/* NFT Grid */}
      {userProfile && (
        <div className="nft-section">
          {/* NFT Filter Search Bar */}
          <div className="nft-filter-container">
            <div className="nft-search-bar">
              <input
                type="text"
                value={nftFilterText}
                onChange={(e) => setNftFilterText(e.target.value)}
                placeholder="Search by NFT or collection name"
                className="nft-filter-input"
                style={{ fontFamily: "'Comic Sans MS', 'Comic Sans', sans-serif", fontStyle: "normal" }}
              />
              {nftFilterText && (
                <button 
                  onClick={clearFilter}
                  className="nft-filter-clear"
                  style={{ fontFamily: "'Comic Sans MS', 'Comic Sans', sans-serif", fontStyle: "normal" }}
                >
                  ×
                </button>
              )}
            </div>
            <div className="sort-options">
              <button 
                className={`sort-option ${sortMethod === 'recent' ? 'active' : ''}`}
                onClick={() => handleSortChange('recent')}
                style={{ fontFamily: "'Comic Sans MS', 'Comic Sans', sans-serif", fontStyle: "normal" }}
              >
                Recent
              </button>
              <button 
                className={`sort-option ${sortMethod === 'nameAsc' ? 'active' : ''}`}
                onClick={() => handleSortChange('nameAsc')}
                style={{ fontFamily: "'Comic Sans MS', 'Comic Sans', sans-serif", fontStyle: "normal" }}
              >
                A-Z
              </button>
              <button 
                className={`sort-option ${sortMethod === 'collection' ? 'active' : ''}`}
                onClick={() => handleSortChange('collection')}
                style={{ fontFamily: "'Comic Sans MS', 'Comic Sans', sans-serif", fontStyle: "normal" }}
              >
                Collection
              </button>
              <button 
                className={`sort-option ${sortMethod === 'value' ? 'active' : ''}`}
                onClick={() => handleSortChange('value')}
                style={{ fontFamily: "'Comic Sans MS', 'Comic Sans', sans-serif", fontStyle: "normal" }}
              >
                Value
              </button>
            </div>
          </div>
          
          {/* Filtered Results Count */}
          {nftFilterText && userNfts.length > 0 && (
            <div className="filter-results-count">
              Found {getFilteredNfts().length} of {userNfts.length} NFTs
            </div>
          )}
          
          <NftGrid 
            nfts={getFilteredNfts()} 
            onNftClick={handleNftClick} 
            loading={isLoadingNfts} 
            emptyMessage={
              (!userProfile.connectedAddresses?.length && !userProfile.custodyAddress)
                ? "This user has no connected wallets to display NFTs from." 
                : isLoadingNfts 
                  ? "Loading NFTs..." 
                  : nftFilterText && getFilteredNfts().length === 0
                    ? `No NFTs found matching "${nftFilterText}"`
                    : "No NFTs found for this user's wallets."
            }
          />
          
          {/* Load More Button */}
          {hasMoreNfts && userNfts.length > 0 && (
            <div className="load-more-container" style={{ 
              marginTop: '20px', 
              textAlign: 'center', 
              padding: '15px', 
              backgroundColor: '#f9f6ff',
              borderRadius: '12px'
            }}>
              <button 
                className="load-more-button"
                onClick={loadAllNfts}
                disabled={isLoadingMoreNfts}
                style={{
                  backgroundColor: '#7b3fe4',
                  color: 'white',
                  border: 'none',
                  padding: '12px 30px',
                  borderRadius: '8px',
                  fontWeight: 'bold',
                  fontSize: '16px',
                  cursor: 'pointer'
                }}
              >
                {isLoadingMoreNfts ? 'Loading...' : `Load More NFTs (${userNfts.length} loaded so far)`}
              </button>
              <p className="text-sm text-gray-600 mt-3" style={{ fontSize: '14px' }}>
                <strong>Note:</strong> Zapper API loads NFTs in batches of 100. Click the button above to load more NFTs.
              </p>
              <p className="text-xs text-gray-500 mt-1" style={{ fontSize: '12px' }}>
                You currently have {userNfts.length} NFTs loaded{hasMoreNfts ? ', but there are more available' : ''}.
              </p>
            </div>
          )}
          
          {/* Loading More Indicator */}
          {isLoadingMoreNfts && (
            <div className="loading-more">
              <div className="loading-spinner-small"></div>
              <p>Loading more NFTs...</p>
            </div>
          )}
        </div>
      )}

      {/* NFT Detail Modal */}
      {isModalOpen && selectedNft && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setIsModalOpen(false)}>×</button>
            
            <h3>{selectedNft.name || 'Unnamed NFT'}</h3>
            
            {!imageError ? (
              <img 
                src={selectedNft.imageUrl} 
                alt={selectedNft.name || 'NFT'} 
                className="modal-image"
                onError={handleImageError}
              />
            ) : (
              <div className="image-placeholder">Image unavailable</div>
            )}
            
            <div className="nft-details">
              {selectedNft.collection && (
                <p><strong>Collection:</strong> {selectedNft.collection.name}</p>
              )}
              <p><strong>Token ID:</strong> {selectedNft.tokenId}</p>
              {selectedNft.valueEth && (
                <p><strong>Estimated Value:</strong> {parseFloat(selectedNft.valueEth).toFixed(4)} ETH</p>
              )}
              {selectedNft.collection?.floorPriceEth && (
                <p><strong>Floor Price:</strong> {parseFloat(selectedNft.collection.floorPriceEth).toFixed(4)} ETH</p>
              )}
              {selectedNft.description && (
                <div className="nft-description">
                  <h4>Description:</h4>
                  <p>{selectedNft.description}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FarcasterUserSearch; 