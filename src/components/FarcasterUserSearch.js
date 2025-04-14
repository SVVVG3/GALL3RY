import React, { useState, useEffect } from 'react';
// Import services directly
import { getFarcasterProfile } from '../services/zapperService';
import directAlchemyService from '../services/directAlchemy';
import { useNFT } from '../contexts/NFTContext';
import NftGrid from './NFTGrid';
import '../styles/FarcasterUserSearch.css';
import { useNavigate } from 'react-router-dom';

// Error boundary for handling API initialization issues
class FarcasterErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Farcaster component error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="farcaster-error">
          <h3>Something went wrong loading Farcaster data</h3>
          <p>{this.state.error?.message || "Unknown error"}</p>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Component for searching Farcaster users and displaying their NFTs
 * @param {Object} props - Component props
 * @param {string} props.initialUsername - Optional initial username to search for
 */
const FarcasterUserSearch = ({ initialUsername }) => {
  // Get NFT context functions
  const { isLoading: isContextLoading } = useNFT();
  
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
  const [sortMethod, setSortMethod] = useState('value'); // Default sort by value
  const [sortOrder, setSortOrder] = useState('desc'); // Default to descending order
  
  // NFT filter state
  const [nftFilterText, setNftFilterText] = useState('');

  const navigate = useNavigate();

  // Effect for initial search if username is provided
  useEffect(() => {
    if (initialUsername) {
      handleSearch({ preventDefault: () => {} });
    }
  }, [initialUsername]);

  // Handle form submission
  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!searchQuery.trim()) return;

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
      console.log(`Searching for Farcaster user: ${searchQuery}`);
      
      // Clear the NFT cache when a new search is performed
      setUserNfts([]);
      setWalletAddresses([]);
      setHasMoreNfts(true);
      setEndCursor(null);
      
      // Try to find the Farcaster profile
      const profile = await getFarcasterProfile(searchQuery);
      console.log('Farcaster profile:', profile);
      
      if (!profile) {
        throw new Error('Profile not found');
      }
      
      // Handle different profile data structures correctly
      let addresses = [];
      
      // Add custody address if it exists
      if (profile.custodyAddress) {
        addresses.push(profile.custodyAddress);
      }
      
      // Add connected addresses if they exist
      if (profile.connectedAddresses && profile.connectedAddresses.length > 0) {
        addresses = [...addresses, ...profile.connectedAddresses];
      }
      
      // Filter out duplicates
      addresses = [...new Set(addresses)];
      
      setUserProfile(profile);
      setWalletAddresses(addresses);
      
      // Set wallets to check for NFTs
      if (addresses.length > 0) {
        await fetchUserNfts(searchQuery, profile);
      } else {
        setFetchNftsError('No wallet addresses found for this user');
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchError(error.message || 'Failed to find user');
    } finally {
      setIsSearching(false);
    }
  };

  // Fetch user NFTs
  const fetchUserNfts = async (username, profile) => {
    const addresses = walletAddresses || [];
    if (!addresses || addresses.length === 0) {
      console.error(`No Ethereum addresses found for ${username}`);
      setFetchNftsError('No wallet addresses found for this user');
      return;
    }
    
    setIsLoadingNfts(true);
    
    try {
      console.log(`Fetching NFTs for ${addresses.length} addresses`);
      
      // Use the Alchemy API to fetch NFTs - using direct service to avoid circular dependencies
      const result = await directAlchemyService.batchFetchNFTs(addresses, 'eth', {
        withMetadata: true,
        excludeSpam: true,
        pageKey: endCursor,
        pageSize: 24
      });
      
      console.log(`Fetched ${result.nfts.length} NFTs`);
      
      // Set NFTs and pagination info
      setUserNfts(prev => [...prev, ...result.nfts]);
      setHasMoreNfts(result.hasMore);
      setEndCursor(result.pageKey);
      setTotalNftCount(result.totalCount || 0);
      
      return result;
    } catch (error) {
      console.error('Error fetching NFTs:', error);
      setFetchNftsError(error.message || 'Failed to fetch NFTs');
      return { nfts: [], hasMore: false };
    } finally {
      setIsLoadingNfts(false);
    }
  };

  // Load more NFTs
  const handleLoadMore = async () => {
    if (isLoadingMoreNfts || !hasMoreNfts) return;
    
    setIsLoadingMoreNfts(true);
    
    try {
      await fetchUserNfts(searchQuery, userProfile);
    } catch (error) {
      console.error('Error loading more NFTs:', error);
    } finally {
      setIsLoadingMoreNfts(false);
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

  // Profile section
  const getProfileImageUrl = (profile) => {
    // Debug logging to understand the profile structure
    console.log('Profile image data:', {
      metadata: profile?.metadata,
      imageUrl: profile?.metadata?.imageUrl,
      pfp: profile?.pfp,
      pfpUrl: profile?.pfp?.url
    });
    
    // Try different sources for the profile image in order of preference
    
    // 1. First try metadata.imageUrl from Farcaster API (most reliable source)
    if (profile?.metadata?.imageUrl && typeof profile.metadata.imageUrl === 'string') {
      return profile.metadata.imageUrl;
    }
    
    // 2. Then try the pfp.url object format
    if (profile?.pfp?.url && typeof profile.pfp.url === 'string') {
      return profile.pfp.url;
    }
    
    // 3. Try the pfp as a direct string
    if (typeof profile?.pfp === 'string' && profile.pfp.startsWith('http')) {
      return profile.pfp;
    }
    
    // 4. Try the avatarUrl property if available
    if (profile?.avatarUrl && typeof profile.avatarUrl === 'string') {
      return profile.avatarUrl;
    }
    
    // 5. Try the displayImageUrl if available
    if (profile?.displayImageUrl && typeof profile.displayImageUrl === 'string') {
      return profile.displayImageUrl;
    }
    
    // Default placeholder for Farcaster users
    return 'https://warpcast.com/~/icon-512.png';
  };

  const onProfileSelected = async (profile) => {
    // Use a safe username cleaning function
    const cleanUsername = (username) => username?.trim().replace(/^@/, '') || '';
    
    const cleanQuery = cleanUsername(profile.username);
    setUserProfile(profile);
    
    // Define these state setters if they don't exist
    // Or simply remove them if not needed in this component
    // setUniqueUserAddresses(null);
    
    // Reset state
    // setCurrentPage('nfts');
    setUserNfts([]);
    setFetchNftsError(null);
    setHasMoreNfts(false);
    setEndCursor(null);
    setIsLoadingNfts(true);
    
    // Refresh the URL to show the selected username
    navigate(`/user/${cleanQuery}`);
    
    // Normalize and deduplicate addresses across all profiles
    try {
      // Extract and normalize addresses from multiple sources
      let uniqueAddresses = [];
      
      if (profile.addresses && profile.addresses.length > 0) {
        uniqueAddresses = [...new Set(profile.addresses.map(addr => addr.toLowerCase()))];
        console.log(`Found ${uniqueAddresses.length} addresses for ${profile.username}`);
      } else {
        console.log(`No addresses found for ${profile.username}`);
      }
      
      // setUniqueUserAddresses(uniqueAddresses);
      
      // If we have addresses, fetch NFTs
      if (uniqueAddresses.length > 0) {
        setWalletAddresses(uniqueAddresses);
        await fetchUserNfts(cleanQuery, profile);
        
        // After initial fetch, start the aggressive loader to get all NFTs
        setTimeout(() => {
          loadAllNfts(cleanQuery, profile);
        }, 1000); // Slight delay to let UI update first
      } else {
        setIsLoadingNfts(false);
        setFetchNftsError('No wallet addresses found for this user');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      setIsLoadingNfts(false);
      setFetchNftsError(`Error: ${error.message}`);
    }
  };

  return (
    <div className="farcaster-search-container">
      <div className="search-header">
        <h1>Search Farcaster Users</h1>
        <p>Enter a Farcaster username to explore their NFT collection</p>
      </div>
      
      <form onSubmit={handleSearch} className="search-form">
        <div className="search-input-container">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Enter Farcaster username (e.g. dwr, vitalik)"
            className="search-input"
            aria-label="Farcaster username"
            disabled={isSearching}
          />
          <button 
            type="submit"
            className="search-button"
            disabled={!searchQuery.trim() || isSearching}
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>
      
      {searchError && (
        <div className="error-message">
          <p>{searchError}</p>
        </div>
      )}
      
      {userProfile && (
        <div className="user-profile">
          <div className="profile-info">
            <div className="profile-image">
              {userProfile.metadata?.imageUrl ? (
                <img 
                  src={userProfile.metadata.imageUrl} 
                  alt={`${userProfile.username}'s profile`} 
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = '/assets/placeholder-profile.png';
                  }}
                />
              ) : (
                <img src="/assets/placeholder-profile.png" alt="Default profile" />
              )}
            </div>
            <div className="profile-details">
              <h2>@{userProfile.username}</h2>
              <p className="display-name">{userProfile.metadata?.displayName || ''}</p>
              <p className="bio">{userProfile.metadata?.description || ''}</p>
              <div className="fid">
                <span>FID: </span>
                <span>{userProfile.fid}</span>
              </div>
              <div className="wallet-info">
                <button 
                  className="wallet-toggle" 
                  onClick={() => setWalletsExpanded(!walletsExpanded)}
                >
                  {walletsExpanded ? 'Hide Wallets' : 'Show Wallets'} ({walletAddresses.length})
                </button>
                {walletsExpanded && (
                  <ul className="wallet-list">
                    {walletAddresses.map((address, index) => (
                      <li key={index} className="wallet-item">
                        <a 
                          href={`https://etherscan.io/address/${address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="wallet-link"
                        >
                          {address}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
          
          <div className="nft-container">
            <div className="nft-header">
              <h2>NFT Collection</h2>
              <p className="nft-count">
                {isLoadingNfts ? (
                  'Loading NFTs...'
                ) : userNfts.length > 0 ? (
                  `${userNfts.length} NFTs found${hasMoreNfts ? ' (more available)' : ''}`
                ) : (
                  'No NFTs found'
                )}
              </p>
            </div>
            
            {fetchNftsError && (
              <div className="error-message">
                <p>{fetchNftsError}</p>
              </div>
            )}
            
            {isLoadingNfts ? (
              <div className="loading-spinner"></div>
            ) : userNfts.length > 0 ? (
              <>
                <div className="controls-container">
                  <div className="search-box">
                    <input
                      type="text"
                      placeholder="Filter NFTs..."
                      value={nftFilterText}
                      onChange={(e) => setNftFilterText(e.target.value)}
                    />
                    {nftFilterText && (
                      <button 
                        className="clear-filter" 
                        onClick={() => setNftFilterText('')}
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>
                <NftGrid nfts={getFilteredNfts()} onNftClick={handleNftClick} />
                {hasMoreNfts && (
                  <div className="load-more">
                    <button 
                      onClick={handleLoadMore}
                      disabled={isLoadingMoreNfts}
                      className="load-more-button"
                    >
                      {isLoadingMoreNfts ? 'Loading...' : 'Load More NFTs'}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="no-nfts">
                <p>No NFTs found for this user.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Export the component wrapped in the error boundary
export default function SafeFarcasterUserSearch({ initialUsername = '' }) {
  return (
    <FarcasterErrorBoundary>
      <FarcasterUserSearch initialUsername={initialUsername} />
    </FarcasterErrorBoundary>
  );
} 