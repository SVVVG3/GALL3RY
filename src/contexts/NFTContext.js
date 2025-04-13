import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { CACHE_EXPIRATION_TIME, NFT_PAGE_SIZE } from '../constants';

// Import the direct Alchemy service to avoid dynamic loading issues
import directAlchemyService from '../services/directAlchemy';

// Create context
const NFTContext = createContext();

// Define the useNFT hook
export const useNFT = () => {
  const context = useContext(NFTContext);
  if (!context) {
    throw new Error('useNFT must be used within an NFTProvider');
  }
  return context;
};

// NFT Provider Component
export const NFTProvider = ({ children }) => {
  // State variables
  const [nfts, setNfts] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isBatchLoading, setIsBatchLoading] = useState(false);
  const [error, setError] = useState(null);
  const [services] = useState({ 
    // Use directAlchemy directly to avoid dynamic loading issues
    alchemy: directAlchemyService,
    zapper: null
  });
  const [pageKey, setPageKey] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [collectionHolders, setCollectionHolders] = useState({});
  const [loadingCollectionHolders, setLoadingCollectionHolders] = useState(false);
  
  // Filter states
  const [selectedChains, setSelectedChains] = useState(['all']);
  const [selectedWallets, setSelectedWallets] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('collection');
  const [sortOrder, setSortOrder] = useState('asc');
  const [speedMode, setSpeedMode] = useState(false);
  const [excludeSpam, setExcludeSpam] = useState(true);
  
  // Reset filters
  const resetFilters = useCallback(() => {
    setSelectedChains(['all']);
    setSelectedWallets([]);
    setSearchQuery('');
    setSortBy('collection');
    setSortOrder('asc');
  }, []);
  
  // Toggle sort order
  const toggleSortOrder = useCallback(() => {
    setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
  }, []);
  
  // Toggle speed mode
  const toggleSpeedMode = useCallback(() => {
    setSpeedMode(prev => !prev);
  }, []);
  
  // Toggle spam filter
  const toggleSpamFilter = useCallback(() => {
    setExcludeSpam(prev => !prev);
  }, []);
  
  // Fetch NFTs for a single address
  const fetchNftsForAddress = useCallback(async (address, chain = 'eth', options = {}) => {
    if (!address) {
      console.error('No address provided to fetchNftsForAddress');
      return { nfts: [], pageKey: null, hasMore: false };
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Use directAlchemyService directly
      const alchemyService = directAlchemyService;
      
      if (!alchemyService) {
        console.error('No Alchemy service available for fetching');
        throw new Error('NFT service unavailable. Please refresh the page and try again.');
      }
      
      console.log(`Fetching NFTs for ${address} on ${chain} with options:`, options);
      
      // Use the available fetch function
      const fetchFunction = 
        typeof alchemyService.fetchNFTsForAddress === 'function' 
          ? alchemyService.fetchNFTsForAddress 
          : alchemyService.getNFTsForOwner;
      
      if (typeof fetchFunction !== 'function') {
        throw new Error('Alchemy service has no valid fetch method');
      }
      
      // Call the appropriate fetch function
      const result = await fetchFunction(
        address, 
        chain, 
        { 
          pageKey: options.pageKey, 
          pageSize: options.pageSize || NFT_PAGE_SIZE,
          excludeSpam: options.excludeSpam !== false,
          withMetadata: true
        }
      );
      
      return result;
    } catch (err) {
      console.error(`Error fetching NFTs for ${address}:`, err);
      setError(err.message || 'Failed to fetch NFTs');
      return { nfts: [], pageKey: null, hasMore: false };
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Fetch NFTs for multiple addresses
  const fetchNftsForAddresses = useCallback(async (addresses, chain = 'eth', options = {}) => {
    if (!addresses || addresses.length === 0) {
      console.warn('No addresses provided to fetchNftsForAddresses');
      return {};
    }

    try {
      setIsBatchLoading(true);
      setError(null);
      
      console.log(`Batch fetching NFTs for ${addresses.length} addresses on ${chain}`);
      
      // Use directAlchemyService for batch fetching
      const batchFunction = directAlchemyService.batchFetchNFTs;
      
      if (typeof batchFunction !== 'function') {
        throw new Error('Batch fetch method not available');
      }
      
      const results = await batchFunction(addresses, chain, options);
      return results;
    } catch (err) {
      console.error('Error in batch fetching NFTs:', err);
      setError(err.message || 'Failed to batch fetch NFTs');
      return {};
    } finally {
      setIsBatchLoading(false);
    }
  }, []);
  
  // Normalize NFT IDs to ensure consistency
  const normalizeId = useCallback((nft) => {
    if (!nft) return null;
    
    // If the NFT already has a normalized ID, use it
    if (nft.id && typeof nft.id === 'string' && nft.id.includes(':')) {
      return nft.id;
    }
    
    // Otherwise, create a normalized ID
    const network = nft.network || nft.chain || 'eth';
    const contractAddress = nft.contractAddress || nft.contract?.address;
    const tokenId = nft.tokenId || nft.id?.tokenId;
    
    if (!contractAddress || !tokenId) {
      console.warn('Cannot normalize NFT ID - missing contractAddress or tokenId:', nft);
      return null;
    }
    
    return `${network}:${contractAddress}-${tokenId}`;
  }, []);
  
  // Fetch collection holders
  const fetchCollectionHolders = useCallback(async (collectionAddress) => {
    if (!collectionAddress) {
      return [];
    }
    
    try {
      setLoadingCollectionHolders(true);
      
      // Normalize the collection address
      const normalizedAddress = collectionAddress.toString().toLowerCase().trim();
      
      // Check cache first
      if (collectionHolders[normalizedAddress]) {
        return collectionHolders[normalizedAddress];
      }
      
      console.log(`Fetching holders for collection: ${normalizedAddress}`);
      // Use a simple mock as zapper service is not available
      const holders = [];
      
      // Update the collection holders state
      setCollectionHolders(prev => ({
        ...prev,
        [normalizedAddress]: holders
      }));
      
      return holders;
    } catch (err) {
      console.error(`Error fetching collection holders:`, err);
      return [];
    } finally {
      setLoadingCollectionHolders(false);
    }
  }, [collectionHolders]);
  
  // Get Farcaster profile for a username or FID
  const getFarcasterProfile = useCallback(async (usernameOrFid) => {
    if (!usernameOrFid) {
      return null;
    }
    
    try {
      // Implement a simple method to fetch profiles directly
      // This would need to be replaced with a proper implementation
      // using the server API
      return {
        username: usernameOrFid,
        displayName: usernameOrFid,
        fid: 123456,
        addresses: [],
        connectedAddresses: []
      };
    } catch (err) {
      console.error(`Error fetching Farcaster profile:`, err);
      return null;
    }
  }, []);
  
  // Fetch NFTs using the best available method
  const fetchNfts = useCallback(async (query, options = {}) => {
    // Reset state if not loading more
    if (!options.loadMore) {
      setNfts([]);
      setPageKey(null);
      setHasMore(false);
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Choose which service to use based on query type and availability
      let result;
      
      if (query.addresses) {
        // Fetch by addresses
        result = await fetchNftsForAddresses(query.addresses, query.chain, {
          pageKey: options.loadMore ? pageKey : null,
          pageSize: options.pageSize || NFT_PAGE_SIZE,
          excludeSpam: excludeSpam
        });
      } else if (query.address) {
        // Fetch by single address
        result = await fetchNftsForAddress(query.address, query.chain, {
          pageKey: options.loadMore ? pageKey : null,
          pageSize: options.pageSize || NFT_PAGE_SIZE,
          excludeSpam: excludeSpam
        });
      } else {
        throw new Error('Invalid query - must provide addresses or address');
      }
      
      // Update state based on results
      if (result) {
        // If loading more, append to existing NFTs, otherwise replace
        const newNfts = options.loadMore ? [...nfts, ...result.nfts] : result.nfts;
        
        // Add normalized IDs to NFTs if they don't have them
        const normalizedNfts = newNfts.map(nft => {
          if (!nft.id || !nft.id.includes(':')) {
            return { ...nft, id: normalizeId(nft) };
          }
          return nft;
        }).filter(Boolean); // Remove any that couldn't be normalized
        
        setNfts(normalizedNfts);
        setPageKey(result.pageKey);
        setHasMore(!!result.hasMore);
      }
      
      return result;
    } catch (err) {
      console.error('Error fetching NFTs:', err);
      setError(err.message || 'Failed to fetch NFTs');
      return { nfts: [], pageKey: null, hasMore: false };
    } finally {
      setIsLoading(false);
    }
  }, [nfts, pageKey, excludeSpam, fetchNftsForAddress, fetchNftsForAddresses, normalizeId]);
  
  // Filter NFTs based on current filters
  const getFilteredNfts = useMemo(() => {
    if (!nfts || nfts.length === 0) return [];

    let filtered = [...nfts];
    
    // Filter by chain
    if (selectedChains.length > 0 && !selectedChains.includes('all')) {
      filtered = filtered.filter(nft => 
        nft.network && selectedChains.includes(nft.network.toLowerCase())
      );
    }
    
    // Filter by wallet
    if (selectedWallets.length > 0) {
      filtered = filtered.filter(nft => 
        nft.ownerAddress && selectedWallets.includes(nft.ownerAddress.toLowerCase())
      );
    }
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(nft => 
        (nft.name && nft.name.toLowerCase().includes(query)) ||
        (nft.collection?.name && nft.collection.name.toLowerCase().includes(query)) ||
        (nft.description && nft.description.toLowerCase().includes(query))
      );
    }
    
    return filtered;
  }, [nfts, selectedChains, selectedWallets, searchQuery]);
  
  // Sort NFTs based on current sort settings
  const getSortedNfts = useMemo(() => {
    if (!getFilteredNfts || getFilteredNfts.length === 0) return [];
    
    const filtered = [...getFilteredNfts];
    
    // Sort by the selected method
    switch (sortBy) {
      case 'value':
        return filtered.sort((a, b) => {
          // Get values, defaulting to 0 if not available
          const aValue = a.collection?.floorPrice?.valueUsd || 0;
          const bValue = b.collection?.floorPrice?.valueUsd || 0;
          
          // Sort based on order
          return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
        });
        
      case 'recent':
        return filtered.sort((a, b) => {
          // Get timestamps, defaulting to 0 if not available
          const aTime = a.lastActivityTimestamp || a.acquiredAt || 0;
          const bTime = b.lastActivityTimestamp || b.acquiredAt || 0;
          
          // Sort based on order
          return sortOrder === 'asc' ? aTime - bTime : bTime - aTime;
        });
          
      case 'collection':
      default:
        return filtered.sort((a, b) => {
          // Get collection names, defaulting to empty string if not available
          const aName = (a.collection?.name || '').toLowerCase();
          const bName = (b.collection?.name || '').toLowerCase();
          
          // For collections, sort by collection name then token ID
          if (aName === bName) {
            const aId = a.tokenId || '';
            const bId = b.tokenId || '';
            const aIdNum = parseInt(aId, 10);
            const bIdNum = parseInt(bId, 10);
            
            // If both can be parsed as numbers, compare numerically
            if (!isNaN(aIdNum) && !isNaN(bIdNum)) {
              return sortOrder === 'asc' ? aIdNum - bIdNum : bIdNum - aIdNum;
            }
            
            // Otherwise, sort lexicographically
            return sortOrder === 'asc' ? aId.localeCompare(bId) : bId.localeCompare(aId);
          }
          
          // Sort by collection name
          return sortOrder === 'asc' ? aName.localeCompare(bName) : bName.localeCompare(aName);
        });
    }
  }, [getFilteredNfts, sortBy, sortOrder]);
  
  // Provide context values
  const contextValue = {
    // State
    nfts,
    isLoading,
    isBatchLoading,
    error,
    pageKey,
    hasMore,
    selectedChains,
    selectedWallets,
    searchQuery,
    sortBy,
    sortOrder,
    speedMode,
    excludeSpam,
    loadingCollectionHolders,
    collectionHolders,
    
    // Filtered and sorted NFTs
    filteredNfts: getFilteredNfts,
    sortedNfts: getSortedNfts,
    
    // Actions
    setNfts,
    setError,
    setSelectedChains,
    setSelectedWallets,
    setSearchQuery,
    setSortBy,
    setSortOrder,
    resetFilters,
    toggleSortOrder,
    toggleSpeedMode,
    toggleSpamFilter,
    
    // Service methods
    services,
    fetchNfts,
    fetchNftsForAddress,
    fetchNftsForAddresses,
    fetchCollectionHolders,
    getFarcasterProfile,
    
    // Helper methods
    normalizeId
  };
  
  return (
    <NFTContext.Provider value={contextValue}>
      {children}
    </NFTContext.Provider>
  );
};

export default NFTContext; 