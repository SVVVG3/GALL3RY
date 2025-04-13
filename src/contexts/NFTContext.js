import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import axios from 'axios';
import { ZAPPER_PROXY_URL, CACHE_EXPIRATION_TIME, NFT_PAGE_SIZE } from '../constants';
import directAlchemyService from '../services/directAlchemy';

// Check if we're in a browser environment
const isBrowser = typeof window !== 'undefined';

// Create context BEFORE any initialization
const NFTContext = createContext();

// Define the service variables but don't initialize them yet
let serviceLoader = null;
let servicesInitialized = false;
let alchemyService = null;
let zapperService = null;

// Add utility function to retry imports with exponential backoff
const retryImport = async (importFn, maxRetries = 3) => {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`Attempting dynamic import (attempt ${i + 1}/${maxRetries})...`);
      const module = await importFn();
      console.log(`Import successful!`, module ? 'Module returned' : 'No module returned');
      return module;
    } catch (error) {
      console.error(`Import attempt ${i + 1} failed:`, error);
      lastError = error;
      await new Promise(resolve => setTimeout(resolve, 200)); // Short delay before retry
    }
  }
  console.error(`All ${maxRetries} import attempts failed. Last error:`, lastError);
  throw lastError;
};

// Dynamic service loading function - move outside of component to prevent re-creation
const loadServices = async () => {
  try {
    // Check if services are already initialized
    if (servicesInitialized && alchemyService && zapperService) {
      console.log('Services already initialized, returning cached instances');
      return {
        alchemy: alchemyService,
        zapper: zapperService
      };
    }

    // Don't attempt to load services in non-browser environment
    if (!isBrowser) {
      console.log('Non-browser environment detected, skipping service initialization');
      return { alchemy: null, zapper: null };
    }
    
    console.log('Beginning service initialization...');

    // Try to load Alchemy service
    try {
      console.log('Loading Alchemy service...');
      const alchemyModule = await retryImport(() => import('../services/alchemy'));
      console.log('Alchemy module loaded, checking for required methods', 
        alchemyModule ? `Found methods: ${Object.keys(alchemyModule).join(', ')}` : 'No module returned');
      
      // First check for default export with required methods
      if (alchemyModule.default && 
          typeof alchemyModule.default.fetchNFTsForAddress === 'function' &&
          typeof alchemyModule.default.batchFetchNFTs === 'function') {
        
        alchemyService = alchemyModule.default;
        console.log('Successfully loaded Alchemy service via default export');
      }
      // Then check for named exports with required methods
      else if (typeof alchemyModule.fetchNFTsForAddress === 'function' ||
               typeof alchemyModule.batchFetchNFTs === 'function') {
        
        // Create a new service object from the named exports
        alchemyService = {};
        
        if (typeof alchemyModule.fetchNFTsForAddress === 'function') {
          alchemyService.fetchNFTsForAddress = alchemyModule.fetchNFTsForAddress;
        }
        
        if (typeof alchemyModule.batchFetchNFTs === 'function') {
          alchemyService.batchFetchNFTs = alchemyModule.batchFetchNFTs;
        }
        
        console.log('Successfully loaded Alchemy service via named exports');
      } else {
        console.log('Using direct Alchemy service implementation');
        alchemyService = directAlchemyService;
      }
      
      // Validate alchemy service by checking required methods
      if (!alchemyService || 
          (typeof alchemyService.fetchNFTsForAddress !== 'function' &&
           typeof alchemyService.getNFTsForOwner !== 'function') ||
          typeof alchemyService.batchFetchNFTs !== 'function') {
        
        console.warn('Alchemy service missing required methods, using direct implementation');
        alchemyService = directAlchemyService;
      }
      
      console.log('Successfully loaded Alchemy service:', 
        Object.keys(alchemyService).join(', '));
    } catch (alchemyError) {
      console.error('Failed to load Alchemy service:', alchemyError);
      console.log('Using direct Alchemy service as fallback');
      alchemyService = directAlchemyService;
    }
    
    try {
      const zapperModule = await import('../services/zapperService');
      zapperService = zapperModule;
      
      // Validate zapper service
      if (!zapperService || !zapperService.getFarcasterProfile) {
        throw new Error('Zapper service module is missing required methods');
      }
      
      console.log('Successfully loaded Zapper service');
    } catch (zapperError) {
      console.error('Failed to load Zapper service:', zapperError);
      zapperService = null;
    }
    
    // Mark as initialized if at least one service loaded successfully
    servicesInitialized = Boolean(alchemyService || zapperService);
    
    if (!servicesInitialized) {
      console.error('Failed to initialize any NFT services');
    }
    
    return {
      alchemy: alchemyService,
      zapper: zapperService
    };
  } catch (error) {
    console.error('Error during service initialization:', error);
    return {
      alchemy: directAlchemyService,
      zapper: null
    };
  }
};

// Define useNFT hook BEFORE using it anywhere
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
  const [services, setServices] = useState({ alchemy: null, zapper: null });
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
  
  // Load services on mount - use the outside function to avoid recreation
  const loadAndSetServices = useCallback(async () => {
    try {
      console.log("Initializing NFT services in provider...");
      const loadedServices = await loadServices();
      
      if (!loadedServices.alchemy) {
        console.warn("Alchemy service failed to load - may affect NFT fetching");
      }
      
      setServices(prev => ({
        ...prev,
        ...loadedServices
      }));
    } catch (err) {
      console.error('Failed to load NFT services:', err);
      setError('Failed to load NFT services. Please refresh the page.');
    }
  }, []);
  
  // Init services on first mount
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        await loadAndSetServices();
      } catch (err) {
        console.error('Service initialization error:', err);
      }
    };
    
    init();
    return () => { mounted = false; };
  }, [loadAndSetServices]);
  
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
      
      // Capture current services value to prevent hooks violation on reload attempts
      const currentServices = services;
      
      // Check if services are available
      if (!currentServices.alchemy) {
        console.error('No Alchemy service available for fetching');
        throw new Error('NFT service unavailable. Please refresh the page and try again.');
      }
      
      console.log(`Fetching NFTs for ${address} on ${chain} with options:`, options);
      
      // Use either fetchNFTsForAddress or getNFTsForOwner depending on what's available
      const fetchFunction = 
        typeof currentServices.alchemy.fetchNFTsForAddress === 'function' 
          ? currentServices.alchemy.fetchNFTsForAddress 
          : currentServices.alchemy.getNFTsForOwner;
      
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
  }, [services]);
  
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
      
      // Process addresses in chunks to avoid overwhelming the API
      const batchSize = 3; // Process 3 addresses at a time to limit concurrency
      const results = {};
      
      for (let i = 0; i < addresses.length; i += batchSize) {
        const chunk = addresses.slice(i, i + batchSize);
        const chunkPromises = chunk.map(address => 
          fetchNftsForAddress(address, chain, options)
            .then(result => {
              console.log(`Fetched ${result.nfts?.length || 0} NFTs for ${address}`);
              return { address, result };
            })
            .catch(error => {
              console.error(`Error fetching NFTs for ${address}:`, error);
              return { address, result: { nfts: [], pageKey: null, hasMore: false } };
            })
        );
        
        const chunkResults = await Promise.all(chunkPromises);
        
        // Add results to the combined object
        chunkResults.forEach(({ address, result }) => {
          results[address] = result;
        });
        
        // Small delay between chunks to avoid rate limiting
        if (i + batchSize < addresses.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      return results;
    } catch (err) {
      console.error('Error in batch fetching NFTs:', err);
      setError(err.message || 'Failed to batch fetch NFTs');
      return {};
    } finally {
      setIsBatchLoading(false);
    }
  }, [fetchNftsForAddress]);
  
  // Normalize NFT IDs to ensure consistency
  const normalizeId = (nft) => {
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
  };
  
  // Fetch collection holders
  const fetchCollectionHolders = useCallback(async (collectionAddress) => {
    if (!collectionAddress || !services.zapper) {
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
      const holders = await services.zapper.getCollectionHolders(normalizedAddress);
      
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
  }, [collectionHolders, services.zapper]);
  
  // Get Farcaster profile for a username or FID
  const getFarcasterProfile = useCallback(async (usernameOrFid) => {
    if (!usernameOrFid || !services.zapper) {
      return null;
    }
    
    try {
      return await services.zapper.getFarcasterProfile(usernameOrFid);
    } catch (err) {
      console.error(`Error fetching Farcaster profile:`, err);
      return null;
    }
  }, [services.zapper]);
  
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
      } else if (query.farcasterUser && services.zapper) {
        // Fetch by Farcaster username
        result = await services.zapper.getOptimizedFarcasterNfts(query.farcasterUser, {
          cursor: options.loadMore ? pageKey : null,
          limit: options.pageSize || NFT_PAGE_SIZE
        });
      } else {
        throw new Error('Invalid query - must provide addresses, address, or farcasterUser');
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
  }, [nfts, pageKey, excludeSpam, fetchNftsForAddress, fetchNftsForAddresses, services.zapper, normalizeId]);
  
  // Enrich NFTs with value data
  const enrichNFTsWithValueData = async (nftsToEnrich) => {
    if (!nftsToEnrich || nftsToEnrich.length === 0 || !services.zapper) {
      return nftsToEnrich;
    }
    
    try {
      // Get unique collection addresses
      const collectionAddresses = [...new Set(
        nftsToEnrich
          .map(nft => nft.collection?.address)
          .filter(Boolean)
      )];
      
      if (collectionAddresses.length === 0) {
        return nftsToEnrich;
      }
      
      // Fetch collection data from Zapper in batches
      const collectionsData = await services.zapper.getCollectionsData(collectionAddresses);
      
      // Create a map for quick lookup
      const collectionsMap = new Map();
      collectionsData.forEach(collection => {
        if (collection.address) {
          collectionsMap.set(collection.address.toLowerCase(), collection);
        }
      });
      
      // Enrich each NFT with collection data
      return nftsToEnrich.map(nft => {
        const collectionAddress = nft.collection?.address?.toLowerCase();
        if (!collectionAddress) return nft;
        
        const collectionData = collectionsMap.get(collectionAddress);
        if (!collectionData) return nft;
        
        // Enrich with collection data
        return {
          ...nft,
          collection: {
            ...nft.collection,
            ...collectionData,
            floorPrice: collectionData.floorPrice || nft.collection.floorPrice
          }
        };
      });
    } catch (error) {
      console.error('Error enriching NFTs with value data:', error);
      return nftsToEnrich;
    }
  };
  
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
    fetchNfts,
    fetchNftsForAddress,
    fetchNftsForAddresses,
    fetchCollectionHolders,
    getFarcasterProfile,
    
    // Helper methods
    normalizeId,
    enrichNFTsWithValueData
  };
  
  return (
    <NFTContext.Provider value={contextValue}>
      {children}
    </NFTContext.Provider>
  );
};

export default NFTContext; 