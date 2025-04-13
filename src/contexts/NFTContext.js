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
  const [sortBy, setSortBy] = useState('value');
  const [sortOrder, setSortOrder] = useState('desc');
  const [prioritizeSpeed, setPrioritizeSpeed] = useState(true);
  const [page, setPage] = useState(1);
  const [collectionHolders, setCollectionHolders] = useState({});
  const [loadingCollectionHolders, setLoadingCollectionHolders] = useState(false);
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
        // If it's ETH, convert to USD estimate
        else if (currency === 'ETH') {
          return value * 2500; // Consistent ETH to USD conversion
        }
      }
    }
    
    // 5. Check collection floor price in USD
    if (nft.collection?.floorPrice?.valueUsd !== undefined && nft.collection.floorPrice.valueUsd !== null) {
      const numValue = Number(nft.collection.floorPrice.valueUsd);
      if (!isNaN(numValue)) return numValue;
    }
    
    // 6. Try valueEth (converted to USD equivalent)
    if (nft.valueEth !== undefined && nft.valueEth !== null) {
      const numValue = Number(nft.valueEth) * 2500;
      if (!isNaN(numValue)) return numValue;
    }
    
    // 7. Collection floor price value (assume ETH)
    if (nft.collection?.floorPrice !== undefined) {
      if (typeof nft.collection.floorPrice === 'number') {
        return nft.collection.floorPrice * 2500;
      }
      else if (nft.collection.floorPrice?.valueWithDenomination) {
        const numValue = Number(nft.collection.floorPrice.valueWithDenomination);
        if (!isNaN(numValue)) {
          const denomination = nft.collection.floorPrice.denomination?.symbol || 'ETH';
          if (denomination === 'ETH') {
            return numValue * 2500;
          }
          return numValue;
        }
      }
    }

    // Log when no value is found
    console.log(`No value found for NFT: ${nft.name || nft.tokenId || 'Unknown'} (${nft.collection?.name || 'Unknown Collection'})`);
    
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
    const bypassCache = options.bypassCache === true;
    
    if (!isLoadingMore) {
      setIsLoading(true);
      setError(null);
      
      if (forceRefresh) {
        setIsRefreshing(true);
        setIsCached(false);
      }
      
      // Check cache first if we're not forcing a refresh
      if (!forceRefresh && !bypassCache) {
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
        prioritizeSpeed: isLoadingMore ? false : prioritizeSpeed, // Always use complete mode for loading more
        includeValue: true,
        includeMetadata: true,
        bypassHidden: true,
        bypassCache: bypassCache || false,
        useNftUsersTokens: true,
        endpoints: [
          `${window.location.origin}/api/zapper`, // Always try local API first
          'https://api.zapper.xyz/v2/graphql'     // Fallback to direct API
        ],
        maxRetries: 3
      };
      
      console.log(`Fetching NFTs for ${addresses.length} wallets with options:`, {
        ...fetchOptions,
        endpoints: fetchOptions.endpoints.map(e => e.includes('/api/zapper') ? '/api/zapper' : e),
        cursor: fetchOptions.cursor
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
      const totalCount = result?.totalNftCount || nftsData.length;
      
      // Enhanced logging to understand pagination
      console.log(`NFT Data: count=${nftsData.length}, totalCount=${totalCount}, hasMore=${hasMoreData}, cursor=${cursorData || 'null'}`);
      
      // Log full pagination info if available
      if (result?.pageInfo) {
        console.log('Full pagination info:', result.pageInfo);
      }
      
      if (isLoadingMore) {
        // Append to existing NFTs
        setNfts(prev => {
          // Create a combined array with new NFTs at the end
          const combined = [...prev, ...nftsData];
          
          // DISABLED: Skip deduplication as Zapper API should handle this
          // const deduplicated = deduplicateNftsArray(combined);
          console.log(`Added ${nftsData.length} new NFTs without deduplication`);
          
          // Simply return the combined array without deduplication
          return combined;
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
      if (cursorData) {
        console.log(`Setting endCursor to: ${cursorData}`);
        setEndCursor(cursorData);
      }
      
      // Explicitly log the hasMore value we're setting
      console.log(`Setting hasMore to: ${hasMoreData}`);
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
  }, [wallets, selectedWallets, endCursor, getCachedNFTs, updateCache, prioritizeSpeed, walletLoadingStatus, PAGE_SIZE]);

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
    if (!hasMore || isLoading || loadingMore) {
      console.log(`Not loading more NFTs because: hasMore=${hasMore}, isLoading=${isLoading}, loadingMore=${loadingMore}`);
      return;
    }
    
    console.log(`Loading more NFTs... Current count: ${nfts.length}, hasMore=${hasMore}, endCursor=${endCursor || 'null'}`);
    
    try {
      // Make sure we're not loading if we don't have a valid cursor
      if (!endCursor && nfts.length > 0) {
        console.warn('No endCursor available for pagination but hasMore is true. Setting hasMore to false.');
        setHasMore(false);
        return;
      }
      
      console.log(`Calling fetchNFTs with loadMore=true, endCursor=${endCursor}, batchSize=${PAGE_SIZE}`);
      await fetchNFTs({
        loadMore: true,
        batchSize: PAGE_SIZE,
        bypassCache: true  // Always bypass cache for loading more to ensure fresh data
      });
    } catch (error) {
      console.error('Error loading more NFTs:', error);
    }
  }, [fetchNFTs, hasMore, isLoading, loadingMore, PAGE_SIZE, nfts.length, endCursor]);

  const refreshNFTs = useCallback(() => {
    fetchNFTs({ forceRefresh: true });
  }, [fetchNFTs]);

  const deduplicateNftsArray = useCallback((nftsArray) => {
    console.log(`Deduplicating array of ${nftsArray.length} NFTs`);
    
    // Log some sample NFTs to debug their structure
    if (nftsArray.length > 0) {
      console.log("Sample NFT for deduplication:", {
        id: nftsArray[0].id,
        tokenId: nftsArray[0].tokenId,
        collection: nftsArray[0].collection ? {
          address: nftsArray[0].collection.address,
          name: nftsArray[0].collection.name
        } : null
      });
    }
    
    const seen = new Map();
    const originalLength = nftsArray.length;
    
    // Track duplicates for debugging
    const duplicates = [];
    
    const result = nftsArray.filter(nft => {
      // Generate a more robust key using multiple fields
      // Adding network to avoid cross-chain duplicates
      const collectionAddr = (nft.collection?.address || '').toLowerCase();
      const network = (nft.collection?.network || nft.network || '').toLowerCase();
      const tokenId = nft.tokenId || '';
      
      // More reliable key generation
      const key = `${network}-${collectionAddr}-${tokenId}`;
      
      // Skip items with empty tokenId as they're likely invalid
      if (!tokenId) {
        console.log("Skipping NFT with empty tokenId:", nft.name);
        return false;
      }
      
      if (seen.has(key)) {
        duplicates.push({ key, name: nft.name, collection: nft.collection?.name });
        return false;
      }
      
      seen.set(key, true);
      return true;
    });
    
    const removedCount = originalLength - result.length;
    
    console.log(`Deduplication removed ${removedCount} NFTs (${(removedCount/originalLength*100).toFixed(1)}%)`);
    
    // If we're removing a large percentage, log duplicates for debugging
    if (removedCount > 0 && (removedCount/originalLength > 0.2)) {
      console.log("Duplicate NFTs found:", duplicates.slice(0, 5));
    }
    
    return result;
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
    if (!collectionAddress) {
      throw new Error('Collection address is required');
    }
    
    // Normalize the collection address
    const normalizedAddress = collectionAddress.toString().toLowerCase().trim();
    console.log(`Fetching holders for collection: ${normalizedAddress} on chain: ${chain}`);
    
    // Set loading state
    setLoadingCollectionHolders(true);
    
    try {
      // Define the GraphQL query based on the Zapper API docs
      const query = `
        query GetCollectionHolders($collectionAddress: Address!, $network: Network!) {
          nftCollection(address: $collectionAddress, network: $network) {
            id
            name
            address
            network
            supply
            holdersCount
            holders {
              address
              holdCount
              holdTotalCount
              account {
                address
                displayName {
                  value
                }
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
        network: chain.toUpperCase()
      };
      
      console.log('Sending GraphQL query for collection holders:', variables);
      
      const response = await axios.post(ZAPPER_PROXY_URL, {
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
          imageUrl: holder.account.farcasterProfile?.pfpUrl,
          followersCount: holder.account.farcasterProfile?.followerCount || 0,
          followingCount: holder.account.farcasterProfile?.followingCount || 0,
          // We can add relationship info later if needed
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
    
    console.log(`Sorting NFTs by: ${sortByField}, order: ${order}, count: ${nftsToSort.length}`);
    
    // Always use 'estimatedValue' for value sorting
    const effectiveSortField = sortByField === 'value' ? 'estimatedValue' : sortByField;
    
    // Pre-calculate all values before sorting to improve performance
    const valueLookup = new Map();
    
    console.log("DEBUG: Value extraction starting...");
    
    // Log a few sample NFTs to debug the structure
    if (nftsToSort.length > 0) {
      console.log("DEBUG: Sample NFT structure:", JSON.stringify(nftsToSort[0], null, 2).substring(0, 500) + "...");
    }
    
    nftsToSort.forEach(nft => {
      const value = getEstimatedValue(nft);
      const nftId = nft.id || `${nft.collection?.address}-${nft.tokenId}`;
      valueLookup.set(nftId, value);
      
      // Debug log for very high or zero values
      if (value > 5000 || value === 0) {
        console.log(`DEBUG: Unusual value for NFT ${nft.name || nft.tokenId}: $${value.toFixed(2)}`);
        console.log(`DEBUG: Value sources:`, {
          balanceUSD: nft.balanceUSD,
          valueUsd: nft.valueUsd,
          estimatedValueUsd: nft.estimatedValue?.valueUsd,
          estimatedValueAmount: nft.estimatedValue?.amount,
          estimatedValueCurrency: nft.estimatedValue?.currency,
        });
      }
    });
    
    // Log the top 5 NFTs by value to verify if values are calculated correctly
    if (sortByField === 'value' || sortByField === 'estimatedValue') {
      console.log('Top 5 NFTs by value before sorting:');
      [...valueLookup.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .forEach(([id, value]) => {
          const nft = nftsToSort.find(n => (n.id === id) || 
                                      `${n.collection?.address}-${n.tokenId}` === id);
          if (nft) {
            console.log(`${nft.name || nft.tokenId} (${nft.collection?.name || 'Unknown'}): $${value.toFixed(2)}`);
          }
        });
    }
    
    // Sort the NFTs
    const sortedNfts = [...nftsToSort].sort((a, b) => {
      let valueA, valueB;
      const idA = a.id || `${a.collection?.address}-${a.tokenId}`;
      const idB = b.id || `${b.collection?.address}-${b.tokenId}`;
      
      switch (effectiveSortField) {
        case 'estimatedValue':
        case 'value':
          valueA = valueLookup.get(idA) || 0;
          valueB = valueLookup.get(idB) || 0;
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
          valueA = a.acquiredAt ? new Date(a.acquiredAt).getTime() : 
                  a.ownedAt ? new Date(a.ownedAt).getTime() : 0;
          valueB = b.acquiredAt ? new Date(b.acquiredAt).getTime() : 
                  b.ownedAt ? new Date(b.ownedAt).getTime() : 0;
          break;
        default:
          valueA = valueLookup.get(idA) || 0;
          valueB = valueLookup.get(idB) || 0;
      }
      
      // For numeric comparisons
      const result = order === 'asc' ? valueA - valueB : valueB - valueA;
      return result;
    });
    
    // Log the top 5 NFTs after sorting to verify
    if (sortByField === 'value' || sortByField === 'estimatedValue') {
      console.log('Top 5 NFTs by value after sorting:');
      sortedNfts.slice(0, 5).forEach(nft => {
        const value = getEstimatedValue(nft);
        console.log(`${nft.name || nft.tokenId} (${nft.collection?.name || 'Unknown'}): $${value.toFixed(2)}`);
      });
    }
    
    return sortedNfts;
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
        useNftUsersTokens: true, // Explicitly use nftUsersTokens query for better data
        includeBalanceUSD: true, // Make sure we get balance in USD for sorting
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
      
      // Debug log some NFT values to verify data structure
      if (nftsData.length > 0) {
        console.log("DEBUG: Sample NFT data structure:", {
          balanceUSD: nftsData[0].balanceUSD,
          valueUsd: nftsData[0].valueUsd,
          estimatedValue: nftsData[0].estimatedValue,
        });
        
        // Log the top 5 NFTs by value
        console.log("DEBUG: Top 5 NFTs by value:");
        const sortedByValue = [...nftsData]
          .sort((a, b) => {
            const valueA = getEstimatedValue(a);
            const valueB = getEstimatedValue(b);
            return valueB - valueA;
          })
          .slice(0, 5);
        
        sortedByValue.forEach(nft => {
          console.log(`${nft.name || nft.tokenId} (${nft.collection?.name || 'Unknown'}): $${getEstimatedValue(nft).toFixed(2)}`);
        });
      }
      
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
    loadingCollectionHolders,
    resetFilters: () => {
      setSelectedChains(['all']);
      setSelectedWallets([]);
      setSearchQuery('');
      setSortBy('value');
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