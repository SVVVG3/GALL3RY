import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import axios from 'axios';
import { ZAPPER_PROXY_URL, CACHE_EXPIRATION_TIME, NFT_PAGE_SIZE } from '../constants';

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

// Create context BEFORE any initialization
const NFTContext = createContext();

// Define useNFT hook BEFORE using it anywhere
export const useNFT = () => {
  const context = useContext(NFTContext);
  if (!context) {
    throw new Error('useNFT must be used within an NFTProvider');
  }
  return context;
};

// Import services after defining the hook to avoid circular dependencies
// We'll use dynamic imports to avoid initialization order issues
const loadServices = async () => {
  const services = {};
  try {
    // Dynamically import services
    services.alchemy = (await import('../services/alchemy')).default;
    
    // These may be dynamically imported later
    services.useAuth = (await import('./AuthContext')).useAuth;
    services.useWallet = (await import('./WalletContext')).useWallet;
    
    return services;
  } catch (error) {
    console.error('Error loading services:', error);
    return {
      alchemy: null,
      useAuth: null,
      useWallet: null
    };
  }
};

const PAGE_SIZE = NFT_PAGE_SIZE;

// Create a custom axios instance with proper headers
const axiosInstance = axios.create({
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'GALL3RY/1.0 (https://gall3ry.vercel.app)'
  }
});

// Enhanced cache config
const CACHE_VERSION = '2.0'; // Updated for Alchemy integration
const CACHE_KEY = 'nft_cache_v2_0';

// Main NFTProvider component
export const NFTProvider = ({ children }) => {
  // Services state
  const [services, setServices] = useState({
    alchemy: null,
    useAuth: null,
    useWallet: null,
    loaded: false
  });

  // Load services on mount
  useEffect(() => {
    let mounted = true;
    
    const loadAndSetServices = async () => {
      try {
        const loadedServices = await loadServices();
        if (mounted) {
          setServices({
            ...loadedServices,
            loaded: true
          });
        }
      } catch (error) {
        console.error('Failed to load services:', error);
      }
    };
    
    loadAndSetServices();
    
    return () => {
      mounted = false;
    };
  }, []);

  // Core state for NFTs, loading status, etc.
  const [nfts, setNfts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [endCursor, setEndCursor] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Filter and sorting state
  const [selectedChains, setSelectedChains] = useState(['all']);
  const [selectedWallets, setSelectedWallets] = useState([]);
  const [selectedCollections, setSelectedCollections] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('value');
  const [sortOrder, setSortOrder] = useState('desc');
  const [prioritizeSpeed, setPrioritizeSpeed] = useState(true);
  const [page, setPage] = useState(1);
  const [excludeSpam, setExcludeSpam] = useState(true); // Default to exclude spam
  
  // Collection holders state
  const [collectionHolders, setCollectionHolders] = useState({});
  const [loadingCollectionHolders, setLoadingCollectionHolders] = useState(false);
  
  // Wallet and connected addresses state
  const [wallets, setWallets] = useState([]);
  const [userFid, setUserFid] = useState(null);
  
  // Cache and refresh state
  const [isCached, setIsCached] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cachingStatus, setCachingStatus] = useState({ status: 'idle', progress: 0 });
  const [likedNFTs, setLikedNFTs] = useState([]);
  
  // Collection and chain metadata
  const [collections, setCollections] = useState([]);
  const [chains, setChains] = useState([]);
  const [loadedDetails, setLoadedDetails] = useState(new Map());
  
  // Filter options
  const [minValue, setMinValue] = useState(0);
  const [maxValue, setMaxValue] = useState(Infinity);
  const [dateRange, setDateRange] = useState({ start: null, end: null });
  const [availableChains, setAvailableChains] = useState([]);
  const [availableCollections, setAvailableCollections] = useState([]);
  
  // Loading status tracking
  const [walletLoadingStatus, setWalletLoadingStatus] = useState({});
  
  // Get auth and wallet info if services are loaded
  const profile = services.loaded && services.useAuth ? services.useAuth().profile : null;
  const connectedWallets = services.loaded && services.useWallet ? services.useWallet().connectedWallets : [];
  const ensNames = services.loaded && services.useWallet ? services.useWallet().ensNames : {};
  
  // Set userFid from profile when profile changes
  useEffect(() => {
    if (profile?.fid) {
      setUserFid(profile.fid);
    }
  }, [profile]);
  
  // Update wallets and selectedWallets when connectedWallets changes
  useEffect(() => {
    if (connectedWallets && connectedWallets.length > 0) {
      setWallets(connectedWallets.map(w => w.address));
      setSelectedWallets(connectedWallets.map(w => w.address));
      
      // Initialize loading status for each wallet
      const initialLoadingStatus = {};
      connectedWallets.forEach(wallet => {
        initialLoadingStatus[wallet.address] = { status: 'pending', loaded: false };
      });
      setWalletLoadingStatus(initialLoadingStatus);
    } else {
      setWallets([]);
      setSelectedWallets([]);
      setWalletLoadingStatus({});
    }
  }, [connectedWallets]);
  
  // Enhanced utility to safely extract estimated value from NFT objects
  const getEstimatedValue = useCallback((nft) => {
    if (!nft) return 0;
    
    // Prioritize direct USD values in a simplified, consistent way
    
    // 1. Try balanceUSD from the Zapper API (highest priority)
    if (nft.balanceUSD !== undefined && nft.balanceUSD !== null) {
      const numValue = Number(nft.balanceUSD);
      if (!isNaN(numValue)) return numValue;
    }
    
    // 2. Try valueUsd which is often provided directly
    if (nft.valueUsd !== undefined && nft.valueUsd !== null) {
      const numValue = Number(nft.valueUsd);
      if (!isNaN(numValue)) return numValue;
    }
    
    // 3. Try estimatedValue.valueUsd (from the Zapper API structure)
    if (nft.estimatedValue?.valueUsd !== undefined && nft.estimatedValue.valueUsd !== null) {
      const numValue = Number(nft.estimatedValue.valueUsd);
      if (!isNaN(numValue)) return numValue;
    }
    
    // 4. Try new format: { estimatedValue: { amount: number, currency: string } }
    if (nft.estimatedValue && typeof nft.estimatedValue === 'object' && 
        nft.estimatedValue.amount !== undefined) {
      const value = Number(nft.estimatedValue.amount);
      const currency = nft.estimatedValue.currency || 'ETH';
      
      if (!isNaN(value)) {
        // If it's in USD, use directly
        if (currency === 'USD') {
          return value;
        }
        
        // If it's in ETH, convert to USD using a static rate (for consistency)
        const ETH_USD_RATE = 2500;
        if (currency === 'ETH') {
          return value * ETH_USD_RATE;
        }
      }
    }
    
    // 5. Use collection floor price as fallback
    if (nft.collection?.floorPrice?.valueUsd) {
      return Number(nft.collection.floorPrice.valueUsd);
    }
    
    // 6. Default to 0 if no value can be determined
    return 0;
  }, []);
  
  // Enhanced NFT fetching using Alchemy API
  const fetchNFTs = useCallback(async (options = {}) => {
    // Default options
    const {
      addresses = selectedWallets,
      loadMore = false,
      bypassCache = false,
      chains = ['eth', 'base'], // Default to ETH and Base
      batchSize = 100,
      includeValue = true
    } = options;
    
    // Helper to normalize NFT IDs for deduplication
    const normalizeId = (nft) => {
      const id = nft.id || 
        `${nft.network || nft.collection?.network || 'unknown'}:${nft.contractAddress || nft.collection?.address || ''}-${nft.tokenId || ''}`;
      return id.toLowerCase(); // Normalize to lowercase
    };
    
    // Don't do anything if no addresses provided
    if (!addresses || addresses.length === 0) {
      console.log('No addresses provided, skipping NFT fetch');
      return { nfts: [], hasMore: false };
    }
    
    // Set loading state
    if (!loadMore) {
      setIsLoading(true);
      setError(null);
    } else {
      setLoadingMore(true);
    }
    
    try {
      console.log(`Fetching NFTs for ${addresses.length} addresses on chains: ${chains.join(', ')}`);
      
      // Track results across all chains
      let allNfts = [];
      let hasMoreResults = false;
      
      // We need to make sure services are loaded
      if (!services.loaded || !services.alchemy) {
        console.log('Services not loaded yet, waiting...');
        // Try loading services directly
        const loadedServices = await loadServices();
        if (!loadedServices.alchemy) {
          throw new Error('Alchemy service not available');
        }
        setServices({
          ...loadedServices,
          loaded: true
        });
      }
      
      // Use our alchemy service for each chain
      for (const chain of chains) {
        try {
          console.log(`Fetching NFTs for chain: ${chain}`);
          
          // Fetch NFTs for this chain
          const chainResult = await services.alchemy.batchFetchNFTs(addresses, chain, {
            pageSize: batchSize,
            excludeSpam: excludeSpam,
            bypassCache
          });
          
          // Combine results
          const fetchedNfts = chainResult.nfts || [];
          
          // Additional client-side spam filtering if excludeSpam is true
          const filteredNfts = excludeSpam 
            ? fetchedNfts.filter(nft => {
                // Check Alchemy's spam info directly if available
                if (nft.spamInfo && nft.spamInfo.isSpam === true) {
                  console.log(`Filtered out spam NFT: ${nft.name || nft.tokenId} (${nft.contractAddress})`);
                  return false;
                }
                return true;
              })
            : fetchedNfts;
          
          allNfts = [...allNfts, ...filteredNfts];
          
          // Update hasMore flag
          if (chainResult.hasMore) {
            hasMoreResults = true;
          }
          
          console.log(`Fetched ${chainResult.nfts.length} NFTs from chain ${chain}`);
        } catch (error) {
          console.error(`Error fetching NFTs for chain ${chain}:`, error);
          // Continue with other chains even if one fails
        }
      }
      
      // If we need to enrich NFTs with value data from Zapper
      if (includeValue && allNfts.length > 0) {
        try {
          // Enrich NFTs with value data (in batches to avoid rate limits)
          const enrichedNfts = await enrichNFTsWithValueData(allNfts);
          allNfts = enrichedNfts;
        } catch (error) {
          console.error('Error enriching NFTs with value data:', error);
          // Continue with non-enriched NFTs
        }
      }

      // Process collections and chains
      processNFTCollectionsAndChains(allNfts);
      
      // Deduplicate NFTs before updating state
      const uniqueNftIds = new Set();
      const uniqueNfts = allNfts.filter(nft => {
        const normalizedId = normalizeId(nft);
        if (uniqueNftIds.has(normalizedId)) {
          return false;
        }
        uniqueNftIds.add(normalizedId);
        return true;
      });
      
      console.log(`Filtered to ${uniqueNfts.length} unique NFTs out of ${allNfts.length} total`);
      
      // Update state based on whether this is initial load or load more
      if (loadMore) {
        setNfts(prevNfts => {
          // Deduplicate by ID
          const existing = new Set(prevNfts.map(nft => normalizeId(nft)));
          const newNfts = uniqueNfts.filter(nft => !existing.has(normalizeId(nft)));
          return [...prevNfts, ...newNfts];
        });
      } else {
        setNfts(uniqueNfts);
      }
      
      // Update pagination state
      setHasMore(hasMoreResults);
      
      // Return the results
      return {
        nfts: uniqueNfts,
        hasMore: hasMoreResults
      };
    } catch (error) {
      console.error('Error fetching NFTs:', error);
      setError(error.message || 'Failed to fetch NFTs');
      return { nfts: [], hasMore: false };
    } finally {
      // Clear loading states
      setIsLoading(false);
      setLoadingMore(false);
    }
  }, [selectedWallets, services, excludeSpam]);
  
  // Function to enrich NFTs with value data from Zapper
  const enrichNFTsWithValueData = async (nftsToEnrich) => {
    // Skip if no NFTs to enrich
    if (!nftsToEnrich || nftsToEnrich.length === 0) {
      return nftsToEnrich;
    }
    
    console.log(`Enriching ${nftsToEnrich.length} NFTs with value data from Zapper`);
    
    try {
      // Group NFTs by address to batch requests
      const nftsByAddress = {};
      nftsToEnrich.forEach(nft => {
        const address = nft.contractAddress;
        if (!address) return;
        
        if (!nftsByAddress[address]) {
          nftsByAddress[address] = [];
        }
        nftsByAddress[address].push(nft);
      });
      
      // Process each collection in smaller batches to avoid rate limits
      const addressesList = Object.keys(nftsByAddress);
      const enrichedNfts = [...nftsToEnrich]; // Clone the array
      
      // Process in batches of 5 collections at a time
      const BATCH_SIZE = 5;
      for (let i = 0; i < addressesList.length; i += BATCH_SIZE) {
        const batchAddresses = addressesList.slice(i, i + BATCH_SIZE);
        
        // Create a query to fetch value data for these collections
        const query = `
          query GetCollectionsData($addresses: [Address!]!) {
            nftCollections(addresses: $addresses, networks: [ETHEREUM_MAINNET, BASE_MAINNET]) {
              address
              network
              name
              floorPrice {
                valueUsd
                symbol
              }
            }
          }
        `;
        
        const variables = {
          addresses: batchAddresses
        };
        
        try {
          // Make the request to Zapper GraphQL API
          const response = await axiosInstance.post(ZAPPER_PROXY_URL, {
            query,
            variables
          });
          
          // Process the response
          if (response.data?.data?.nftCollections) {
            const collections = response.data.data.nftCollections;
            
            // Enrich NFTs with collection data
            collections.forEach(collection => {
              if (!collection.address) return;
              
              const nftsForThisCollection = nftsByAddress[collection.address.toLowerCase()] || [];
              
              nftsForThisCollection.forEach(nft => {
                const index = enrichedNfts.findIndex(n => normalizeId(n) === normalizeId(nft));
                if (index !== -1) {
                  // Update collection and floor price
                  enrichedNfts[index] = {
                    ...enrichedNfts[index],
                    collection: {
                      ...enrichedNfts[index].collection,
                      name: collection.name || enrichedNfts[index].collection?.name,
                      floorPrice: collection.floorPrice
                    },
                    // Add estimated value based on floor price
                    estimatedValue: {
                      amount: collection.floorPrice?.valueUsd || 0,
                      currency: 'USD'
                    }
                  };
                }
              });
            });
          }
        } catch (error) {
          console.error(`Error enriching batch of collections:`, error);
          // Continue with next batch
        }
        
        // Add a small delay to avoid rate limits
        if (i + BATCH_SIZE < addressesList.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      return enrichedNfts;
    } catch (error) {
      console.error('Error enriching NFTs with value data:', error);
      return nftsToEnrich; // Return original array if enrichment fails
    }
  };
  
  // Process NFT collections and chains for filter UI
  const processNFTCollectionsAndChains = useCallback((processNfts = nfts) => {
    // Extract unique collections and chains
    const collectionsMap = new Map();
    const chainsMap = new Map();
    
    processNfts.forEach(nft => {
      // Process collection
      if (nft.collection) {
        const collectionId = nft.collection.id || `${nft.collection.network}:${nft.collection.address}`;
        
        if (!collectionsMap.has(collectionId)) {
          collectionsMap.set(collectionId, {
            id: collectionId,
            name: nft.collection.name || 'Unknown Collection',
            address: nft.collection.address,
            network: nft.collection.network,
            count: 1
          });
        } else {
          const collection = collectionsMap.get(collectionId);
          collection.count += 1;
          collectionsMap.set(collectionId, collection);
        }
      }
      
      // Process chain
      const chain = nft.network || 'unknown';
      if (!chainsMap.has(chain)) {
        chainsMap.set(chain, {
          id: chain,
          name: formatNetworkName(chain),
          count: 1
        });
      } else {
        const chainObj = chainsMap.get(chain);
        chainObj.count += 1;
        chainsMap.set(chain, chainObj);
      }
    });
    
    // Convert maps to arrays and sort by count
    const sortedCollections = Array.from(collectionsMap.values())
      .sort((a, b) => b.count - a.count);
    
    const sortedChains = Array.from(chainsMap.values())
      .sort((a, b) => b.count - a.count);
    
    // Update state
    setCollections(sortedCollections);
    setChains(sortedChains);
  }, [nfts]);
  
  // Format network name for display
  const formatNetworkName = useCallback((network) => {
    if (!network) return 'Unknown';
    
    // Handle common formats
    if (network.toLowerCase() === 'eth' || network.toLowerCase() === 'ethereum_mainnet') {
      return 'Ethereum';
    }
    
    if (network.toLowerCase() === 'base' || network.toLowerCase() === 'base_mainnet') {
      return 'Base';
    }
    
    if (network.toLowerCase() === 'polygon' || network.toLowerCase() === 'polygon_mainnet') {
      return 'Polygon';
    }
    
    if (network.toLowerCase() === 'arbitrum' || network.toLowerCase() === 'arbitrum_mainnet') {
      return 'Arbitrum';
    }
    
    if (network.toLowerCase() === 'optimism' || network.toLowerCase() === 'optimism_mainnet') {
      return 'Optimism';
    }
    
    // Format other chains by capitalizing first letter
    return network.charAt(0).toUpperCase() + network.slice(1).toLowerCase().replace('_mainnet', '');
  }, []);
  
  // Load more NFTs function
  const loadMoreNFTs = useCallback(() => {
    if (hasMore && !isLoading && !loadingMore) {
      fetchNFTs({ loadMore: true });
    }
  }, [fetchNFTs, hasMore, isLoading, loadingMore]);
  
  // Fetch collection holders from Zapper
  const fetchCollectionHolders = useCallback(async (collectionAddress) => {
    if (!collectionAddress) {
      console.error('Collection address is required');
      throw new Error('Collection address is required');
    }

    try {
      console.log('Fetching collection holders for:', collectionAddress);
      
      // Set loading state
      setLoadingCollectionHolders(true);
      
      // Normalize address
      const normalizedAddress = collectionAddress.toLowerCase();
      
      // Default to Ethereum mainnet
      const chain = 'ETHEREUM_MAINNET';
      
      // GraphQL query for collection holders
      const query = `
        query CollectionHolders($collectionAddress: String!, $network: Network) {
          nftCollection(address: $collectionAddress, network: $network) {
            id
            name
            address
            network
            holders {
              address
              holdCount
              account {
                farcasterProfile {
                  fid
                  username
                  displayName
                  pfpUrl
                  followerCount
                  followingCount
                }
              }
            }
          }
        }
      `;

      const variables = {
        collectionAddress: normalizedAddress,
        network: chain
      };
      
      console.log('Sending GraphQL query for collection holders:', variables);
      
      // Use axios instance with proper headers
      const response = await axiosInstance.post(ZAPPER_PROXY_URL, {
        query,
        variables
      });
      
      // Check for GraphQL errors
      if (response.data.errors) {
        console.error('GraphQL errors:', response.data.errors);
        throw new Error(response.data.errors.map(e => e.message).join(', '));
      }
      
      // Extract the collection data
      const collectionData = response.data.data?.nftCollection;
      
      if (!collectionData) {
        console.warn('No collection data found');
        return [];
      }
      
      console.log(`Found collection: ${collectionData.name} with ${collectionData.holders?.length || 0} holders`);
      
      // Extract and process holders data
      const holdersData = collectionData.holders || [];
      
      // Process the holders to extract Farcaster user info
      const processedHolders = holdersData
        .filter(holder => holder.account?.farcasterProfile) // Only include holders with Farcaster profiles
        .map(holder => ({
          address: holder.address,
          holdingCount: holder.holdCount || 1,
          fid: holder.account.farcasterProfile?.fid,
          username: holder.account.farcasterProfile?.username || 'unknown',
          displayName: holder.account.farcasterProfile?.displayName,
          imageUrl: holder.account.farcasterProfile?.imageUrl || 
                    holder.account.farcasterProfile?.pfpUrl || 
                    holder.account.farcasterProfile?.metadata?.imageUrl || 
                    '/placeholder.png',
          followersCount: holder.account.farcasterProfile?.followerCount || 0,
          followingCount: holder.account.farcasterProfile?.followingCount || 0,
          // Set relationship info
          relationship: null
        }))
        .filter(holder => holder.fid); // Ensure we have a valid FID
      
      console.log(`Processed ${processedHolders.length} holders with Farcaster profiles`);
      
      // Update the collectionHolders state with this new data
      setCollectionHolders(prev => ({
        ...prev,
        [normalizedAddress]: processedHolders
      }));
      
      // Return the processed holders for convenience
      return processedHolders;
    } catch (error) {
      console.error('Error fetching collection holders:', error);
      throw error;
    } finally {
      // Clear loading state
      setLoadingCollectionHolders(false);
    }
  }, []);
  
  // Reset filters function
  const resetFilters = useCallback(() => {
    setSelectedChains(['all']);
    setSelectedCollections([]);
    setSearchQuery('');
    setSortBy('value');
    setSortOrder('desc');
    setMinValue(0);
    setMaxValue(Infinity);
    setDateRange({ start: null, end: null });
  }, []);
  
  // Function to toggle like on an NFT
  const toggleLikeNFT = useCallback((nftId) => {
    setLikedNFTs(prev => {
      if (prev.includes(nftId)) {
        return prev.filter(id => id !== nftId);
      } else {
        return [...prev, nftId];
      }
    });
  }, []);
  
  // Filter and sort NFTs
  const filteredNFTs = useMemo(() => {
    if (!nfts || nfts.length === 0) return [];

    let filtered = [...nfts];
    
    // Apply chain filter
    if (selectedChains.length > 0 && !selectedChains.includes('all')) {
      filtered = filtered.filter(nft => {
        // Normalize network names for comparison
        const nftNetwork = nft.network?.toLowerCase() || '';
        return selectedChains.some(chain => {
          const selectedChainLower = chain.toLowerCase();
          return nftNetwork === selectedChainLower || 
                 nftNetwork === `${selectedChainLower}_mainnet`;
        });
      });
    }
    
    // Apply collection filter
    if (selectedCollections.length > 0) {
      filtered = filtered.filter(nft => 
        nft.collection && 
        selectedCollections.includes(nft.collection.id || `${nft.collection.network}:${nft.collection.address}`)
      );
    }
    
    // Apply text search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(nft => 
        (nft.name && nft.name.toLowerCase().includes(query)) ||
        (nft.collection?.name && nft.collection.name.toLowerCase().includes(query)) ||
        (nft.tokenId && nft.tokenId.toString().includes(query))
      );
    }
    
    // Apply value filters
    if (minValue > 0 || maxValue < Infinity) {
      filtered = filtered.filter(nft => {
        const value = getEstimatedValue(nft);
        return value >= minValue && value <= maxValue;
      });
    }
    
    // Apply date range filter
    if (dateRange.start && dateRange.end) {
      filtered = filtered.filter(nft => {
        if (!nft.acquiredAt && !nft.ownedAt) return true; // Include if no date info
        
        const acquiredDate = nft.acquiredAt ? new Date(nft.acquiredAt) : 
                            nft.ownedAt ? new Date(nft.ownedAt) : null;
        
        if (!acquiredDate) return true; // Include if no valid date
        
        return acquiredDate >= dateRange.start && acquiredDate <= dateRange.end;
      });
    }

    // Sort the filtered NFTs
    return getSortedNFTs(filtered, sortBy, sortOrder);
  }, [
    nfts,
    selectedChains,
    selectedCollections,
    searchQuery,
    minValue,
    maxValue,
    dateRange,
    sortBy,
    sortOrder,
    getEstimatedValue
  ]);
  
  // Helper function to sort NFTs
  const getSortedNFTs = useCallback((nftsToSort, sortByField, order) => {
    if (!nftsToSort || nftsToSort.length === 0) return [];
    
    console.log(`Sorting NFTs by: ${sortByField}, order: ${order}, count: ${nftsToSort.length}`);
    
    const sortOrder = order === 'asc' ? 1 : -1;
    
    return [...nftsToSort].sort((a, b) => {
      // Sort by different fields based on sortByField
      switch (sortByField) {
        case 'value':
        case 'estimatedValue':
          return sortOrder * (getEstimatedValue(b) - getEstimatedValue(a));
          
        case 'name':
          // Sort alphabetically by name
          const nameA = a.name || '';
          const nameB = b.name || '';
          return sortOrder * nameA.localeCompare(nameB);
          
        case 'collection':
          // Sort by collection name
          const collectionA = a.collection?.name || '';
          const collectionB = b.collection?.name || '';
          return sortOrder * collectionA.localeCompare(collectionB);
          
        case 'recent':
        case 'acquiredAt':
          // Sort by acquisition date
          const dateA = a.acquiredAt ? new Date(a.acquiredAt) : 
                       a.ownedAt ? new Date(a.ownedAt) : new Date(0);
          const dateB = b.acquiredAt ? new Date(b.acquiredAt) : 
                       b.ownedAt ? new Date(b.ownedAt) : new Date(0);
          return sortOrder * (dateB - dateA);
          
        default:
          // Default no sorting
          return 0;
      }
    });
  }, [getEstimatedValue]);
  
  // Prepare the context value
  const value = {
    // NFT data
    nfts,
    filteredNFTs,
    isLoading,
    error,
    hasMore,
    loadingMore,
    endCursor,
    
    // Fetch functions
    fetchNFTs,
    loadMoreNFTs,
    fetchCollectionHolders,
    
    // Filter and sort state
    selectedChains,
    setSelectedChains,
    selectedWallets,
    setSelectedWallets,
    selectedCollections,
    setSelectedCollections,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    prioritizeSpeed,
    setPrioritizeSpeed,
    resetFilters,
    
    // Collection and chain metadata
    collections,
    chains,
    wallets,
    
    // Collection holders
    collectionHolders,
    loadingCollectionHolders,
    
    // Like functionality
    likedNFTs,
    toggleLikeNFT,
    
    // Cache and refresh state
    isCached,
    lastUpdated,
    isRefreshing,
    cachingStatus,
    
    // Utility functions
    getEstimatedValue,
    formatNetworkName,
    
    // User and wallets
    userFid,
    walletLoadingStatus,
    
    // Filter options
    minValue,
    setMinValue,
    maxValue,
    setMaxValue,
    dateRange,
    setDateRange,
    excludeSpam,
    setExcludeSpam,
    
    // Metadata
    availableChains,
    availableCollections,
  };

  return <NFTContext.Provider value={value}>{children}</NFTContext.Provider>;
};

// Add a default export for lazy loading compatibility
export default NFTProvider; 