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
      
      const enhancedNFTs = nfts
        .filter(nft => nft !== null && nft !== undefined) // Filter out null/undefined entries
        .map(nft => {
          try {
            // Skip NFTs that don't have the minimum required properties
            if (!nft || typeof nft !== 'object') {
              console.warn('Invalid NFT object:', nft);
              return null;
            }

            // Create a unique id if not present
            const network = nft.network || nft.chain || 'eth';
            const tokenId = (nft.tokenId || '0').toString();
            const contractAddress = nft.contract?.address || nft.contractAddress || 'unknown';
            
            const id = nft.id || 
              (contractAddress && tokenId ? 
                `${network}:${contractAddress}-${tokenId}` : 
                `unknown-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`);
            
            let imageUrl = '';
            let mediaType = 'image';
            
            // Safely extract media data
            try {
              // Image handling - based on Alchemy V3 API structure
              // 1. Alchemy image.gateway is the most reliable source
              if (nft.image) {
                if (typeof nft.image === 'object' && nft.image !== null) {
                  imageUrl = nft.image.gateway || nft.image.url || nft.image.thumbnail || '';
                } else if (typeof nft.image === 'string') {
                  imageUrl = nft.image;
                }
              } 
              // 2. Media array with gateway URLs
              else if (nft.media) {
                if (Array.isArray(nft.media)) {
                  // Safely find a media item with a valid URL
                  const mediaItem = nft.media.find(m => m && 
                    (typeof m === 'object' && (m.gateway || m.thumbnail || m.raw || m.uri)));
                  
                  if (mediaItem) {
                    imageUrl = mediaItem.gateway || mediaItem.thumbnail || mediaItem.raw || mediaItem.uri || '';
                    mediaType = mediaItem.format || 'image';
                  }
                } 
                // 3. Handle single media object (not array)
                else if (nft.media && typeof nft.media === 'object') {
                  const mediaObj = nft.media;
                  imageUrl = mediaObj.gateway || mediaObj.thumbnail || mediaObj.raw || mediaObj.uri || '';
                  mediaType = mediaObj.format || 'image';
                }
              }
              // 4. Check raw metadata
              if (!imageUrl && nft.metadata) {
                imageUrl = nft.metadata.image || nft.metadata.image_url || '';
              }
              // 5. Check tokenUri
              if (!imageUrl && nft.tokenUri && nft.tokenUri.gateway) {
                imageUrl = nft.tokenUri.gateway;
              }
              // 6. Check contract metadata
              if (!imageUrl && nft.contractMetadata && nft.contractMetadata.openSea) {
                imageUrl = nft.contractMetadata.openSea.imageUrl || '';
              }
            } catch (mediaError) {
              console.error('Error extracting media data:', mediaError);
              imageUrl = '';
            }

            // Ensure we have contract information
            let contractName = 'Unknown Collection';
            try {
              contractName = 
                (nft.contract?.name) || 
                (nft.contractMetadata?.name) || 
                (nft.title ? nft.title.split('#')[0].trim() : 'Unknown Collection');
            } catch (contractError) {
              console.error('Error extracting contract name:', contractError);
            }
            
            // Ensure we have title/name
            let title = '';
            let name = '';
            try {
              title = nft.title || nft.name || `#${tokenId || '?'}`;
              name = nft.name || nft.title || `${contractName} #${tokenId || '?'}`;
            } catch (nameError) {
              title = `NFT #${tokenId || '?'}`;
              name = `NFT #${tokenId || '?'}`;
            }
            
            // Ensure we have owner information
            const ownerAddress = nft.ownerAddress || nft.owner || '';
            
            return {
              id,
              tokenId,
              contractAddress,
              title,
              name,
              description: nft.description || '',
              network,
              image: {
                url: imageUrl,
                type: mediaType
              },
              contract: {
                name: contractName,
                address: contractAddress,
                type: nft.contract?.tokenType || 'ERC721'
              },
              ownerAddress
            };
          } catch (err) {
            console.error('Error enhancing NFT:', err, 'NFT:', JSON.stringify(nft).slice(0, 200) + '...');
            // Return minimal valid NFT to avoid breaking the app
            return {
              id: `unknown-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
              title: 'Unknown NFT',
              name: 'Unknown NFT',
              description: 'Error processing NFT data',
              network: 'eth',
              image: { url: '', type: 'image' },
              contract: { name: 'Unknown', address: '', type: 'ERC721' },
              ownerAddress: ''
            };
          }
        })
        .filter(Boolean); // Remove any null entries
      
      return enhancedNFTs;
    } catch (e) {
      console.error('Error in processNFTs:', e);
      // Return a safe array of basic NFT objects if processing fails completely
      return nfts.map((nft, index) => ({
        id: `fallback-${index}-${Date.now()}`,
        title: 'NFT Data Error',
        name: 'NFT Data Error',
        description: 'Could not process NFT data',
        image: { url: '', type: 'image' },
        contract: { name: 'Unknown', address: '', type: 'ERC721' },
        ownerAddress: ''
      }));
    }
  }, []);
  
  // Apply filters to NFTs based on current filter settings
  const applyFilters = useCallback((nfts) => {
    if (!nfts || !Array.isArray(nfts) || nfts.length === 0) {
      console.log('applyFilters received empty or invalid NFT array');
      return [];
    }

    console.log(`Starting filter process with ${nfts.length} NFTs`);
    let filtered = [...nfts];
    
    // Filter by selected chain
    if (selectedChains.length > 0 && !selectedChains.includes('all')) {
      console.log(`Filtering by chains: ${selectedChains.join(', ')}`);
      const beforeCount = filtered.length;
      filtered = filtered.filter(nft => {
        if (!nft) return false;
        const network = nft.network || nft.chain || 'eth';
        return selectedChains.includes(network);
      });
      console.log(`After chain filtering: ${filtered.length} NFTs (removed ${beforeCount - filtered.length})`);
    }
    
    // Filter by search query
    if (searchQuery) {
      console.log(`Filtering by search query: ${searchQuery}`);
      const query = searchQuery.toLowerCase();
      const beforeCount = filtered.length;
      filtered = filtered.filter(nft => {
        if (!nft) return false;
        // Search in title, description, contract, token ID
        return (
          (nft.name && nft.name.toLowerCase().includes(query)) ||
          (nft.description && nft.description.toLowerCase().includes(query)) ||
          (nft.contract?.name && nft.contract.name.toLowerCase().includes(query)) ||
          (nft.tokenId && String(nft.tokenId).toLowerCase().includes(query))
        );
      });
      console.log(`After search filtering: ${filtered.length} NFTs (removed ${beforeCount - filtered.length})`);
    }
    
    // Filter out spam NFTs if enabled
    if (excludeSpam) {
      console.log('Filtering out spam NFTs');
      const beforeCount = filtered.length;
      filtered = filtered.filter(nft => {
        if (!nft) return false;
        return !nft.isSpam;
      });
      console.log(`After spam filtering: ${filtered.length} NFTs (removed ${beforeCount - filtered.length})`);
    }

    // Ensure we don't have undefined/null entries
    const finalCount = filtered.length;
    filtered = filtered.filter(nft => nft && typeof nft === 'object');
    if (finalCount !== filtered.length) {
      console.log(`Removed ${finalCount - filtered.length} invalid NFT entries`);
    }
    
    console.log(`Filter process complete. Final count: ${filtered.length} NFTs`);
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
      let chainsToFetch = [...selectedChains];
      
      // If no chains selected or only 'all' is selected, use specific chains
      if (chainsToFetch.length === 0 || (chainsToFetch.length === 1 && chainsToFetch[0] === 'all')) {
        // For performance, limit to Ethereum and maybe one or two more major L2s
        // This reduces the number of API calls and chances of timeouts
        chainsToFetch = ['eth'];
      }
      
      console.log(`Will fetch from chains: ${chainsToFetch.join(', ')}`);
      
      // Store all NFTs from all chains
      let allNFTs = [];
      let hasErrors = false;
      
      // Check if directAlchemyService is available
      if (!directAlchemyService) {
        console.error('directAlchemyService is not available');
        throw new Error('NFT service not properly initialized');
      }
      
      // Check if batchFetchNFTs function exists
      if (typeof directAlchemyService.batchFetchNFTs !== 'function') {
        console.error('batchFetchNFTs function is not available');
        throw new Error('NFT service missing required functions');
      }
      
      // Fetch from each selected chain with retry logic
      for (const chain of chainsToFetch) {
        try {
          console.log(`Fetching NFTs from ${chain}`);
          
          // Make a single request to batchFetchNFTs which now handles all addresses internally
          const response = await directAlchemyService.batchFetchNFTs(
            validAddresses,
            chain,
            {
              excludeSpam: excludeSpam,
              withMetadata: true,
              pageSize: 25 // Limit page size to reduce payload size
            }
          );
          
          // Ensure we got a valid response
          if (!response) {
            console.warn(`Null or undefined response from ${chain}`);
            continue;
          }
          
          // Enhanced debug logging to trace NFT data
          console.log(`Response from ${chain}:`, {
            hasNfts: !!response.nfts,
            nftsIsArray: Array.isArray(response.nfts),
            nftsLength: Array.isArray(response.nfts) ? response.nfts.length : 'N/A',
            totalCount: response.totalCount || 0,
            hasMore: !!response.hasMore
          });
          
          // Ensure nfts is an array even if response structure is unexpected
          const nfts = Array.isArray(response.nfts) ? response.nfts : [];
          console.log(`Retrieved ${nfts.length} NFTs from ${chain}`);
          
          // Log first NFT for debugging (if available)
          if (nfts.length > 0) {
            const sampleNft = nfts[0];
            console.log(`Sample NFT (first of ${nfts.length}) from ${chain}:`, {
              id: sampleNft.id,
              name: sampleNft.name || 'No name',
              contractAddress: sampleNft.contractAddress || 'No address',
              network: sampleNft.network || chain,
              ownerAddress: sampleNft.ownerAddress || 'No owner'
            });
          }
          
          // Add successfully fetched NFTs to the collection
          if (nfts.length > 0) {
            // Ensure we set the network property correctly
            const nftsWithNetwork = nfts.map(nft => ({
              ...nft,
              network: nft.network || chain // Ensure network is set
            }));
            allNFTs = [...allNFTs, ...nftsWithNetwork];
          } else {
            console.warn(`No NFTs found from ${chain}, continuing`);
          }
        } catch (chainError) {
          console.error(`Failed to process chain ${chain}:`, chainError);
          hasErrors = true;
          // Continue with next chain instead of failing completely
        }
      }
      
      // Protect against empty array
      if (!allNFTs || !Array.isArray(allNFTs)) {
        console.warn('allNFTs is not a valid array, creating empty array');
        allNFTs = [];
      }
      
      console.log(`Total raw NFTs fetched across all chains: ${allNFTs.length}`);
      
      // EARLY EXIT: If no NFTs were found, return early
      if (allNFTs.length === 0) {
        console.log('No NFTs found for any of the provided wallets. Returning empty result.');
        setNfts([]);
        setIsBatchLoading(false);
        return { nfts: [], hasMore: false, error: null };
      }
      
      // Process all NFTs to ensure consistent structure - handle errors gracefully
      let processedNFTs = [];
      try {
        processedNFTs = await processNFTs(allNFTs);
        console.log(`Successfully processed ${processedNFTs.length} NFTs from raw data`);
        
        // Log a sample of processed NFTs if available
        if (processedNFTs.length > 0) {
          console.log('Sample processed NFT:', {
            id: processedNFTs[0].id,
            name: processedNFTs[0].name,
            network: processedNFTs[0].network,
            owner: processedNFTs[0].ownerAddress
          });
        }
      } catch (processError) {
        console.error('Error processing NFTs:', processError);
        console.log('Using raw NFTs instead of processed ones due to error');
        
        // Attempt to sanitize raw NFTs at minimum
        processedNFTs = allNFTs.filter(nft => nft && typeof nft === 'object');
        console.log(`After sanitizing raw NFTs: ${processedNFTs.length} valid NFTs remain`);
      }
      
      // EARLY EXIT: If all NFTs were filtered out during processing, return empty result
      if (processedNFTs.length === 0) {
        console.log('All NFTs were filtered out during processing. Returning empty result.');
        setNfts([]);
        setIsBatchLoading(false);
        return { nfts: [], hasMore: false, error: null };
      }
      
      // Apply filtering - handle errors gracefully
      let filteredNFTs = [];
      try {
        // Skip filtering if selected chains includes 'all' and no other filters are active
        const shouldSkipFiltering = 
          (selectedChains.length === 0 || 
           (selectedChains.length === 1 && selectedChains[0] === 'all')) && 
          !searchQuery && 
          !excludeSpam;
          
        if (shouldSkipFiltering) {
          console.log('Skipping filtering as no active filters are applied');
          filteredNFTs = processedNFTs;
        } else {
          filteredNFTs = applyFilters(processedNFTs);
        }
        
        console.log(`After filtering: ${filteredNFTs.length} NFTs remain`);
      } catch (filterError) {
        console.error('Error filtering NFTs:', filterError);
        filteredNFTs = processedNFTs; // Use unfiltered NFTs if filtering fails
        console.log('Using unfiltered NFTs due to error');
      }
      
      // EARLY EXIT: If all NFTs were filtered out, return empty result with explanation
      if (filteredNFTs.length === 0) {
        console.log('All NFTs were filtered out by current filter settings. Returning empty result with explanation.');
        setNfts([]);
        setIsBatchLoading(false);
        return { 
          nfts: [], 
          hasMore: false, 
          error: "No NFTs matched your current filter settings. Try adjusting your filters." 
        };
      }
      
      // Sort NFTs if needed
      let sortedNFTs = [];
      try {
        sortedNFTs = sortOrder === 'asc' ? 
          [...filteredNFTs].sort((a, b) => (a.name || '').localeCompare(b.name || '')) : 
          [...filteredNFTs].sort((a, b) => (b.name || '').localeCompare(a.name || ''));
        console.log(`Sorted ${sortedNFTs.length} NFTs by name (${sortOrder})`);
      } catch (sortError) {
        console.error('Error sorting NFTs:', sortError);
        sortedNFTs = filteredNFTs; // Use unsorted NFTs if sorting fails
        console.log('Using unsorted NFTs due to error');
      }
      
      // Update state with the final NFTs
      setNfts(sortedNFTs);
      setIsBatchLoading(false);
      
      // Determine the appropriate error message
      let errorMessage = null;
      if (hasErrors) {
        errorMessage = "Some NFTs may not have been retrieved due to API errors";
      }
      
      if (allNFTs.length > 0 && processedNFTs.length === 0) {
        errorMessage = "Unable to process any of the retrieved NFTs";
      }
      
      if (processedNFTs.length > 0 && filteredNFTs.length === 0) {
        errorMessage = "All NFTs were filtered out by your current filter settings";
      }
      
      if (allNFTs.length === 0) {
        // Be more specific about why no NFTs were found
        if (validAddresses.length === 0) {
          errorMessage = "No valid wallet addresses provided";
        } else if (validAddresses.length === 1) {
          errorMessage = `No NFTs found for wallet ${validAddresses[0]}`;
        } else {
          errorMessage = `No NFTs found in any of the ${validAddresses.length} wallets`;
        }
      }
      
      // Log the final result with detailed information
      console.log(`Final NFT processing summary:`, {
        initialAddressCount: addresses ? addresses.length : 0,
        validAddressCount: validAddresses ? validAddresses.length : 0,
        rawNftCount: allNFTs.length,
        processedNftCount: processedNFTs.length,
        filteredNftCount: filteredNFTs.length,
        sortedNftCount: sortedNFTs.length,
        hasErrors,
        errorMessage
      });
      
      // CRITICAL FIX: Return the actual NFTs we've gathered
      const result = {
        nfts: sortedNFTs, 
        hasMore: false, 
        error: errorMessage
      };
      
      console.log(`Final result returning ${result.nfts.length} NFTs to caller${result.error ? ' with error: ' + result.error : ''}`);
      
      return result;
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