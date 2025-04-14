import React, { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
// Define constants locally instead of importing them
const CACHE_EXPIRATION_TIME = 30 * 60 * 1000; // 30 minutes in milliseconds
const NFT_PAGE_SIZE = 24; // Matching Zapper's default exactly

// Import services - but only import the specific functions we need from zapperService
import directAlchemyService from '../services/directAlchemy';
// Rename the imported function to avoid naming conflicts
import { getFarcasterProfile as zapperGetFarcasterProfile } from '../services/zapperService';

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
  
  // Get Farcaster profile for a username or FID
  const getFarcasterProfile = useCallback(async (usernameOrFid) => {
    if (!usernameOrFid) {
      return null;
    }
    
    try {
      console.log(`Fetching Farcaster profile for ${usernameOrFid}`);
      // Use the imported zapperService to get real profile data
      const profile = await zapperGetFarcasterProfile(usernameOrFid);
      return profile;
    } catch (err) {
      console.error(`Error fetching Farcaster profile:`, err);
      throw err; // Re-throw the error to be handled by the caller
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
  
  // New function: Fetch all NFTs for multiple wallets
  const fetchAllNFTsForWallets = useCallback(async (walletAddresses, options = {}) => {
    if (!walletAddresses || walletAddresses.length === 0) {
      console.warn('No wallet addresses provided to fetchAllNFTsForWallets');
      return { nfts: [], hasMore: false };
    }
    
    try {
      // Set loading state
      setIsLoading(true);
      setError(null);
      
      // Initialize fetch progress tracking
      const initialProgress = {};
      walletAddresses.forEach(address => {
        initialProgress[address] = { 
          completed: false, 
          pagesFetched: 0, 
          totalNFTs: 0,
          hasMore: true 
        };
      });
      setFetchProgress(initialProgress);
      
      console.log(`Starting batch fetch for ${walletAddresses.length} wallets`);
      
      // Determine chains to fetch from (default to ETH if not specified)
      const chains = options.chains || ['eth'];
      
      let allNFTs = [];
      
      // Process each chain
      for (const chain of chains) {
        console.log(`Fetching NFTs from chain: ${chain}`);
        
        // Process each wallet with pagination
        const walletPromises = walletAddresses.map(async (address) => {
          let walletNFTs = [];
          let currentPageKey = null;
          let hasMorePages = true;
          let pagesFetched = 0;
          
          // Fetch initial data
          const pageSize = options.pageSize || 100; // Maximize page size for efficiency
          
          while (hasMorePages) {
            try {
              // Use the directAlchemyService for fetching
              const result = await services.alchemy.getNFTsForOwner(
                address,
                chain,
                {
                  pageKey: currentPageKey,
                  pageSize: pageSize,
                  excludeSpam: options.excludeSpam !== false,
                  withMetadata: true
                }
              );
              
              // Add the wallet address to each NFT for tracking
              const nftsWithWalletInfo = result.nfts.map(nft => ({
                ...nft,
                ownerAddress: address
              }));
              
              // Add to our collection
              walletNFTs = [...walletNFTs, ...nftsWithWalletInfo];
              
              // Update pagination state
              currentPageKey = result.pageKey;
              hasMorePages = !!result.pageKey;
              pagesFetched++;
              
              // Update progress state
              setFetchProgress(prev => ({
                ...prev,
                [address]: {
                  ...prev[address],
                  pagesFetched,
                  totalNFTs: walletNFTs.length,
                  hasMore: hasMorePages
                }
              }));
              
              // Add a small delay to avoid rate limiting
              if (hasMorePages) {
                await new Promise(resolve => setTimeout(resolve, 250));
              }
            } catch (error) {
              console.error(`Error fetching NFTs for wallet ${address} on ${chain}:`, error);
              // Move to the next wallet on error
              hasMorePages = false;
            }
          }
          
          // Mark this wallet as completed
          setFetchProgress(prev => ({
            ...prev,
            [address]: {
              ...prev[address],
              completed: true,
              hasMore: false
            }
          }));
          
          console.log(`Completed fetch for wallet ${address}: ${walletNFTs.length} NFTs`);
          return walletNFTs;
        });
        
        // Wait for all wallet fetches to complete for this chain
        const chainResults = await Promise.all(walletPromises);
        
        // Combine results from this chain
        const chainNFTs = chainResults.flat();
        allNFTs = [...allNFTs, ...chainNFTs];
      }
      
      // Add to loaded wallets tracking
      setLoadedWallets(prev => {
        const newWallets = [...prev];
        walletAddresses.forEach(address => {
          if (!newWallets.includes(address)) {
            newWallets.push(address);
          }
        });
        return newWallets;
      });
      
      // Deduplicate NFTs (same NFT might appear in multiple wallets)
      const uniqueNFTMap = new Map();
      allNFTs.forEach(nft => {
        // Use normalized ID as the key
        const normalizedId = normalizeId(nft);
        if (normalizedId) {
          // If we already have this NFT, update the owners array
          if (uniqueNFTMap.has(normalizedId)) {
            const existingNFT = uniqueNFTMap.get(normalizedId);
            const ownerAddresses = existingNFT.ownerAddresses || [existingNFT.ownerAddress];
            if (!ownerAddresses.includes(nft.ownerAddress)) {
              ownerAddresses.push(nft.ownerAddress);
            }
            uniqueNFTMap.set(normalizedId, {
              ...existingNFT,
              ownerAddresses
            });
          } else {
            // First time seeing this NFT
            uniqueNFTMap.set(normalizedId, {
              ...nft,
              ownerAddresses: [nft.ownerAddress]
            });
          }
        }
      });
      
      // Convert the Map to array
      const uniqueNFTs = Array.from(uniqueNFTMap.values());
      console.log(`Total unique NFTs fetched: ${uniqueNFTs.length}`);
      
      // NEW: Enhance the NFTs with additional metadata and price information
      console.log("Enhancing NFTs with price data...");
      setFetchProgress(prev => {
        const enhancedProgress = {...prev};
        Object.keys(enhancedProgress).forEach(address => {
          enhancedProgress[address] = {
            ...enhancedProgress[address],
            enhancing: true,
            completed: false
          };
        });
        return enhancedProgress;
      });
      
      // Process each chain separately
      let enhancedNFTs = [...uniqueNFTs];
      for (const chain of chains) {
        // Get NFTs for this chain
        const chainNFTs = enhancedNFTs.filter(nft => 
          (nft.network || nft.chain || 'eth').toLowerCase() === chain.toLowerCase()
        );
        
        if (chainNFTs.length > 0) {
          console.log(`Enhancing ${chainNFTs.length} NFTs from ${chain} chain`);
          
          try {
            // Enhance NFTs for this chain with price and metadata
            const enhancedChainNFTs = await services.alchemy.enhanceNFTsWithMetadata(
              chainNFTs,
              chain,
              { refreshCache: options.refreshCache }
            );
            
            // Replace the chain NFTs with enhanced versions
            enhancedNFTs = enhancedNFTs.map(nft => {
              const nftChain = (nft.network || nft.chain || 'eth').toLowerCase();
              if (nftChain === chain.toLowerCase()) {
                const normalizedId = normalizeId(nft);
                const enhancedNFT = enhancedChainNFTs.find(e => normalizeId(e) === normalizedId);
                return enhancedNFT || nft;
              }
              return nft;
            });
            
            console.log(`Enhanced ${enhancedChainNFTs.length} NFTs from ${chain} chain`);
          } catch (error) {
            console.error(`Error enhancing NFTs from ${chain} chain:`, error);
            // Continue with other chains
          }
        }
      }
      
      // Mark enhancement as complete
      setFetchProgress(prev => {
        const enhancedProgress = {...prev};
        Object.keys(enhancedProgress).forEach(address => {
          enhancedProgress[address] = {
            ...enhancedProgress[address],
            enhancing: false,
            completed: true
          };
        });
        return enhancedProgress;
      });
      
      // Update the main NFTs state with enhanced NFTs
      setNfts(prev => {
        const combinedNFTs = [...prev, ...enhancedNFTs];
        // Deduplicate again in case there's overlap with previous state
        const dedupMap = new Map();
        combinedNFTs.forEach(nft => {
          const id = normalizeId(nft);
          if (id && !dedupMap.has(id)) {
            dedupMap.set(id, nft);
          }
        });
        return Array.from(dedupMap.values());
      });
      
      // Set hasMore to false since we've fetched all NFTs from all wallets
      setHasMore(false);
      
      return {
        nfts: enhancedNFTs,
        hasMore: false,
        loadedWallets: walletAddresses
      };
    } catch (err) {
      console.error('Error in fetchAllNFTsForWallets:', err);
      setError(err.message || 'Failed to fetch NFTs for connected wallets');
      return { nfts: [], hasMore: false };
    } finally {
      setIsLoading(false);
    }
  }, [normalizeId, services.alchemy]);
  
  // When processing NFTs, make sure to extract all image and price data
  const processNFTs = async (nfts, options = {}) => {
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
  };
  
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