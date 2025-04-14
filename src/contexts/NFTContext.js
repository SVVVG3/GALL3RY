import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import directAlchemyService from '../services/directAlchemy';
import alchemyService from '../services/alchemyService';

// Define constants locally instead of importing them
const CACHE_EXPIRATION_TIME = 30 * 60 * 1000; // 30 minutes in milliseconds
const NFT_PAGE_SIZE = 24; // Matching Zapper's default exactly

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
    alchemy: directAlchemyService
  });
  const [pageKey, setPageKey] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [collectionHolders, setCollectionHolders] = useState({});
  const [loadingCollectionHolders, setLoadingCollectionHolders] = useState(false);
  
  // Additional state for wallet tracking
  const [loadedWallets, setLoadedWallets] = useState([]);
  const [fetchProgress, setFetchProgress] = useState({});
  
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
  
  // When processing NFTs, make sure to extract all image and price data
  const processNFTs = useCallback(async (nfts, options = {}) => {
    // Skip if no NFTs
    if (!nfts || nfts.length === 0) {
      return [];
    }
    
    try {
      console.log(`Processing ${nfts.length} NFTs with options:`, options);
      
      // Enhance the NFTs with metadata for pricing/images if available
      const enhancedNFTs = nfts.map(nft => {
        // Create a unique id if not present
        if (!nft.id) {
          const chain = nft.chain || nft.network || 'eth';
          const contractAddress = nft.contractAddress || nft.contract?.address;
          const tokenId = nft.tokenId;
          nft.id = `${chain}:${contractAddress}-${tokenId}`;
        }
        
        // Make sure we have image URLs
        if (!nft.imageUrl) {
          const media = nft.media || [];
          if (media.length > 0) {
            nft.imageUrl = media[0].gateway || media[0].raw || media[0].uri;
          } else if (nft.image) {
            if (typeof nft.image === 'string') {
              nft.imageUrl = nft.image;
            } else if (nft.image.gateway) {
              nft.imageUrl = nft.image.gateway;
            }
          } else if (nft.metadata && nft.metadata.image) {
            nft.imageUrl = nft.metadata.image;
          }
        }
        
        // Log price data fields for debugging
        console.log(`Price data fields for NFT ${nft.id}:`, {
          hasEstimatedValue: !!nft.estimatedValue,
          estimatedValueType: nft.estimatedValue ? typeof nft.estimatedValue : 'none',
          hasValueUsd: nft.valueUsd !== undefined,
          valueUsd: nft.valueUsd,
          hasFloorPrice: !!(nft.collection?.floorPrice),
          floorPriceValue: nft.collection?.floorPrice?.value,
          hasContractMetadata: !!nft.contractMetadata,
          hasOpenSeaData: !!(nft.contractMetadata?.openSea),
          openSeaFloorPrice: nft.contractMetadata?.openSea?.floorPrice
        });
        
        // Enhance with price data if available
        let valueUsd = null;
        
        // Check all possible sources for price data
        if (nft.valueUsd !== undefined && nft.valueUsd !== null) {
          valueUsd = parseFloat(nft.valueUsd);
          console.log(`Using direct valueUsd: ${valueUsd}`);
        } else if (nft.estimatedValue?.valueUsd !== undefined && nft.estimatedValue.valueUsd !== null) {
          valueUsd = parseFloat(nft.estimatedValue.valueUsd);
          console.log(`Using estimatedValue.valueUsd: ${valueUsd}`);
        } else if (nft.estimatedValue?.value !== undefined && nft.estimatedValue.value !== null) {
          // Convert ETH to USD using an approximate rate
          const value = parseFloat(nft.estimatedValue.value);
          const currency = nft.estimatedValue.denomination?.symbol || 'ETH';
          const rate = currency === 'ETH' ? 1600 : 1; // Basic conversion rate
          valueUsd = value * rate;
          console.log(`Calculated valueUsd from ${currency}: ${valueUsd}`);
        } else if (nft.collection?.floorPrice?.valueUsd !== undefined && nft.collection.floorPrice.valueUsd !== null) {
          valueUsd = parseFloat(nft.collection.floorPrice.valueUsd);
          console.log(`Using collection.floorPrice.valueUsd: ${valueUsd}`);
        } else if (nft.collection?.floorPrice?.value !== undefined && nft.collection.floorPrice.value !== null) {
          // Convert collection floor price to USD
          const value = parseFloat(nft.collection.floorPrice.value);
          const currency = nft.collection.floorPrice.currency || 'ETH';
          const rate = currency === 'ETH' ? 1600 : 1;
          valueUsd = value * rate;
          console.log(`Calculated valueUsd from collection floor price: ${valueUsd}`);
        } else if (nft.contractMetadata?.openSea?.floorPrice !== undefined && nft.contractMetadata.openSea.floorPrice !== null) {
          const value = parseFloat(nft.contractMetadata.openSea.floorPrice);
          valueUsd = value * 1600; // Convert ETH to USD
          console.log(`Calculated valueUsd from OpenSea floor price: ${valueUsd}`);
          
          // Also create an estimatedValue object if not present
          if (!nft.estimatedValue) {
            nft.estimatedValue = {
              value: value,
              valueUsd: valueUsd,
              denomination: {
                symbol: 'ETH'
              }
            };
          }
          
          // Add to collection object if not present
          if (!nft.collection) {
            nft.collection = {
              name: nft.contractMetadata?.name || 'Unknown Collection',
              address: nft.contractAddress || nft.contract?.address,
              floorPrice: {
                value: value,
                valueUsd: valueUsd,
                currency: 'ETH'
              }
            };
          } else if (!nft.collection.floorPrice) {
            nft.collection.floorPrice = {
              value: value,
              valueUsd: valueUsd,
              currency: 'ETH'
            };
          }
        }
        
        // If we found a USD value, make sure it's set in all relevant places
        if (valueUsd !== null && !isNaN(valueUsd)) {
          nft.valueUsd = valueUsd;
          
          // Update or create estimatedValue object
          if (!nft.estimatedValue) {
            nft.estimatedValue = {
              value: valueUsd / 1600, // Convert back to ETH for display
              valueUsd: valueUsd,
              denomination: {
                symbol: 'ETH'
              }
            };
          } else if (nft.estimatedValue.valueUsd === undefined || nft.estimatedValue.valueUsd === null) {
            nft.estimatedValue.valueUsd = valueUsd;
          }
          
          // Update collection floor price if present
          if (nft.collection?.floorPrice) {
            if (nft.collection.floorPrice.valueUsd === undefined || nft.collection.floorPrice.valueUsd === null) {
              nft.collection.floorPrice.valueUsd = valueUsd;
            }
          }
        }
        
        return nft;
      });
      
      // For testing, log a sample NFT with image and price data
      if (enhancedNFTs.length > 0) {
        console.log('Sample processed NFT:', {
          id: enhancedNFTs[0].id,
          name: enhancedNFTs[0].name,
          hasImage: !!enhancedNFTs[0].imageUrl,
          imageUrl: enhancedNFTs[0].imageUrl,
          hasEstimatedValue: !!enhancedNFTs[0].estimatedValue,
          estimatedValue: enhancedNFTs[0].estimatedValue,
          valueUsd: enhancedNFTs[0].valueUsd,
          collectionFloorPrice: enhancedNFTs[0].collection?.floorPrice
        });
      }
      
      return enhancedNFTs;
    } catch (error) {
      console.error('Error processing NFTs:', error);
      return nfts; // Return original NFTs if processing fails
    }
  }, []);
  
  // Fetch NFTs using Alchemy service or fallback to other services
  const fetchNfts = useCallback(async (query, options = {}) => {
    // Skip if query is empty
    if (!query || ((!query.address || query.address === '') && (!query.addresses || query.addresses.length === 0))) {
      console.warn('Invalid query for fetchNfts:', query);
      return { nfts: [], pageKey: null, hasMore: false };
    }

    try {
      // Set loading state at the start of the fetch
      setIsLoading(true);

      // Determine which function to use based on query
      let result;
      if (query.addresses && query.addresses.length > 0) {
        console.log(`Fetching NFTs for ${query.addresses.length} addresses on ${query.chain || 'eth'} chain`);
        result = await fetchNftsForAddresses(query.addresses, query.chain, {
          pageKey: options.loadMore ? pageKey : null,
          excludeSpam,
          ...options
        });
      } else {
        console.log(`Fetching NFTs for address ${query.address} on ${query.chain || 'eth'} chain`);
        result = await fetchNftsForAddress(query.address, query.chain, {
          pageKey: options.loadMore ? pageKey : null,
          excludeSpam,
          ...options
        });
      }

      // Set pagination state
      setPageKey(result.pageKey || null);
      setHasMore(!!result.pageKey);

      // Process NFTs to enhance metadata and images
      const processedNFTs = await processNFTs(result.nfts, options);
      
      // Update NFT state based on loadMore option
      if (options.loadMore) {
        // If loading more, append to existing NFTs
        const combinedNFTs = [...nfts, ...processedNFTs];
        
        // Deduplicate by ID
        const uniqueNFTs = Array.from(
          new Map(combinedNFTs.map(nft => [normalizeId(nft), nft])).values()
        );
        
        setNfts(uniqueNFTs);
        console.log(`Loaded ${processedNFTs.length} more NFTs, total: ${uniqueNFTs.length}`);
      } else {
        // If not loading more, replace existing NFTs
        setNfts(processedNFTs);
        console.log(`Loaded ${processedNFTs.length} NFTs (fresh load)`);
      }

      return {
        nfts: result.nfts,
        pageKey: result.pageKey,
        hasMore: !!result.pageKey
      };
    } catch (error) {
      console.error('Error in fetchNfts:', error);
      setPageKey(null);
      setHasMore(false);
      return { nfts: [], pageKey: null, hasMore: false };
    } finally {
      setIsLoading(false);
    }
  }, [nfts, pageKey, excludeSpam, fetchNftsForAddress, fetchNftsForAddresses, normalizeId, processNFTs]);
  
  // New function: Fetch all NFTs for multiple wallets
  const fetchAllNFTsForWallets = useCallback(async (addresses, options = {}) => {
    if (!addresses || addresses.length === 0) {
      console.error('No addresses provided to fetchAllNFTsForWallets');
      return { nfts: [], hasMore: false };
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(`Fetching NFTs for ${addresses.length} addresses using Alchemy`);
      
      // Update tracking state for these wallets
      setLoadedWallets(prev => {
        const newWallets = [...prev];
        addresses.forEach(address => {
          if (!newWallets.includes(address)) {
            newWallets.push(address);
          }
        });
        return newWallets;
      });
      
      // Use the direct Alchemy service for batch fetching
      const result = await directAlchemyService.batchFetchNFTs(addresses, 'eth', {
        withMetadata: true,
        excludeSpam: options.excludeSpam !== false,
        pageSize: options.pageSize || 50
      });
      
      // Process the NFTs to enhance metadata
      const processedNFTs = await processNFTs(result.nfts || [], options);
      
      // Update the NFT state
      setNfts(processedNFTs);
      
      // Set pagination state
      setPageKey(result.pageKey || null);
      setHasMore(!!result.pageKey);
      
      console.log(`Successfully loaded ${processedNFTs.length} NFTs from ${addresses.length} wallets`);
      
      return {
        nfts: processedNFTs,
        hasMore: !!result.pageKey,
        pageKey: result.pageKey
      };
    } catch (error) {
      console.error('Error fetching NFTs in NFTContext:', error);
      setError(error.message || 'Failed to fetch NFTs');
      return { nfts: [], hasMore: false };
    } finally {
      setIsLoading(false);
    }
  }, [processNFTs]);
  
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
    fetchAllNFTsForWallets,
    
    // Helper methods
    normalizeId,
    loadedWallets,
    fetchProgress,
    processNFTs
  };
  
  return (
    <NFTContext.Provider value={contextValue}>
      {children}
    </NFTContext.Provider>
  );
};

export default NFTContext; 