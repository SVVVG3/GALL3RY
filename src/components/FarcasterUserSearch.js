import React, { useState, useEffect } from 'react';
// Remove the direct import which causes initialization order issues
// import zapperService from '../services/zapperService';
import { useNFT } from '../contexts/NFTContext';
import NftGrid from './NFTGrid';
import '../styles/FarcasterUserSearch.css';
import { useNavigate } from 'react-router-dom';

// Error boundary for handling API initialization issues
class APIErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("API Error:", error);
    console.error("Component Stack:", errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      // Check for the specific initialization error
      const isInitError = this.state.error && 
        (this.state.error.toString().includes("Cannot access") &&
         this.state.error.toString().includes("before initialization"));
      
      return (
        <div className="error-container">
          <h3>API Error</h3>
          {isInitError ? (
            <>
              <p>We're having trouble with the initialization order.</p>
              <p>Please try refreshing the page to fix this issue.</p>
            </>
          ) : (
            <p>There was an error loading NFT data. Please try again.</p>
          )}
          <button 
            onClick={() => {
              this.setState({ hasError: false, error: null });
              if (this.props.onRetry) {
                this.props.onRetry();
              }
            }}
            className="retry-button"
          >
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
  // Get NFT context functions and services
  const { getFarcasterProfile, services } = useNFT();
  const alchemyService = services?.alchemy;
  
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

  const navigate = useNavigate();

  // Handle API retries
  const handleRetry = () => {
    if (initialUsername) {
      performSearch(initialUsername);
    }
  };

  // Effect for initial search if username is provided
  useEffect(() => {
    if (initialUsername) {
      performSearch(initialUsername);
    }
  }, [initialUsername]);

  // Load all available NFTs with pagination
  const loadAllNfts = async (username, profile) => {
    console.log('Loading all NFTs for', username);
    
    setIsLoadingNfts(true);
    setUserNfts([]);
    setFetchNftsError(null);
    setHasMoreNfts(false);
    setIsLoadingMoreNfts(false);
    
    try {
      await fetchUserNfts(username, profile);
    } catch (error) {
      console.error('Failed to load NFTs:', error);
      setFetchNftsError(`Failed to load NFTs: ${error.message || 'Unknown error'}`);
    } finally {
      setIsLoadingNfts(false);
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
      
      // Use context method instead of direct zapperService call
      // Add safety check for getFarcasterProfile availability
      if (!getFarcasterProfile || typeof getFarcasterProfile !== 'function') {
        throw new Error('Farcaster profile service unavailable. Please try refreshing the page.');
      }
      
      const profile = await getFarcasterProfile(cleanQuery);
      
      // Extract wallet addresses using our helper method
      const uniqueAddresses = extractWalletAddresses(profile);
      
      // Add addresses property to profile to work with loadAllNfts
      profile.addresses = uniqueAddresses;
      
      // Set profile data in state when received
      setUserProfile(profile);
      console.log('Profile found:', profile);
      
      console.log(`Total unique addresses for ${profile.username}: ${uniqueAddresses.length}`);
      
      // If we have valid addresses, fetch NFTs
      if (uniqueAddresses.length > 0) {
        setWalletAddresses(uniqueAddresses);
        await fetchUserNfts(cleanQuery, profile);
        
        // After initial fetch, start the aggressive loader to get all NFTs
        setTimeout(() => {
          loadAllNfts(cleanQuery, profile);
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
   * Fetches NFTs owned by a user
   * @param {string} username - Farcaster username
   * @param {Object} profile - User profile data
   */
  const fetchUserNfts = async (username, profile) => {
    try {
      setIsLoadingNfts(true);
      setFetchNftsError(null);
      // Don't reset the NFTs array here - it's causing the flickering empty state
      // setUserNfts([]);

      // Extract ETH addresses from the profile
      const addresses = extractWalletAddresses(profile);
      if (!addresses || addresses.length === 0) {
        console.error(`No Ethereum addresses found for ${username}`);
        setFetchNftsError(`No Ethereum addresses found for ${username}`);
        setIsLoadingNfts(false);
        return;
      }
      
      console.log(`Fetching NFTs for ${username} with ${addresses.length} wallet addresses:`, addresses);
      
      // Get the NFT service from context rather than importing directly
      if (!alchemyService) {
        console.error('Alchemy service not available');
        // Remove the problematic useNFT hook call and use a safer approach
        throw new Error('Alchemy service not available. Please try refreshing the page.');
      }
      
      try {
        // Fetch NFTs for all wallet addresses with improved error handling
        const batchResults = await alchemyService.batchFetchNFTs(addresses, 'eth', {
          pageSize: 50,
          excludeSpam: true,
          includeMetadata: true // Ensure we get complete metadata as per Alchemy docs
        });
        
        console.log(`Fetched ${batchResults.nfts?.length || 0} NFTs for ${username}`, {
          hasMore: !!batchResults.pageKey,
          pageKey: batchResults.pageKey,
          sampleNft: batchResults.nfts?.length > 0 ? batchResults.nfts[0] : null
        });
        
        // Validate the NFT data structure
        const validNfts = (batchResults.nfts || []).filter(nft => {
          // Basic validation to ensure we have at least minimal required data
          return nft && 
                (nft.id || nft.tokenId) && 
                (nft.contractAddress || nft.contract?.address || nft.collection?.address);
        });
        
        if (validNfts.length !== batchResults.nfts?.length) {
          console.warn(`Filtered out ${(batchResults.nfts?.length || 0) - validNfts.length} invalid NFTs`);
        }
        
        // Only update state if we have valid NFTs to avoid flickering
        if (validNfts.length > 0) {
          setUserNfts(validNfts);
          console.log(`Updated state with ${validNfts.length} NFTs`);
        } else if (batchResults.nfts?.length === 0) {
          // Only set empty array if we actually got zero NFTs from API
          setUserNfts([]);
        }
        
        setHasMoreNfts(!!batchResults.pageKey);
        setEndCursor(batchResults.pageKey || null);
        
        if (validNfts.length === 0) {
          console.warn(`No valid NFTs found for ${username}`);
          setFetchNftsError(`No NFTs found for ${username}`);
        }
      } catch (apiError) {
        console.error('Alchemy API error:', apiError);
        throw new Error(`Alchemy API error: ${apiError.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error fetching user NFTs:', error);
      setFetchNftsError(`Failed to fetch NFTs: ${error.message}`);
      // Don't reset NFTs array on error - this preserves previously loaded NFTs
      // setUserNfts([]);
      setHasMoreNfts(false);
    } finally {
      setIsLoadingNfts(false);
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
    if (!hasMoreNfts || isLoadingMoreNfts || !userProfile) return;
    
    console.log(`Loading more NFTs for ${userProfile.username}`);
    
    try {
      setIsLoadingMoreNfts(true);
      
      // Attempt to load the next batch
      await fetchUserNfts(userProfile.username, userProfile);
      
      // Check if we actually got more NFTs
      if (userNfts.length === 0) {
        console.warn("No NFTs loaded but API claims there are more - forcing hasMoreNfts to false");
        setHasMoreNfts(false);
      }
    } catch (error) {
      console.error('Error loading more NFTs:', error);
      setFetchNftsError(`Failed to load more NFTs: ${error.message}`);
    } finally {
      setIsLoadingMoreNfts(false);
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
    <APIErrorBoundary onRetry={handleRetry}>
      <div className="farcaster-search-container">
        <div className="search-header">
          <form onSubmit={handleSearch} className="search-form">
            <input
              type="text"
              className="search-input"
              placeholder="Enter Farcaster username (e.g. dwr, vitalik, etc.)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={isSearching}
              aria-label="Farcaster username"
            />
            <button 
              type="submit" 
              className="search-button"
              disabled={isSearching}
            >
              {isSearching ? 'Searching...' : 'Search'}
            </button>
          </form>
        </div>
        
        {/* Display search error */}
        {searchError && (
          <div className="error-message">
            {searchError}
          </div>
        )}
        
        {/* Display user profile */}
        {userProfile && (
          <div className="user-profile">
            <div className="profile-section">
              <div className="profile-content">
                <div className="profile-image">
                  <img 
                    src={getProfileImageUrl(userProfile)} 
                    alt={userProfile?.username || 'Profile'} 
                    onError={(e) => {
                      console.error('Profile image load error:', e);
                      e.target.src = '/placeholder.png';
                    }}
                  />
                </div>
                <div className="profile-details">
                  <h3 className="profile-display-name">{userProfile?.metadata?.displayName || userProfile?.username}</h3>
                  <a 
                    href={`https://warpcast.com/${userProfile?.username}`} 
                    className="username-link"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    @{userProfile?.username}
                  </a>
                  <span className="fid-badge">FID: {userProfile?.fid}</span>
                </div>
                
                {/* Display wallet addresses with toggle */}
                <div className="wallet-addresses">
                  <div className="address-header" onClick={toggleWallets}>
                    <span>
                      {getWalletCount()} connected {getWalletCount() === 1 ? 'wallet' : 'wallets'}
                    </span>
                    <svg 
                      className={`wallet-toggle-arrow ${walletsExpanded ? 'expanded' : ''}`}
                      xmlns="http://www.w3.org/2000/svg" 
                      width="16" 
                      height="16" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    >
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </div>
                  
                  {walletsExpanded && (
                    <ul className="address-list">
                      {walletAddresses.map((address, index) => (
                        <li key={index} title={address}>
                          {address.slice(0, 6)}...{address.slice(-4)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
            
            {/* NFT sorting and filtering controls */}
            {userNfts.length > 0 && (
              <div className="nft-controls">
                <div className="sort-controls">
                  <label>Sort by:</label>
                  <div className="sort-buttons">
                    <button 
                      className={`sort-button ${sortMethod === 'value' ? 'active' : ''}`}
                      onClick={() => handleSortChange('value')}
                    >
                      Estimated Value
                    </button>
                    <button 
                      className={`sort-button ${sortMethod === 'recent' ? 'active' : ''}`}
                      onClick={() => handleSortChange('recent')}
                    >
                      Recently Acquired
                    </button>
                    <button 
                      className={`sort-button ${sortMethod === 'collection' ? 'active' : ''}`}
                      onClick={() => handleSortChange('collection')}
                    >
                      Collection
                    </button>
                  </div>
                </div>
                
                <div className="filter-controls">
                  <input
                    type="text"
                    placeholder="Filter NFTs..."
                    value={nftFilterText}
                    onChange={(e) => setNftFilterText(e.target.value)}
                    className="filter-input"
                  />
                  {nftFilterText && (
                    <button 
                      className="clear-filter" 
                      onClick={clearFilter}
                      aria-label="Clear filter"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            )}
            
            {/* NFT Gallery */}
            <div className="nft-gallery">
              {isLoadingNfts && userNfts.length === 0 ? (
                <div className="loading-nfts">
                  <div className="loading-animation"></div>
                  <p>Loading NFTs...</p>
                </div>
              ) : fetchNftsError ? (
                <div className="fetch-error">
                  <p>{fetchNftsError}</p>
                </div>
              ) : userNfts.length > 0 ? (
                <>
                  <div className="nft-count">
                    <p>
                      {getFilteredNfts().length} NFTs displayed
                      {totalNftCount > 0 && hasEstimatedCount && (
                        <span> (of approximately {totalNftCount} total)</span>
                      )}
                    </p>
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
    </APIErrorBoundary>
  );
};

export default FarcasterUserSearch; 