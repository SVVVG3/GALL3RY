import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { fetchZapperData } from '../services/zapper';
import axios from 'axios';
import { ZAPPER_PROXY_URL } from '../config';
import { useAuth } from './AuthContext';
import { useWallet } from './WalletContext';
import zapperService from '../services/zapperService';

const NFTContext = createContext();
const PAGE_SIZE = 32;

// Cache configuration
const CACHE_EXPIRATION_TIME = 30 * 60 * 1000; // 30 minutes in milliseconds

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
    
    try {
      setCachingStatus({ status: 'reading', progress: 0 });
      const cachedData = localStorage.getItem('nft_cache');
      
      if (!cachedData) {
        setCachingStatus({ status: 'empty', progress: 0 });
        return null;
      }
      
      const { data, timestamp, walletAddresses, version } = JSON.parse(cachedData);
      
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
  
  const updateCache = useCallback((data) => {
    try {
      setCachingStatus({ status: 'writing', progress: 50 });
      
      const cacheData = {
        data,
        timestamp: Date.now(),
        walletAddresses: [...wallets],
        version: '1.0' // Cache version for future compatibility
      };
      
      localStorage.setItem('nft_cache', JSON.stringify(cacheData));
      setLastUpdated(new Date());
      setIsCached(true);
      setCachingStatus({ status: 'cached', progress: 100 });
    } catch (error) {
      console.error('Error updating cache:', error);
      setCachingStatus({ status: 'error', progress: 0 });
    }
  }, [wallets]);

  // Improved fetchNFTs with better error handling and cache management
  const fetchNFTs = useCallback(async (options = {}) => {
    if (!wallets || wallets.length === 0) {
      console.log('No wallets connected, skipping NFT fetch');
      setNfts([]);
      setIsLoading(false);
      return;
    }
    
    // Check if we're loading more or starting fresh
    const isLoadingMoreNFTs = options.loadMore === true;
    const forceRefresh = options.forceRefresh === true;
    
    if (!isLoadingMoreNFTs) {
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
      if (!forceRefresh) {
        setIsCached(false);
      }
    } else {
      setLoadingMore(true);
    }
    
    try {
      // Use speed mode by default, prioritizing loading time over completeness
      const fetchOptions = {
        limit: options.batchSize || 100,
        cursor: isLoadingMoreNFTs ? endCursor : null,
        prioritizeSpeed: prioritizeSpeed
      };
      
      // Call Zapper API to get NFTs
      const result = await zapperService.getNftsForAddresses(
        isLoadingMoreNFTs ? wallets : selectedWallets.length > 0 ? selectedWallets : wallets, 
        fetchOptions
      );
      
      // Update state with the fetched NFTs and pagination info
      if (result && result.nfts) {
        if (isLoadingMoreNFTs) {
          // Append to existing NFTs
          setNfts(prev => {
            const combined = [...prev, ...result.nfts];
            return deduplicateNftsArray(combined);
          });
        } else {
          // Replace with new NFTs
          setNfts(result.nfts);
          
          // Only update cache if this is a full refresh (not filtered by wallets)
          if (!forceRefresh || selectedWallets.length === wallets.length) {
            updateCache(result.nfts);
          }
          
          // Extract data for filters
          updateFiltersFromNFTs(result.nfts);
        }
        
        // Update pagination state
        setEndCursor(result.cursor);
        setHasMore(result.hasMore === true);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch NFTs');
      console.error('Error fetching NFTs:', err);
    } finally {
      setIsLoading(false);
      setLoadingMore(false);
      setIsRefreshing(false);
    }
  }, [wallets, selectedWallets, endCursor, getCachedNFTs, updateCache, prioritizeSpeed, deduplicateNftsArray]);

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
    
    // Calculate max value for the slider
    const maxNftValue = Math.max(...nftsData.map(nft => nft.estimatedValue || 0));
    // Only update if it's significantly different to avoid UI jumps
    if (maxNftValue > 0 && (maxValue === Infinity || maxNftValue > maxValue * 1.5)) {
      setMaxValue(Math.ceil(maxNftValue * 1.1)); // Add 10% buffer
    }
  }, [maxValue]);

  const loadMoreNFTs = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchNFTs({ loadMore: true });
    }
  }, [fetchNFTs, loadingMore, hasMore]);

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

  // Enhanced filtering with value and date filters
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
    
    // Apply value filters
    if (minValue > 0 || maxValue < Infinity) {
      filtered = filtered.filter(nft => {
        const value = nft.estimatedValue || 0;
        return value >= minValue && value <= maxValue;
      });
    }
    
    // Apply date range filter if both start and end are set
    if (dateRange.start && dateRange.end) {
      filtered = filtered.filter(nft => {
        if (!nft.acquiredAt && !nft.ownedAt) return false;
        
        const acquiredDate = nft.acquiredAt ? new Date(nft.acquiredAt) : 
                            nft.ownedAt ? new Date(nft.ownedAt) : null;
        
        if (!acquiredDate) return false;
        
        return acquiredDate >= dateRange.start && acquiredDate <= dateRange.end;
      });
    }

    return getSortedNFTs(filtered, sortBy, sortOrder);
  }, [
    nfts, 
    selectedChains, 
    selectedCollections, 
    searchQuery, 
    sortBy, 
    sortOrder, 
    minValue, 
    maxValue, 
    dateRange
  ]);

  // Improved sorting with multiple fields
  const getSortedNFTs = useCallback((nftsToSort, sortByField, order) => {
    if (!nftsToSort || nftsToSort.length === 0) return [];
    
    const sorted = [...nftsToSort];
    
    sorted.sort((a, b) => {
      let valueA, valueB;
      
      switch (sortByField) {
        case 'estimatedValue':
          valueA = a.estimatedValue || 0;
          valueB = b.estimatedValue || 0;
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
        case 'acquiredAt':
          valueA = a.ownedAt ? new Date(a.ownedAt).getTime() : 0;
          valueB = b.ownedAt ? new Date(b.ownedAt).getTime() : 0;
          break;
        case 'tokenId':
          valueA = parseInt(a.tokenId) || 0;
          valueB = parseInt(b.tokenId) || 0;
          break;
        default:
          valueA = a.estimatedValue || 0;
          valueB = b.estimatedValue || 0;
      }
      
      return order === 'asc' ? valueA - valueB : valueB - valueA;
    });
    
    return sorted;
  }, []);

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