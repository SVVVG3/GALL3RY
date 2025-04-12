import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { fetchZapperData } from '../services/zapper';
import axios from 'axios';
import { useAuth } from './AuthContext';
import { useWallet } from './WalletContext';
import zapperService from '../services/zapperService';
import { ZAPPER_PROXY_URL, CACHE_EXPIRATION_TIME, NFT_PAGE_SIZE } from '../constants';

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

const NFTContext = createContext();
const PAGE_SIZE = NFT_PAGE_SIZE;

// Enhanced cache config
const CACHE_VERSION = '1.1'; // Update when cache structure changes
const CACHE_KEY = 'nft_cache_v1_1';

export const NFTProvider = ({ children }) => {
  const [nfts, setNfts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [endCursor, setEndCursor] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedChains, setSelectedChains] = useState(['all']);
  const [selectedWallets, setSelectedWallets] = useState([]);
  const [selectedCollections, setSelectedCollections] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('estimatedValue');
  const [sortOrder, setSortOrder] = useState('desc');
  const [prioritizeSpeed, setPrioritizeSpeed] = useState(true);
  const [page, setPage] = useState(1);
  const [collectionHolders, setCollectionHolders] = useState({});
  const [wallets, setWallets] = useState([]);
  const [isCached, setIsCached] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [cachingStatus, setCachingStatus] = useState({ status: 'idle', progress: 0 });

  const { profile } = useAuth();
  const { connectedWallets, ensNames } = useWallet();

  const [collections, setCollections] = useState([]);
  const [chains, setChains] = useState([]);
  
  const [loadedDetails, setLoadedDetails] = useState(new Map());

  // New filter options
  const [minValue, setMinValue] = useState(0);
  const [maxValue, setMaxValue] = useState(Infinity);
  const [dateRange, setDateRange] = useState({ start: null, end: null });
  
  // Unique chains and collections derived from NFT data
  const [availableChains, setAvailableChains] = useState([]);
  const [availableCollections, setAvailableCollections] = useState([]);

  // Add loading state tracking per wallet
  const [walletLoadingStatus, setWalletLoadingStatus] = useState({});

  useEffect(() => {
    setNfts([]);
    setEndCursor(null);
    setHasMore(true);
    setError(null);
    
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

  // Enhanced cache management functions
  const getCachedNFTs = useCallback((forceRefresh = false) => {
    if (forceRefresh) return null;
    if (!isBrowser) return null;
    
    try {
      setCachingStatus({ status: 'reading', progress: 25 });
      const cachedData = localStorage.getItem(CACHE_KEY);
      
      if (!cachedData) {
        setCachingStatus({ status: 'empty', progress: 0 });
        return null;
      }
      
      const parsedCache = JSON.parse(cachedData);
      const { data, timestamp, walletAddresses, version } = parsedCache;
      
      // Version check for cache compatibility
      if (version !== CACHE_VERSION) {
        console.log(`Cache version mismatch (${version} vs ${CACHE_VERSION}), invalidating`);
        setCachingStatus({ status: 'version_mismatch', progress: 0 });
        return null;
      }
      
      // Check if cache is expired or if wallets have changed
      const isExpired = Date.now() - timestamp > CACHE_EXPIRATION_TIME;
      const walletsMatch = 
        walletAddresses && 
        wallets.length > 0 && 
        wallets.every(addr => walletAddresses.includes(addr));
      
      if (isExpired) {
        setCachingStatus({ status: 'expired', progress: 0 });
        return null;
      }
      
      if (!walletsMatch) {
        setCachingStatus({ status: 'wallets_changed', progress: 0 });
        return null;
      }
      
      // Set cache metadata
      setLastUpdated(new Date(timestamp));
      setIsCached(true);
      setCachingStatus({ status: 'loaded', progress: 100 });
      
      return data;
    } catch (error) {
      console.error('Error reading from cache:', error);
      setCachingStatus({ status: 'error', progress: 0 });
      return null;
    }
  }, [wallets]);
  
  // Improved caching function with timestamp and wallet addresses
  const updateCache = useCallback((data, cacheAddresses = null) => {
    if (!isBrowser || !data || data.length === 0) return;
    
    try {
      setCachingStatus({ status: 'writing', progress: 50 });
      
      const cacheData = {
        data,
        timestamp: Date.now(),
        walletAddresses: cacheAddresses || [...wallets],
        version: CACHE_VERSION
      };
      
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
      setLastUpdated(new Date());
      setIsCached(true);
      setCachingStatus({ status: 'cached', progress: 100 });
      
      // Log cache size for debugging
      const cacheSize = JSON.stringify(cacheData).length / 1024;
      console.log(`Cache updated: ${cacheSize.toFixed(2)} KB`);
    } catch (error) {
      console.error('Error updating cache:', error);
      setCachingStatus({ status: 'error', progress: 0 });
    }
  }, [wallets]);

  // Enhanced utility to safely extract estimated value from NFT objects
  const getEstimatedValue = useCallback((nft) => {
    if (!nft) return 0;
    
    // For debugging - build an object to track which value source was used
    const valueTrace = {
      usedSource: null,
      foundValues: {},
    };
    
    // Helper to normalize value and track source
    const trackValue = (value, source) => {
      if (value !== undefined && value !== null) {
        valueTrace.foundValues[source] = value;
        // Only set the source if it hasn't been set yet (preserve first match)
        if (!valueTrace.usedSource) {
          valueTrace.usedSource = source;
          
          // Convert strings to numbers and handle potential non-numeric values
          if (typeof value === 'string') {
            const numValue = parseFloat(value);
            if (!isNaN(numValue)) {
              return numValue;
            }
            return 0;
          }
          return Number(value) || 0;
        }
      }
      return null;
    };
    
    // First try to get USD values (preferred for consistent sorting)
    
    // 1. Try valueUsd
    let result = trackValue(nft.valueUsd, 'valueUsd');
    if (result !== null) return result;
    
    // 2. Try estimatedValue.valueUsd
    result = trackValue(nft.estimatedValue?.valueUsd, 'estimatedValue.valueUsd');
    if (result !== null) return result;
    
    // 3. New format: { estimatedValue: { amount: number, currency: string } }
    if (nft.estimatedValue && typeof nft.estimatedValue === 'object' && 
        nft.estimatedValue.amount !== undefined && 
        nft.estimatedValue.currency === 'USD') {
      result = trackValue(nft.estimatedValue.amount, 'estimatedValue.amount (USD)');
      if (result !== null) return result;
    }
    
    // 4. Check collection floor price in USD
    result = trackValue(nft.collection?.floorPrice?.valueUsd, 'collection.floorPrice.valueUsd');
    if (result !== null) return result;
    
    // If no USD values are found, try to normalize ETH values to USD (approximate)
    // Use a rough average ETH price to make the values comparable
    const ETH_USD_ESTIMATE = 3500; // Rough estimate for comparison purposes
    
    // 5. If estimatedValue has amount but currency isn't USD (commonly ETH)
    if (nft.estimatedValue && typeof nft.estimatedValue === 'object' && 
        nft.estimatedValue.amount !== undefined) {
      const value = nft.estimatedValue.amount;
      const currency = nft.estimatedValue.currency || 'ETH';
      
      if (currency !== 'USD') {
        if (currency === 'ETH') {
          result = trackValue(value * ETH_USD_ESTIMATE, `estimatedValue.amount (${currency} converted to USD)`);
          if (result !== null) return result;
        } else {
          result = trackValue(value, `estimatedValue.amount (${currency})`);
          if (result !== null) return result;
        }
      }
    }
    
    // 6. Try valueEth (converted to USD equivalent)
    if (nft.valueEth !== undefined && nft.valueEth !== null) {
      result = trackValue(nft.valueEth * ETH_USD_ESTIMATE, 'valueEth (converted to USD)');
      if (result !== null) return result;
    }
    
    // 7. Try other estimatedValue formats (assuming ETH)
    if (nft.estimatedValue?.valueWithDenomination !== undefined && 
        nft.estimatedValue.valueWithDenomination !== null) {
      const denomination = nft.estimatedValue.denomination?.symbol || 'ETH';
      if (denomination === 'ETH') {
        result = trackValue(nft.estimatedValue.valueWithDenomination * ETH_USD_ESTIMATE, 'estimatedValue.valueWithDenomination (converted to USD)');
      } else {
        result = trackValue(nft.estimatedValue.valueWithDenomination, `estimatedValue.valueWithDenomination (${denomination})`);
      }
      if (result !== null) return result;
    }
    
    // 8. Old format: { estimatedValue: number } (assume ETH)
    if (nft.estimatedValue && typeof nft.estimatedValue === 'number') {
      result = trackValue(nft.estimatedValue * ETH_USD_ESTIMATE, 'estimatedValue (number, converted to USD)');
      if (result !== null) return result;
    }
    
    // 9. Collection floor price in ETH (converted to USD)
    if (nft.collection?.floorPrice?.valueWithDenomination !== undefined) {
      const denomination = nft.collection?.floorPrice?.denomination?.symbol || 'ETH';
      if (denomination === 'ETH') {
        result = trackValue(nft.collection.floorPrice.valueWithDenomination * ETH_USD_ESTIMATE, 'collection.floorPrice.valueWithDenomination (converted to USD)');
      } else {
        result = trackValue(nft.collection.floorPrice.valueWithDenomination, `collection.floorPrice.valueWithDenomination (${denomination})`);
      }
      if (result !== null) return result;
    }
    
    // 10. Direct floor price number (assume ETH)
    if (nft.collection?.floorPrice !== undefined && 
        typeof nft.collection.floorPrice === 'number') {
      result = trackValue(nft.collection.floorPrice * ETH_USD_ESTIMATE, 'collection.floorPrice (number, converted to USD)');
      if (result !== null) return result;
    }
    
    // 11. Legacy floor price (assume ETH)
    if (nft.collection?.floorPriceEth !== undefined) {
      result = trackValue(nft.collection.floorPriceEth * ETH_USD_ESTIMATE, 'collection.floorPriceEth (converted to USD)');
      if (result !== null) return result;
    }
    
    // If the NFT has a name/collection but no value was found, log it for debugging
    if ((nft.name || nft.tokenId) && Object.keys(valueTrace.foundValues).length === 0) {
      console.log(`No value found for NFT: ${nft.name || nft.tokenId} (${nft.collection?.name || 'Unknown Collection'})`);
    }
    
    // Cache the value trace for debugging
    if (!nft._valueTrace) {
      nft._valueTrace = valueTrace;
    }
    
    return 0;
  }, []);

  // Improved fetchNFTs with better error handling and cache management
  const fetchNFTs = useCallback(async (options = {}) => {
    if (!wallets || wallets.length === 0) {
      console.log('No wallets connected, skipping NFT fetch');
      setNfts([]);
      setIsLoading(false);
      return;
    }
    
    // Check if we're loading more or starting fresh
    const isLoadingMore = options.loadMore === true;
    const forceRefresh = options.forceRefresh === true;
    
    if (!isLoadingMore) {
      setIsLoading(true);
      setError(null);
      
      if (forceRefresh) {
        setIsRefreshing(true);
        setIsCached(false);
      }
      
      // Check cache first if we're not forcing a refresh
      if (!forceRefresh) {
        const cachedNFTs = getCachedNFTs();
        if (cachedNFTs) {
          console.log('Using cached NFT data');
          setNfts(cachedNFTs);
          setIsLoading(false);
          
          // Extract data for filters even when using cache
          updateFiltersFromNFTs(cachedNFTs);
          return;
        }
      }
      
      // Reset state for fresh fetch
      setEndCursor(null);
      setHasMore(true);
      if (!forceRefresh) {
        setIsCached(false);
      }
    } else {
      setLoadingMore(true);
    }
    
    try {
      // Update wallet loading statuses to pending
      const addresses = isLoadingMore 
        ? wallets 
        : (selectedWallets.length > 0 ? selectedWallets : wallets);
      
      const newLoadingStatus = { ...walletLoadingStatus };
      addresses.forEach(addr => {
        newLoadingStatus[addr] = { 
          status: 'loading', 
          loaded: false 
        };
      });
      setWalletLoadingStatus(newLoadingStatus);
      
      // Configure options for the zapperService call
      const fetchOptions = {
        limit: options.batchSize || PAGE_SIZE,
        cursor: isLoadingMore ? endCursor : null,
        prioritizeSpeed,
        includeValue: true,
        includeMetadata: true,
        endpoints: [
          `${window.location.origin}/api/zapper`, // Always try local API first
          'https://api.zapper.xyz/v2/graphql'     // Fallback to direct API
        ],
        maxRetries: 3
      };
      
      console.log(`Fetching NFTs for ${addresses.length} wallets with options:`, {
        ...fetchOptions,
        endpoints: fetchOptions.endpoints.map(e => e.includes('/api/zapper') ? '/api/zapper' : e)
      });
      
      // Call Zapper API to get NFTs using the improved service
      const result = await zapperService.getNftsForAddresses(addresses, fetchOptions);
      
      // Update wallet loading statuses to success
      const updatedLoadingStatus = { ...walletLoadingStatus };
      addresses.forEach(addr => {
        updatedLoadingStatus[addr] = { 
          status: 'success', 
          loaded: true 
        };
      });
      setWalletLoadingStatus(updatedLoadingStatus);
      
      // Handle data from the new response format
      const nftsData = result?.nfts || [];
      const hasMoreData = result?.hasMore === true;
      const cursorData = result?.cursor || null;
      
      console.log(`Fetched ${nftsData.length} NFTs${hasMoreData ? ' (more available)' : ''}`);
      
      if (isLoadingMore) {
        // Append to existing NFTs
        setNfts(prev => {
          const combined = [...prev, ...nftsData];
          return deduplicateNftsArray(combined);
        });
      } else {
        // Replace with new NFTs
        setNfts(nftsData);
        
        // Only update cache if this is a full refresh (not filtered by wallets)
        if (!forceRefresh || selectedWallets.length === wallets.length) {
          updateCache(nftsData);
        }
        
        // Extract data for filters
        updateFiltersFromNFTs(nftsData);
      }
      
      // Update pagination state
      setEndCursor(cursorData);
      setHasMore(hasMoreData);
    } catch (err) {
      console.error('Error fetching NFTs:', err);
      setError(err.message || 'Failed to fetch NFTs');
      
      // Update wallet loading statuses to error
      const errorLoadingStatus = { ...walletLoadingStatus };
      const addresses = isLoadingMore ? wallets : (selectedWallets.length > 0 ? selectedWallets : wallets);
      addresses.forEach(addr => {
        errorLoadingStatus[addr] = { 
          status: 'error', 
          loaded: false,
          error: err.message || 'Failed to fetch NFTs'
        };
      });
      setWalletLoadingStatus(errorLoadingStatus);
    } finally {
      setIsLoading(false);
      setLoadingMore(false);
      setIsRefreshing(false);
    }
  }, [wallets, selectedWallets, endCursor, getCachedNFTs, updateCache, prioritizeSpeed, deduplicateNftsArray, walletLoadingStatus, PAGE_SIZE]);

  // Extract filter data from NFTs
  const updateFiltersFromNFTs = useCallback((nftsData) => {
    if (!nftsData || nftsData.length === 0) return;
    
    // Extract unique chains for filtering
    const chains = [...new Set(nftsData.map(nft => nft.network).filter(Boolean))];
    setAvailableChains(chains);
    
    // Extract unique collections for filtering with metadata
    const collectionsMap = new Map();
    nftsData.forEach(nft => {
      if (nft.collection?.name && nft.collection?.id) {
        collectionsMap.set(nft.collection.id, {
          id: nft.collection.id,
          name: nft.collection.name,
          address: nft.collection?.address || null,
          network: nft.collection?.network || null,
          imageUrl: nft.collection?.imageUrl || null,
          floorPrice: nft.collection?.floorPrice || 0,
          nftsCount: nft.collection?.nftsCount || 0
        });
      }
    });
    
    setAvailableCollections(Array.from(collectionsMap.values()));
    
    // Calculate max value for the slider using the helper function
    const maxNftValue = Math.max(...nftsData.map(nft => getEstimatedValue(nft)));
    // Only update if it's significantly different to avoid UI jumps
    if (maxNftValue > 0 && (maxValue === Infinity || maxNftValue > maxValue * 1.5)) {
      setMaxValue(Math.ceil(maxNftValue * 1.1)); // Add 10% buffer
    }
  }, [maxValue, getEstimatedValue]);

  const loadMoreNFTs = useCallback(async () => {
    if (!hasMore || isLoading || loadingMore) return;
    
    try {
      await fetchNFTs({
        loadMore: true,
        batchSize: PAGE_SIZE
      });
    } catch (error) {
      console.error('Error loading more NFTs:', error);
    }
  }, [fetchNFTs, hasMore, isLoading, loadingMore, PAGE_SIZE]);

  const refreshNFTs = useCallback(() => {
    fetchNFTs({ forceRefresh: true });
  }, [fetchNFTs]);

  const deduplicateNftsArray = useCallback((nftsArray) => {
    const seen = new Map();
    return nftsArray.filter(nft => {
      const key = `${nft.collection?.address || ''}-${nft.tokenId}`;
      if (seen.has(key)) {
        return false;
      }
      seen.set(key, true);
      return true;
    });
  }, []);

  const formatNetworkName = useCallback((network) => {
    if (!network) return 'Unknown';
    
    if (network === 'ethereum') return 'Ethereum';
    if (network === 'polygon') return 'Polygon';
    if (network === 'optimism') return 'Optimism';
    if (network === 'arbitrum') return 'Arbitrum';
    if (network === 'bsc') return 'Binance Smart Chain';
    if (network === 'base') return 'Base';
    
    return network.charAt(0).toUpperCase() + network.slice(1);
  }, []);

  const fetchCollectionHolders = useCallback(async (collectionAddress, chain = 'ethereum') => {
    try {
      const query = `
        query GetCollectionHolders($collectionAddress: Address!, $network: Network!) {
          nftCollection(address: $collectionAddress, network: $network) {
                id
                name
            holders {
              address
              farcasterUser {
                fid
                username
                displayName
                pfpUrl
              }
            }
          }
        }
      `;

      const variables = {
        collectionAddress,
        network: chain
      };
      
      const response = await axios.post(ZAPPER_PROXY_URL, {
        query,
        variables
      });
      
      if (response.data.errors) {
        throw new Error(response.data.errors.map(e => e.message).join(', '));
      }
      
      const holdersData = response.data.data?.nftCollection?.holders || [];
      
      return holdersData.map(holder => ({
        address: holder.address,
        farcasterUser: holder.farcasterUser ? {
          fid: holder.farcasterUser.fid,
          username: holder.farcasterUser.username,
          displayName: holder.farcasterUser.displayName,
          pfpUrl: holder.farcasterUser.pfpUrl
        } : null
      }));
    } catch (error) {
      console.error('Error fetching collection holders:', error);
      throw error;
    }
  }, []);

  // Enhanced filtering with value and more reliable NFT data
  const filteredNFTs = useMemo(() => {
    if (!nfts || nfts.length === 0) return [];

    let filtered = [...nfts];
    
    // Apply chain filter
    if (selectedChains.length > 0 && !selectedChains.includes('all')) {
      filtered = filtered.filter(nft => 
        nft.network && selectedChains.includes(nft.network)
      );
    }
    
    // Apply collection filter
    if (selectedCollections.length > 0) {
      filtered = filtered.filter(nft => 
        nft.collection && selectedCollections.includes(nft.collection.id)
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
    
    // Apply value filters using the helper function
    if (minValue > 0 || maxValue < Infinity) {
      filtered = filtered.filter(nft => {
        const value = getEstimatedValue(nft);
        return value >= minValue && value <= maxValue;
      });
    }
    
    // Apply date range filter if both start and end are set
    if (dateRange.start && dateRange.end) {
      filtered = filtered.filter(nft => {
        if (!nft.acquiredAt && !nft.ownedAt) return true; // Include if no date info
        
        const acquiredDate = nft.acquiredAt ? new Date(nft.acquiredAt) : 
                            nft.ownedAt ? new Date(nft.ownedAt) : null;
        
        if (!acquiredDate) return true; // Include if no valid date
        
        return acquiredDate >= dateRange.start && acquiredDate <= dateRange.end;
      });
    }

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
    
    console.log(`Sorting NFTs by: ${sortByField}, order: ${order}`);
    
    // Add debug logging for the first few NFTs
    if (sortByField === 'value' || sortByField === 'estimatedValue') {
      const sampleNfts = nftsToSort.slice(0, 5);
      console.log('Sample NFT values for debugging:');
      sampleNfts.forEach(nft => {
        const value = getEstimatedValue(nft);
        console.log(`NFT: ${nft.name || nft.tokenId} (${nft.collection?.name || 'Unknown'}), Value: $${value.toFixed(2)}, Raw Data:`, {
          valueUsd: nft.valueUsd,
          valueEth: nft.valueEth,
          estimatedValueRaw: nft.estimatedValue,
          collectionFloorUsd: nft.collection?.floorPrice?.valueUsd,
          collectionFloorEth: nft.collection?.floorPrice?.valueWithDenomination
        });
      });
    }
    
    return [...nftsToSort].sort((a, b) => {
      let valueA, valueB;
      
      switch (sortByField) {
        case 'estimatedValue':
        case 'value':
          valueA = getEstimatedValue(a);
          valueB = getEstimatedValue(b);
          
          // Debug the sort comparison for a few items
          if (Math.random() < 0.01) { // Log only 1% of comparisons to avoid flooding console
            console.log(`Sort comparison: ${a.name || a.tokenId} ($${valueA.toFixed(2)}) vs ${b.name || b.tokenId} ($${valueB.toFixed(2)}) => ${order === 'asc' ? valueA - valueB : valueB - valueA}`);
          }
          break;
        case 'name':
          valueA = a.name || '';
          valueB = b.name || '';
          return order === 'asc' 
            ? valueA.localeCompare(valueB)
            : valueB.localeCompare(valueA);
        case 'collection':
          valueA = a.collection?.name || '';
          valueB = b.collection?.name || '';
          return order === 'asc' 
            ? valueA.localeCompare(valueB)
            : valueB.localeCompare(valueA);
        case 'recent':
          valueA = a.acquiredAt ? new Date(a.acquiredAt).getTime() : 0;
          valueB = b.acquiredAt ? new Date(b.acquiredAt).getTime() : 0;
          break;
        default:
          valueA = getEstimatedValue(a);
          valueB = getEstimatedValue(b);
      }
      
      return order === 'asc' ? valueA - valueB : valueB - valueA;
    });
  }, [getEstimatedValue]);

  // New function to fetch Farcaster profile and NFTs using the portfolio approach
  const fetchFarcasterNFTs = useCallback(async (usernameOrFid, options = {}) => {
    if (!usernameOrFid) {
      console.error('No Farcaster username or FID provided');
      setError('Please provide a Farcaster username or FID');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    const {
      forceRefresh = false,
      loadMore = false,
      limit = PAGE_SIZE
    } = options;
    
    // Generate a cache key specific to this Farcaster user
    const farcasterCacheKey = `${CACHE_KEY}_farcaster_${usernameOrFid.toString().toLowerCase()}`;
    
    // Check cache first if not forcing refresh
    if (!forceRefresh && !loadMore && isBrowser) {
      try {
        const cachedData = localStorage.getItem(farcasterCacheKey);
        
        if (cachedData) {
          const parsedCache = JSON.parse(cachedData);
          const { data, timestamp, addresses, version } = parsedCache;
          
          // Basic validation
          if (version === CACHE_VERSION && Date.now() - timestamp < CACHE_EXPIRATION_TIME) {
            console.log(`Using cached NFT data for Farcaster user: ${usernameOrFid}`);
            setNfts(data);
            setIsLoading(false);
            updateFiltersFromNFTs(data);
            
            // Set state for UI
            setLastUpdated(new Date(timestamp));
            setIsCached(true);
            
            return { nfts: data, addresses };
          }
        }
      } catch (cacheError) {
        console.error('Error reading from Farcaster cache:', cacheError);
      }
    }
    
    try {
      // First get all addresses associated with the Farcaster profile
      console.log(`Fetching addresses for Farcaster user: ${usernameOrFid}`);
      const addresses = await zapperService.getFarcasterAddresses(usernameOrFid);
      
      if (!addresses || addresses.length === 0) {
        throw new Error(`No addresses found for Farcaster user: ${usernameOrFid}`);
      }
      
      console.log(`Found ${addresses.length} addresses for Farcaster user: ${usernameOrFid}`);
      
      // Now fetch NFTs for all these addresses using portfolioV2 endpoint
      const fetchOptions = {
        limit: options.limit || PAGE_SIZE,
        cursor: loadMore ? endCursor : null,
        prioritizeSpeed: false, // Don't prioritize speed for Farcaster profiles
        includeValue: true,
        includeMetadata: true,
        usePortfolioV2: true, // Use the recommended portfolioV2 endpoint
        maxRetries: 3
      };
      
      console.log(`Fetching NFTs for ${addresses.length} Farcaster addresses with options:`, fetchOptions);
      
      // Call zapperService to get NFTs for all addresses at once
      const result = await zapperService.getNftsForAddresses(addresses, fetchOptions);
      
      // Handle data from the response
      const nftsData = result?.nfts || [];
      const hasMoreData = result?.hasMore === true;
      const cursorData = result?.cursor || null;
      
      console.log(`Fetched ${nftsData.length} NFTs for Farcaster user${hasMoreData ? ' (more available)' : ''}`);
      
      if (loadMore) {
        // Append to existing NFTs
        setNfts(prev => {
          const combined = [...prev, ...nftsData];
          return deduplicateNftsArray(combined);
        });
      } else {
        // Replace with new NFTs
        setNfts(nftsData);
        
        // Cache the data with Farcaster-specific key
        if (isBrowser) {
          try {
            localStorage.setItem(farcasterCacheKey, JSON.stringify({
              data: nftsData,
              timestamp: Date.now(),
              addresses,
              version: CACHE_VERSION
            }));
            setLastUpdated(new Date());
            setIsCached(true);
          } catch (cacheError) {
            console.error('Error caching Farcaster NFTs:', cacheError);
          }
        }
        
        // Update regular cache too if there's no other wallets loaded
        if (!wallets.length) {
          updateCache(nftsData, addresses);
        }
        
        // Extract data for filters
        updateFiltersFromNFTs(nftsData);
      }
      
      // Update pagination state
      setEndCursor(cursorData);
      setHasMore(hasMoreData);
      
      // Clear loading state
      setIsLoading(false);
      
      return { nfts: nftsData, addresses, hasMore: hasMoreData, cursor: cursorData };
    } catch (error) {
      console.error('Error fetching Farcaster NFTs:', error);
      setError(error.message || 'Failed to fetch NFTs for Farcaster user');
      setIsLoading(false);
      throw error;
    }
  }, [endCursor, updateFiltersFromNFTs, deduplicateNftsArray, PAGE_SIZE, updateCache, isBrowser]);

  const value = {
    nfts,
    filteredNFTs,
    isLoading,
    error,
    hasMore,
    loadingMore,
    collections,
    chains,
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
    fetchNFTs,
    fetchFarcasterNFTs,
    refreshNFTs,
    loadMoreNFTs,
    fetchCollectionHolders,
    getSortedNFTs,
    collectionHolders,
    setCollectionHolders,
    resetFilters: () => {
      setSelectedChains(['all']);
      setSelectedWallets([]);
      setSearchQuery('');
      setSortBy('estimatedValue');
      setSortOrder('desc');
      setSelectedCollections([]);
      setMinValue(0);
      setMaxValue(Infinity);
      setDateRange({ start: null, end: null });
    },
    wallets,
    isCached,
    lastUpdated,
    cachingStatus,
    isRefreshing,
    availableChains,
    availableCollections,
    minValue,
    maxValue,
    dateRange,
    setMinValue,
    setMaxValue,
    setDateRange,
    formatNetworkName,
    totalNFTCount: nfts.length,
    filteredNFTCount: filteredNFTs.length,
    walletLoadingStatus
  };

  return <NFTContext.Provider value={value}>{children}</NFTContext.Provider>;
};

export const useNFT = () => {
  const context = useContext(NFTContext);
  if (!context) {
    throw new Error('useNFT must be used within an NFTProvider');
  }
  return context;
}; 