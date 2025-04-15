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
  
  // Process NFTs to ensure consistent structure and handle media properties properly
  const processNFTs = useCallback(async (nfts, options = {}) => {
    // Skip if no NFTs
    if (!nfts || !Array.isArray(nfts) || nfts.length === 0) {
      console.log('No NFTs to process');
      return [];
    }
    
    try {
      console.log(`Processing ${nfts.length} NFTs...`);
      
      const enhancedNFTs = nfts.map(nft => {
        // Skip null or invalid NFTs
        if (!nft) return null;
        
        try {
          // Create a unique id if not present
          const id = nft.id || (nft.contract?.address && nft.tokenId ? 
            `${nft.network || 'eth'}:${nft.contract.address}-${nft.tokenId}` : 
            `unknown-${Date.now()}`);
          
          let imageUrl = '';
          let mediaType = 'image';
          
          // Image handling - based on Alchemy V3 API structure
          // 1. Alchemy image.gateway is the most reliable source
          if (nft.image && nft.image.gateway) {
            imageUrl = nft.image.gateway;
            console.log(`Using primary Alchemy image.gateway: ${imageUrl}`);
          } 
          // 2. String image field
          else if (nft.image && typeof nft.image === 'string') {
            imageUrl = nft.image;
            console.log(`Using string image: ${imageUrl}`);
          } 
          // 3. Media array with gateway URLs
          else if (nft.media && Array.isArray(nft.media) && nft.media.length > 0) {
            // Find first media item with a gateway or thumbnail
            const mediaItem = nft.media.find(m => m && (m.gateway || m.thumbnail || m.raw || m.uri));
            if (mediaItem) {
              imageUrl = mediaItem.gateway || mediaItem.thumbnail || mediaItem.raw || mediaItem.uri;
              mediaType = mediaItem.format || 'image';
              console.log(`Using media item: ${imageUrl}`);
            }
          }
          // 4. Handle single media object (not array)
          else if (nft.media && typeof nft.media === 'object' && !Array.isArray(nft.media)) {
            const mediaObj = nft.media;
            imageUrl = mediaObj.gateway || mediaObj.thumbnail || mediaObj.raw || mediaObj.uri || '';
            mediaType = mediaObj.format || 'image';
            console.log(`Using media object: ${imageUrl}`);
          }
          // 5. Check raw metadata
          else if (nft.metadata) {
            if (nft.metadata.image) {
              imageUrl = nft.metadata.image;
              console.log(`Using metadata.image: ${imageUrl}`);
            } else if (nft.metadata.image_url) {
              imageUrl = nft.metadata.image_url;
              console.log(`Using metadata.image_url: ${imageUrl}`);
            }
          }
          // 6. Check tokenUri
          else if (nft.tokenUri && nft.tokenUri.gateway) {
            imageUrl = nft.tokenUri.gateway;
            console.log(`Using tokenUri.gateway: ${imageUrl}`);
          }
          // 7. Last resort - check contract metadata
          else if (nft.contractMetadata && nft.contractMetadata.openSea && nft.contractMetadata.openSea.imageUrl) {
            imageUrl = nft.contractMetadata.openSea.imageUrl;
            console.log(`Using contractMetadata.openSea.imageUrl: ${imageUrl}`);
          }

          // Ensure we have contract information
          const contractName = 
            (nft.contract?.name) || 
            (nft.contractMetadata?.name) || 
            (nft.title ? nft.title.split('#')[0].trim() : 'Unknown Collection');
          
          // Ensure we have owner information
          const ownerAddress = nft.ownerAddress || nft.owner || '';
          
          return {
            ...nft,
            id,
            title: nft.title || nft.name || `#${nft.tokenId || '?'}`,
            name: nft.name || nft.title || `${contractName} #${nft.tokenId || '?'}`,
            description: nft.description || '',
            image: {
              url: imageUrl,
              type: mediaType
            },
            contract: {
              ...nft.contract,
              name: contractName,
              address: nft.contract?.address || nft.contractAddress || '',
              type: nft.contract?.tokenType || 'ERC721'
            },
            ownerAddress
          };
        } catch (err) {
          console.error('Error enhancing NFT:', err);
          // Return minimal valid NFT to avoid breaking the app
          return {
            id: nft.id || `unknown-${Date.now()}`,
            title: nft.title || nft.name || 'Unknown NFT',
            name: nft.name || 'Unknown NFT',
            description: 'Error processing NFT data',
            image: { url: '', type: 'image' },
            contract: { name: 'Unknown', address: '', type: 'ERC721' },
            ownerAddress: nft.ownerAddress || nft.owner || ''
          };
        }
      }).filter(Boolean); // Remove any null entries
      
      return enhancedNFTs;
    } catch (e) {
      console.error('Error in processNFTs:', e);
      return nfts; // Return original NFTs if processing fails
    }
  }, []);
  
  // Apply filters to NFTs based on current filter settings
  const applyFilters = useCallback((nfts) => {
    if (!nfts || !Array.isArray(nfts) || nfts.length === 0) {
      return [];
    }

    let filtered = [...nfts];
    
    // Filter by selected chain
    if (selectedChains.length > 0) {
      filtered = filtered.filter(nft => {
        const network = nft.network || nft.chain || 'eth';
        return selectedChains.includes(network);
      });
    }
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(nft => {
        // Search in title, description, contract, token ID
        return (
          (nft.name && nft.name.toLowerCase().includes(query)) ||
          (nft.description && nft.description.toLowerCase().includes(query)) ||
          (nft.contract?.name && nft.contract.name.toLowerCase().includes(query)) ||
          (nft.tokenId && String(nft.tokenId).toLowerCase().includes(query))
        );
      });
    }
    
    // Filter out spam NFTs if enabled
    if (excludeSpam) {
      filtered = filtered.filter(nft => !nft.isSpam);
    }
    
    return filtered;
  }, [selectedChains, searchQuery, excludeSpam]);
  
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
  
  // Fetch NFTs for multiple addresses with improved error handling
  const fetchAllNFTsForWallets = useCallback(async (addresses, options = {}) => {
    if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
      console.warn('No addresses provided to fetchAllNFTsForWallets');
      return { nfts: [], hasMore: false, error: null };
    }
    
    try {
      setIsBatchLoading(true);
      setError(null);
      
      const validAddresses = addresses.filter(addr => addr && typeof addr === 'string' && addr.length > 10);
      
      if (validAddresses.length === 0) {
        console.warn('No valid addresses found in the input array');
        setIsBatchLoading(false);
        return { nfts: [], hasMore: false, error: 'No valid addresses provided' };
      }
      
      console.log(`Fetching NFTs for ${validAddresses.length} wallets`);
      
      // Fetch from each selected chain with retry logic
      const chainsToFetch = [...selectedChains];
      
      // If no chains selected or only 'all' is selected, use specific chains
      if (chainsToFetch.length === 0 || (chainsToFetch.length === 1 && chainsToFetch[0] === 'all')) {
        chainsToFetch.length = 0; // Clear array
        // Add specific chains instead of using 'all'
        chainsToFetch.push('eth', 'polygon', 'optimism', 'arbitrum', 'base');
      }
      
      // Store all NFTs from all chains
      let allNFTs = [];
      
      // Fetch from each selected chain with retry logic
      for (const chain of chainsToFetch) {
        let attempt = 0;
        let success = false;
        let result = { nfts: [] };
        
        // Try up to 3 times for each chain
        while (attempt < 3 && !success) {
          try {
            console.log(`Fetching NFTs from ${chain} (attempt ${attempt + 1})`);
            
            if (!directAlchemyService || typeof directAlchemyService.batchFetchNFTs !== 'function') {
              console.error('directAlchemyService or batchFetchNFTs is not available');
              throw new Error('NFT service not properly initialized');
            }
            
            const response = await directAlchemyService.batchFetchNFTs(
              validAddresses,
              chain,
              {
                excludeSpam: excludeSpam,
                withMetadata: true
              }
            );
            
            // Safely check if the result is valid
            if (response && Array.isArray(response.nfts)) {
              result = response;
              success = true;
            } else {
              console.warn(`Invalid response format from ${chain}:`, response);
              // Create safe default if response is invalid
              result = { 
                ...response, 
                nfts: Array.isArray(response?.nfts) ? response.nfts : [] 
              };
              success = true; // We'll still consider this a success to avoid retries
            }
          } catch (error) {
            console.error(`Error fetching from ${chain} (attempt ${attempt + 1}):`, error);
            attempt++;
            
            // Add delay between retries
            if (attempt < 3) {
              await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
          }
        }
        
        // Add successfully fetched NFTs to the collection
        if (Array.isArray(result.nfts)) {
          console.log(`Retrieved ${result.nfts.length} NFTs from ${chain}`);
          allNFTs = [...allNFTs, ...result.nfts];
        } else {
          console.warn(`No valid NFTs array from ${chain}, skipping`);
        }
      }
      
      // Process all NFTs to ensure consistent structure
      const processedNFTs = await processNFTs(allNFTs);
      
      // Apply filtering
      const filteredNFTs = applyFilters(processedNFTs);
      
      // Sort NFTs if needed
      const sortedNFTs = sortOrder === 'asc' ? 
        [...filteredNFTs].sort((a, b) => a.name?.localeCompare(b.name || '')) : 
        [...filteredNFTs].sort((a, b) => b.name?.localeCompare(a.name || ''));
      
      // Update state
      setNfts(sortedNFTs);
      setIsBatchLoading(false);
      
      return { nfts: sortedNFTs, hasMore: false, error: null };
    } catch (err) {
      console.error('Error in fetchAllNFTsForWallets:', err);
      setError('Failed to fetch NFTs. Please try again.');
      setIsBatchLoading(false);
      
      // Return empty array to avoid breaking the UI
      return { nfts: [], hasMore: false, error: err.message };
    }
  }, [selectedChains, excludeSpam, sortOrder, processNFTs, applyFilters]);
  
  // Filtered NFTs memoized with the current filters applied
  const filteredNfts = useMemo(() => {
    // Return empty array if no NFTs are loaded
    if (!nfts || nfts.length === 0) {
      return [];
    }
    
    let filtered = [...nfts];
    
    // Filter by selected chain
    if (selectedChains.length > 0) {
      filtered = filtered.filter(nft => selectedChains.includes(nft.network || nft.chain || 'eth'));
    }
    
    // Filter by selected collections
    if (selectedWallets.length > 0) {
      filtered = filtered.filter(nft => {
        const ownerAddress = nft.ownerAddress ? nft.ownerAddress.toLowerCase() : null;
        return ownerAddress && selectedWallets.includes(ownerAddress);
      });
    }
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(nft => {
        // Search in title, description, contract, token ID
        return (
          (nft.name && nft.name.toLowerCase().includes(query)) ||
          (nft.description && nft.description.toLowerCase().includes(query)) ||
          (nft.contract?.name && nft.contract.name.toLowerCase().includes(query)) ||
          (nft.tokenId && nft.tokenId.toLowerCase().includes(query))
        );
      });
    }
    
    // Filter out spam NFTs if enabled
    if (excludeSpam) {
      filtered = filtered.filter(nft => !nft.isSpam);
    }
    
    // Sort NFTs
    filtered.sort((a, b) => {
      let comparison = 0;
      
      // Sort by the appropriate field
      switch (sortBy) {
        case 'name':
          comparison = (a.name || '').localeCompare(b.name || '');
          break;
        case 'date':
          // Try to use lastTransferTimestamp or default to 0 for comparison
          const aTime = a.lastTransferTimestamp 
            ? parseInt(a.lastTransferTimestamp, 10) || 0 
            : 0;
          const bTime = b.lastTransferTimestamp 
            ? parseInt(b.lastTransferTimestamp, 10) || 0 
            : 0;
          comparison = bTime - aTime; // Newest first by default
          break;
        case 'price':
          const aPrice = a.estimatedValue?.amount || 0;
          const bPrice = b.estimatedValue?.amount || 0;
          comparison = bPrice - aPrice; // Highest first by default
          break;
        default:
          comparison = 0;
      }
      
      // Apply sort order
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  }, [nfts, selectedChains, selectedWallets, searchQuery, sortBy, sortOrder, excludeSpam]);
  
  // Clean up filtered NFTs to ensure we don't have any undefined values
  const safeFilteredNfts = useMemo(() => {
    // If we have no filtered NFTs, return empty array
    if (!filteredNfts || !Array.isArray(filteredNfts)) {
      return [];
    }
    
    // Filter out any null or undefined NFTs
    return filteredNfts.filter(nft => 
      nft && 
      typeof nft === 'object' && 
      (!excludeSpam || !nft.isSpam)
    );
  }, [filteredNfts, excludeSpam]);
  
  // Sort NFTs based on current sort settings
  const getSortedNfts = useMemo(() => {
    if (!filteredNfts || filteredNfts.length === 0) return [];
    
    const filtered = [...filteredNfts];
    
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
  }, [filteredNfts, sortBy, sortOrder]);
  
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
    
    // Filtered and sorted NFTs - ensure these are always arrays
    filteredNfts: filteredNfts || [],
    sortedNfts: getSortedNfts || [],
    
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