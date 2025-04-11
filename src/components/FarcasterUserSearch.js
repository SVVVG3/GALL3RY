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
  const [sortMethod, setSortMethod] = useState('recent'); // Default sort by most recent
  
  // NFT filter state
  const [nftFilterText, setNftFilterText] = useState('');

  // Effect for initial search if username is provided
  useEffect(() => {
    if (initialUsername) {
      performSearch(initialUsername);
    }
  }, [initialUsername]);

  // Handle form submission
  const handleSearch = (e) => {
    e.preventDefault();
    performSearch(searchQuery);
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
      
      // Fetch the profile
      const profile = await zapperService.getFarcasterProfile(cleanQuery);
      
      // Set profile data in state immediately when received
      setUserProfile(profile);
      console.log('Profile found:', profile);
      
      // If profile found, fetch their NFTs
      if (profile) {
        // Collect all available addresses
        const addresses = [
          ...(profile.connectedAddresses || []),
          ...(profile.custodyAddress ? [profile.custodyAddress] : [])
        ].filter(Boolean);
        
        // Prevent concurrent fetches - important for mobile
        if (addresses.length > 0) {
          setWalletAddresses(addresses);
          await fetchUserNfts(addresses);
        } else {
          console.log('No addresses found for this user to fetch NFTs');
        }
      }
    } catch (error) {
      console.error('Error searching for user:', error);
      
      // Provide more specific error messages to help users
      if (error.message.includes('Could not find Farcaster profile')) {
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

  // Fetch NFTs for the user
  const fetchUserNfts = async (addresses, cursor = null, loadMore = false) => {
    if (loadMore) {
      setIsLoadingMoreNfts(true);
    } else {
      setIsLoadingNfts(true);
      setTotalNftCount(0);
      setHasEstimatedCount(false);
    }
    
    setFetchNftsError(null);
    
    try {
      console.log(`Fetching NFTs for ${addresses.length} wallet addresses:`, addresses);
      console.log(loadMore ? 'Loading more NFTs from cursor: ' + cursor : 'Initial NFT load');
      
      // First try using the old schema which we know works with the Zapper API
      const query = `
        query NftUsersTokens($owners: [Address!]!, $first: Int, $after: String, $withOverrides: Boolean) {
          nftUsersTokens(
            owners: $owners
            first: $first
            after: $after
            withOverrides: $withOverrides
          ) {
            edges {
              node {
                id
                name
                tokenId
                description
                mediasV2 {
                  ... on Image {
                    url
                    originalUri
                    original
                  }
                  ... on Animation {
                    url
                    originalUri
                    original
                  }
                }
                collection {
                  id
                  name
                  floorPriceEth
                  cardImageUrl
                }
                transfers {
                  edges {
                    node {
                      timestamp
                      from
                      to
                    }
                  }
                }
              }
              cursor
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `;
      
      // Try the raw API call through our server
      try {
        const response = await fetch(`/api/zapper`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query,
            variables: { 
              owners: addresses,
              first: 100, // Increased batch size for better performance
              after: cursor,
              withOverrides: true
            }
          })
        });
        
        if (!response.ok) {
          console.error('Direct API call failed:', response.status);
          throw new Error(`API call failed with status: ${response.status}`);
        }
        
        const responseData = await response.json();
        
        if (responseData.errors) {
          console.error('GraphQL errors:', responseData.errors);
          throw new Error(`GraphQL errors: ${JSON.stringify(responseData.errors)}`);
        }
        
        // Check for both possible response formats
        let nftData = null;
        let edges = [];
        let pageInfo = {};
        
        // First check for nftUsersTokens format
        if (responseData.data?.nftUsersTokens) {
          nftData = responseData.data.nftUsersTokens;
          edges = nftData.edges || [];
          pageInfo = nftData.pageInfo || {};
          
          console.log(`Found ${edges.length} NFTs via nftUsersTokens format`);
          console.log(`Page info: hasNextPage=${pageInfo.hasNextPage}, endCursor=${pageInfo.endCursor}`);
          
          // Process edges to create NFTs
          const processedNfts = edges.map(edge => {
            const nft = edge.node;
            if (!nft) return null;
            
            // Get image URL
            let imageUrl = null;
            
            // Try media URLs in order of preference
            if (nft.mediasV2 && nft.mediasV2.length > 0) {
              // Look for image URL in mediasV2
              for (const media of nft.mediasV2) {
                if (!media) continue;
                
                // Try each possible field in order of preference
                if (media.original && typeof media.original === 'string' && media.original.startsWith('http')) {
                  imageUrl = media.original;
                  break;
                } else if (media.originalUri && typeof media.originalUri === 'string' && media.originalUri.startsWith('http')) {
                  imageUrl = media.originalUri;
                  break;
                } else if (media.url && typeof media.url === 'string' && media.url.startsWith('http')) {
                  imageUrl = media.url;
                  break;
                }
              }
            }
            
            // Process the transfer timestamp data
            let latestTransferTimestamp = null;
            if (nft.transfers && nft.transfers.edges && nft.transfers.edges.length > 0) {
              // Try to extract timestamps from transfers
              const timestamps = nft.transfers.edges
                .filter(edge => edge.node && typeof edge.node.timestamp === 'number')
                .map(edge => edge.node.timestamp);
              
              if (timestamps.length > 0) {
                latestTransferTimestamp = Math.max(...timestamps);
                console.log(`NFT ${nft.id} (${nft.name}) has transfer timestamp: ${new Date(latestTransferTimestamp * 1000).toISOString()}`);
              }
            } else {
              // If no transfer data, use a heuristic based on tokenId
              // Newer NFTs in a collection often have higher tokenIds
              const tokenIdNum = parseInt(nft.tokenId, 10);
              if (!isNaN(tokenIdNum)) {
                // Create a pseudo-timestamp from tokenId (just for relative sorting)
                latestTransferTimestamp = tokenIdNum;
                console.log(`NFT ${nft.id} (${nft.name}) using tokenId for sort: ${tokenIdNum}`);
              }
            }
            
            // Default fallback image (important for mobile UX)
            if (!imageUrl) {
              if (nft.collection?.cardImageUrl) {
                imageUrl = nft.collection.cardImageUrl;
              } else {
                imageUrl = 'https://via.placeholder.com/500?text=No+Image';
              }
            }
            
            // Extract contract address from collection ID if available
            let contractAddress = null;
            let networkId = 1; // Default to Ethereum
            
            if (nft.collection?.id) {
              const parts = nft.collection.id.split(':');
              if (parts.length > 1) {
                contractAddress = parts[1];
                
                // Determine network from collection ID
                const network = parts[0].toLowerCase();
                if (network.includes('polygon')) networkId = 137;
                else if (network.includes('optimism')) networkId = 10;
                else if (network.includes('arbitrum')) networkId = 42161;
                else if (network.includes('base')) networkId = 8453;
              }
            }
            
            // Create a normalized NFT object with consistent properties
            return {
              id: nft.id,
              name: nft.name || `NFT #${nft.tokenId}`,
              tokenId: nft.tokenId,
              description: nft.description,
              imageUrl,
              collection: nft.collection ? {
                id: nft.collection.id,
                name: nft.collection.name || 'Unknown Collection',
                floorPriceEth: nft.collection.floorPriceEth || 0,
                cardImageUrl: nft.collection.cardImageUrl
              } : null,
              token: {
                id: nft.id,
                tokenId: nft.tokenId,
                name: nft.name || `NFT #${nft.tokenId}`,
                contractAddress,
                networkId
              },
              estimatedValue: {
                value: nft.collection?.floorPriceEth || 0,
                token: { symbol: 'ETH' }
              },
              // Additional metadata for compatibility
              metadata: {
                name: nft.name,
                description: nft.description,
                image: imageUrl
              },
              latestTransferTimestamp
            };
          }).filter(Boolean);
          
          // Update pagination state
          setHasMoreNfts(pageInfo.hasNextPage);
          setEndCursor(pageInfo.endCursor);
          
          // Update total count - estimate based on edges length and hasNextPage
          const estimatedCount = processedNfts.length + (pageInfo.hasNextPage ? 100 : 0);
          setTotalNftCount(estimatedCount);
          setHasEstimatedCount(true);
          
          // Update the NFT state
          if (loadMore) {
            setUserNfts(prevNfts => [...prevNfts, ...processedNfts]);
          } else {
            setUserNfts(processedNfts);
          }
          
          return; // Early return if successful
        } 
        // Check for nfts format
        else if (responseData.data?.nfts?.items) {
          const items = responseData.data.nfts.items || [];
          console.log(`Found ${items.length} NFTs via nfts format`);
          
          // Process items
          const processedNfts = items.map(nft => {
            return {
              id: nft.id || nft.token?.id,
              name: nft.name || nft.token?.name || nft.metadata?.name || `#${nft.tokenId || nft.token?.tokenId}`,
              tokenId: nft.tokenId || nft.token?.tokenId,
              description: nft.metadata?.description || '',
              imageUrl: nft.imageUrl || nft.metadata?.image || nft.collection?.imageUrl,
              collection: {
                id: nft.collection?.id,
                name: nft.collection?.name || nft.token?.symbol || 'Unknown Collection',
                floorPriceEth: nft.collection?.floorPrice?.value,
                cardImageUrl: nft.collection?.imageUrl
              },
              estimatedValue: nft.estimatedValue
            };
          }).filter(item => item.id && item.imageUrl);
          
          console.log(`Processed ${processedNfts.length} valid NFTs`);
          
          // For now, we'll assume no more NFTs with this format
          setHasMoreNfts(false);
          setEndCursor(null);
          
          // Update total count
          setTotalNftCount(processedNfts.length);
          setHasEstimatedCount(true);
          
          // Update the NFT state
          if (loadMore) {
            setUserNfts(prevNfts => [...prevNfts, ...processedNfts]);
          } else {
            setUserNfts(processedNfts);
          }
          
          return; // Early return if successful
        } else {
          console.error('Invalid response format:', responseData);
          throw new Error('Invalid response format: missing NFT data');
        }
      } catch (directError) {
        console.error('Direct API call failed:', directError.message);
      }
      
      // Fall back to zapperService method if direct call fails
      console.log('Falling back to zapperService method...');
      const result = await zapperService.getNftsForAddresses(addresses);
      
      if (!result || !result.nfts) {
        throw new Error('Failed to fetch NFTs: empty response');
      }
      
      const nfts = result.nfts;
      console.log(`Fetched ${nfts.length} NFTs via fallback method`);
      
      // Update the NFT state
      if (loadMore) {
        setUserNfts(prevNfts => [...prevNfts, ...nfts]);
      } else {
        setUserNfts(nfts);
      }
      
      // For now, we'll assume no more NFTs with basic implementation
      setHasMoreNfts(false);
      setEndCursor(null);
      
      // Update total count
      setTotalNftCount(nfts.length);
      setHasEstimatedCount(true);
      
    } catch (error) {
      console.error(loadMore ? 'Error loading more NFTs:' : 'Error fetching NFTs:', error);
      
      if (loadMore) {
        setFetchNftsError('Failed to load more NFTs. Please try again.');
      } else {
        setFetchNftsError(
          error.message.includes('API call failed') 
            ? 'Error connecting to NFT data service. Please try again later.'
            : error.message || 'Failed to fetch NFTs. Please try again.'
        );
      }
      
    } finally {
      if (loadMore) {
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
    if (isLoadingMoreNfts || !hasMoreNfts || !endCursor || walletAddresses.length === 0) {
      return;
    }
    
    await fetchUserNfts(walletAddresses, endCursor, true);
    
    // Update our estimate as we load more
    if (!hasEstimatedCount) {
      const newEstimate = estimateTotalNftCount();
      setTotalNftCount(newEstimate);
      setHasEstimatedCount(true);
    } else {
      // If we already have an estimate, make sure it's at least as big as what we've loaded
      // plus a bit more if there are likely more NFTs
      setTotalNftCount(prev => {
        const minCount = userNfts.length + (hasMoreNfts ? Math.min(userNfts.length, 100) : 0);
        return Math.max(prev, minCount);
      });
    }
    
    // If we've loaded exactly 100 NFTs (API limit), we likely need to be more aggressive with count
    if (userNfts.length === 100 && totalNftCount === 100) {
      // This is probably an API limit, not the actual total
      setTotalNftCount(getWalletCount() >= 3 ? 250 : 150);
    }
  };

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
    
    const sortedNfts = [...userNfts];
    
    switch (sortMethod) {
      case 'nameAsc': // A-Z by NFT name
        return sortedNfts.sort((a, b) => {
          const nameA = (a.name || a.metadata?.name || a.token_id || '').toLowerCase();
          const nameB = (b.name || b.metadata?.name || b.token_id || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });
        
      case 'collection': // By collection name
        return sortedNfts.sort((a, b) => {
          const collectionA = (a.collection?.name || a.contract_name || '').toLowerCase();
          const collectionB = (b.collection?.name || b.contract_name || '').toLowerCase();
          return collectionA.localeCompare(collectionB);
        });
        
      case 'value': // By value (highest first)
        return sortedNfts.sort((a, b) => {
          const valueA = a.estimatedValueEth || a.collection?.floorPriceEth || 0;
          const valueB = b.estimatedValueEth || b.collection?.floorPriceEth || 0;
          return valueB - valueA; // Sort descending (highest first)
        });
        
      case 'recent': // By most recent transfer (latest first)
        return sortedNfts.sort((a, b) => {
          // First check for actual timestamp data
          const hasTimestampA = typeof a.latestTransferTimestamp === 'number' && a.latestTransferTimestamp > 0;
          const hasTimestampB = typeof b.latestTransferTimestamp === 'number' && b.latestTransferTimestamp > 0;
          
          // If both have timestamps, compare them
          if (hasTimestampA && hasTimestampB) {
            return b.latestTransferTimestamp - a.latestTransferTimestamp;
          }
          
          // If only one has a timestamp, prioritize it
          if (hasTimestampA) return -1;
          if (hasTimestampB) return 1;
          
          // If neither has a timestamp, try to compare by tokenId (newer NFTs often have higher tokenIds)
          const tokenIdA = parseInt(a.tokenId || '0', 10);
          const tokenIdB = parseInt(b.tokenId || '0', 10);
          
          if (!isNaN(tokenIdA) && !isNaN(tokenIdB)) {
            return tokenIdB - tokenIdA; // Higher tokenId is likely more recent
          }
          
          // If all else fails, sort by collection name and then token name
          const collectionA = (a.collection?.name || '').toLowerCase();
          const collectionB = (b.collection?.name || '').toLowerCase();
          
          if (collectionA !== collectionB) {
            return collectionA.localeCompare(collectionB);
          }
          
          const nameA = (a.name || '').toLowerCase();
          const nameB = (b.name || '').toLowerCase();
          return nameA.localeCompare(nameB);
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
      const tokenName = (nft.name || nft.metadata?.name || '').toLowerCase();
      
      // Get collection name, defaulting to empty string if undefined
      const collectionName = (nft.collection?.name || nft.contract_name || '').toLowerCase();
      
      // Return true if either token name or collection name contains the filter text
      return tokenName.includes(filterTextLower) || collectionName.includes(filterTextLower);
    });
  };

  // Handle sort method change
  const handleSortChange = (method) => {
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
                  <span className="nft-count-number">
                    {hasEstimatedCount ? totalNftCount : (hasMoreNfts ? estimateTotalNftCount() : userNfts.length)}
                    {(hasMoreNfts || totalNftCount > userNfts.length) && <span className="nft-count-plus">+</span>}
                  </span> 
                  <span className="nft-count-label">NFTs</span>
                  {(hasMoreNfts || totalNftCount > userNfts.length) && 
                    <span className="nft-count-estimate">{hasEstimatedCount ? "(est.)" : `(${userNfts.length} loaded)`}</span>}
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
          {hasMoreNfts && userNfts.length > 0 && !nftFilterText && (
            <div className="load-more-container">
              <button 
                className="load-more-button"
                onClick={handleLoadMore}
                disabled={isLoadingMoreNfts}
              >
                {isLoadingMoreNfts ? 'Loading...' : 'Load More NFTs'}
              </button>
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
              <p><strong>Token ID:</strong> {selectedNft.tokenId || selectedNft.token_id}</p>
              {selectedNft.estimatedValueEth && (
                <p><strong>Estimated Value:</strong> {selectedNft.estimatedValueEth.toFixed(4)} ETH</p>
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