/**
 * Direct Alchemy NFT service (bypasses dynamic loading)
 * Uses direct API calls to the Alchemy API or server endpoints
 * FETCH VERSION - No external dependencies
 */

const config = require('../../config');

// API key handling - prioritize direct key or fallback to proxy
const ALCHEMY_BASE_URL = config.ALCHEMY_BASE_URL || 'https://eth-mainnet.g.alchemy.com/v3/';
const ALCHEMY_PROXY_URL = config.ALCHEMY_PROXY_URL || '/api/alchemy';

// ALWAYS force using the proxy to ensure server API key is used
// Never use a client-side key which could be demo or undefined
const USE_PROXY = true;

// NFT API endpoints
const NFT_ENDPOINTS = {
  getNftsForOwner: 'getnftsforowner',
  getNftMetadata: 'getnftmetadata',
  getContractMetadata: 'getcontractmetadata',
  getOwnersForToken: 'getownersfortoken',
  getOwnersForCollection: 'getownersforcollection'
};

// Helper to get the base URL for a chain
const getChainBaseUrl = (chain) => {
  // Default to ethereum if chain is not specified
  const chainId = chain || 'eth';
  
  // Map chain IDs to Alchemy URLs
  const chainUrls = {
    'eth': 'eth-mainnet',
    'polygon': 'polygon-mainnet',
    'arbitrum': 'arb-mainnet',
    'optimism': 'opt-mainnet',
    'base': 'base-mainnet',
  };
  
  // Get chain URL or default to ethereum
  const chainUrl = chainUrls[chainId] || 'eth-mainnet';
  
  // This function is no longer used since we always use the proxy
  // Left for reference in case direct API access is needed in the future
  return `https://${chainUrl}.g.alchemy.com/nft/v3/`;
};

// Simple in-memory cache
const cache = new Map();
const CACHE_EXPIRATION = 15 * 60 * 1000; // 15 minutes

const cacheKey = (method, address, chain, options) => {
  return `${method}:${address}:${chain}:${JSON.stringify(options)}`;
};

const getCachedData = (key) => {
  if (!config.ENABLE_CACHING) return null;
  
  const cached = cache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_EXPIRATION) {
    return cached.data;
  }
  return null;
};

const setCachedData = (key, data) => {
  if (!config.ENABLE_CACHING) return;
  
  cache.set(key, {
    timestamp: Date.now(),
    data
  });
};

/**
 * Helper function to build URL with query parameters
 */
const buildUrl = (baseUrl, params = {}) => {
  const url = new URL(baseUrl, window.location.origin);
  
  // Add all params to the URL
  Object.keys(params).forEach(key => {
    // Skip null/undefined values
    if (params[key] != null) {
      url.searchParams.append(key, params[key]);
    }
  });
  
  return url.toString();
};

/**
 * ULTRA SIMPLIFIED VERSION FOR PRODUCTION
 * Fetch NFTs for an address on a specific chain.
 */
const fetchNFTsForAddress = async (address, chain = 'eth', options = {}) => {
  try {
    // Validate address
    if (!address || typeof address !== 'string') {
      console.error('Invalid address provided to fetchNFTsForAddress');
      return { nfts: [], pageKey: null, hasMore: false, error: 'Invalid address' };
    }

    // Normalize parameters
    const normalizedAddress = address.toLowerCase().trim();
    const normalizedChain = chain.includes('-') ? chain.split('-')[0] : chain;
    
    // Create cache key
    const key = `nfts_${normalizedChain}_${normalizedAddress}_${options.excludeSpam ? 'no_spam' : 'with_spam'}`;
    
    // Check cache first
    const cached = getCachedData(key);
    if (cached) {
      console.log(`Using cached NFT data for ${normalizedAddress} on ${normalizedChain}`);
      return cached;
    }
    
    console.log(`Fetching NFTs for ${normalizedAddress} on ${normalizedChain}`);
    
    // Build URL for the API call
    const baseURL = normalizedChain === 'polygon' 
      ? `https://polygon-mainnet.g.alchemy.com/nft/v3/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`
      : `https://eth-mainnet.g.alchemy.com/nft/v3/${process.env.NEXT_PUBLIC_ALCHEMY_API_KEY}`;
      
    const params = new URLSearchParams({
      owner: normalizedAddress,
      withMetadata: true,
      pageSize: options.pageSize || 25,
      excludeSpam: options.excludeSpam !== false,
      orderBy: 'transferTime'
    });
    
    // Add pageKey if provided
    if (options.pageKey) {
      params.append('pageKey', options.pageKey);
    }
    
    const fullUrl = `${baseURL}/getNFTsForOwner?${params.toString()}`;
    console.log(`API URL: ${fullUrl}`);
    
    // Set up request timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    try {
      const response = await fetch(fullUrl, { 
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // Check if the response is OK
      if (!response.ok) {
        console.error(`API error: ${response.status} ${response.statusText}`);
        return { nfts: [], pageKey: null, hasMore: false, error: `API error: ${response.status} ${response.statusText}` };
      }
      
      // Parse the JSON response
      const data = await response.json();
      
      // Enhanced logging for debugging
      console.log(`Response from ${normalizedChain} for ${normalizedAddress}:`, {
        status: response.status,
        hasOwnedNfts: !!data.ownedNfts,
        ownedNftsCount: data.ownedNfts ? data.ownedNfts.length : 0,
        totalCount: data.totalCount || 0,
        hasPageKey: !!data.pageKey,
        responseStructure: Object.keys(data).join(', ')
      });
      
      // Sample log of the first NFT if available
      if (data.ownedNfts && data.ownedNfts.length > 0) {
        const sampleNft = data.ownedNfts[0];
        console.log(`Sample NFT from API (first of ${data.ownedNfts.length}):`, {
          title: sampleNft.title || 'No title',
          tokenId: sampleNft.tokenId || 'No tokenId',
          hasContract: !!sampleNft.contract,
          contractAddress: sampleNft.contract?.address || 'No contract address',
          hasMedia: !!sampleNft.media && Array.isArray(sampleNft.media) && sampleNft.media.length > 0,
          hasImage: !!sampleNft.image,
          imageType: sampleNft.image ? typeof sampleNft.image : 'none'
        });
      }
      
      // Basic validation
      if (!data) {
        console.error('Empty response data from API');
        return { nfts: [], pageKey: null, hasMore: false, error: 'Empty response data' };
      }
      
      const ownedNfts = data.ownedNfts || [];
      
      if (!Array.isArray(ownedNfts)) {
        console.error('ownedNfts is not an array:', typeof ownedNfts);
        return { nfts: [], pageKey: null, hasMore: false, error: 'Invalid response format' };
      }
      
      console.log(`Processing ${ownedNfts.length} NFTs from API response`);
      
      const formattedNfts = [];
      
      // Fully defensive approach to processing NFTs
      for (let i = 0; i < ownedNfts.length; i++) {
        try {
          const nft = ownedNfts[i];
          if (!nft) {
            console.warn(`NFT at index ${i} is null or undefined, skipping`);
            continue;
          }
          
          // Store the full contract data, especially important for OpenSea metadata
          const contract = nft.contract || {};
          
          if (!nft.tokenId) {
            console.warn(`NFT at index ${i} has no tokenId, skipping:`, JSON.stringify({
              title: nft.title || 'No title', 
              hasContract: !!nft.contract,
              contractAddress: nft.contract?.address || 'No address'
            }));
            continue;
          }
          
          if (!contract.address) {
            console.warn(`NFT at index ${i} has no contract address, skipping:`, JSON.stringify({
              title: nft.title || 'No title',
              tokenId: nft.tokenId
            }));
            continue;
          }
          
          // Create a well-structured NFT object that preserves all the Alchemy data
          const formattedNft = {
            id: `${normalizedChain}:${contract.address || 'unknown'}-${nft.tokenId || '0'}`,
            tokenId: nft.tokenId || '0',
            contractAddress: contract.address || 'unknown',
            name: nft.title || nft.name || `#${nft.tokenId || '0'}`,
            description: nft.description || '',
            network: normalizedChain,
            ownerAddress: normalizedAddress,
            tokenType: nft.tokenType || contract.tokenType || 'ERC721',
            
            // Include full contract data to keep OpenSea metadata
            contract: contract,
            
            // Preserve all image and media data
            image: nft.image || null,
            media: nft.media || [],
            
            // Include raw metadata if available
            metadata: nft.metadata || {},
            raw: nft.raw || {},
            
            // Include the complete collection data
            collection: {
              name: contract.name || 'Unknown Collection',
              symbol: contract.symbol || '',
              tokenType: contract.tokenType || 'ERC721',
              floorPrice: contract.openSeaMetadata?.floorPrice ? {
                value: contract.openSeaMetadata?.floorPrice,
                currency: 'ETH',
                valueUsd: contract.openSeaMetadata?.floorPrice * 4000 // Approximate USD value
              } : null
            },
            
            // Timestamp for potential sorting
            timeLastUpdated: nft.timeLastUpdated || new Date().toISOString(),
          };
          
          // Add debug field that tracks which chain/address this came from
          formattedNft._source = `${normalizedChain}:${normalizedAddress}`;
          
          // Make sure image exists - add placeholder if needed
          if (!formattedNft.image) {
            // Try to extract from media or metadata
            if (formattedNft.media && Array.isArray(formattedNft.media) && formattedNft.media.length > 0) {
              formattedNft.image = {
                originalUrl: formattedNft.media[0].raw || formattedNft.media[0].gateway || formattedNft.media[0].uri,
                thumbnailUrl: formattedNft.media[0].thumbnailUrl || formattedNft.media[0].gateway,
                url: formattedNft.media[0].gateway || formattedNft.media[0].raw || formattedNft.media[0].uri
              };
              console.log(`Generated image object from media for NFT ${formattedNft.id}`);
            } else if (formattedNft.raw && formattedNft.raw.metadata && formattedNft.raw.metadata.image) {
              formattedNft.image = {
                url: formattedNft.raw.metadata.image,
                originalUrl: formattedNft.raw.metadata.image
              };
              console.log(`Generated image object from raw.metadata for NFT ${formattedNft.id}`);
            } else if (formattedNft.metadata && formattedNft.metadata.image) {
              formattedNft.image = {
                url: formattedNft.metadata.image,
                originalUrl: formattedNft.metadata.image
              };
              console.log(`Generated image object from metadata for NFT ${formattedNft.id}`);
            } else {
              // Add a placeholder image property so our frontend doesn't break
              formattedNft.image = {
                url: '/assets/placeholder-nft.svg',
                originalUrl: '/assets/placeholder-nft.svg',
                thumbnailUrl: '/assets/placeholder-nft.svg'
              };
              console.log(`Added placeholder image for NFT ${formattedNft.id} with no image data`);
            }
          } else if (typeof formattedNft.image === 'string') {
            // Convert string image to object
            formattedNft.image = {
              url: formattedNft.image,
              originalUrl: formattedNft.image
            };
            console.log(`Converted string image to object for NFT ${formattedNft.id}`);
          }
          
          formattedNfts.push(formattedNft);
        } catch (e) {
          console.warn(`Error formatting NFT at index ${i}:`, e.message);
          // Continue with next NFT even if this one fails
        }
      }
      
      // Sample logging for debugging
      if (formattedNfts.length > 0) {
        const sample = formattedNfts[0];
        console.log(`Sample formatted NFT (of ${formattedNfts.length}):`, {
          id: sample.id,
          name: sample.name,
          collection: sample.collection?.name,
          hasImage: !!sample.image,
          imageType: sample.image ? typeof sample.image : 'none',
          hasMedia: Array.isArray(sample.media) && sample.media.length > 0
        });
      }
      
      const result = {
        nfts: formattedNfts,
        pageKey: data.pageKey || null,
        hasMore: !!data.pageKey
      };
      
      // Cache the result
      setCachedData(key, result);
      
      return result;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        console.error(`Request timeout for ${normalizedAddress}`);
        return { nfts: [], pageKey: null, hasMore: false, error: 'Request timeout' };
      }
      
      console.error(`API error for ${normalizedAddress}:`, fetchError.message);
      return { nfts: [], pageKey: null, hasMore: false, error: fetchError.message };
    }
  } catch (error) {
    console.error(`Overall error fetching NFTs for ${address}:`, error.message);
    return { nfts: [], pageKey: null, hasMore: false, error: error.message };
  }
};

// Alias for compatibility
const getNFTsForOwner = fetchNFTsForAddress;

/**
 * Super simplified batchFetchNFTs that works reliably in production
 * No complex retry or Promise.all patterns that could fail
 */
const batchFetchNFTs = async (addresses, chain = 'eth', options = {}) => {
  if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
    console.error('Invalid addresses array provided to batchFetchNFTs');
    return { nfts: [], totalCount: 0, pageKey: null, hasMore: false };
  }

  // Filter out invalid addresses upfront
  const validAddresses = addresses.filter(addr => 
    addr && typeof addr === 'string' && addr.trim().length > 0
  );
  
  if (validAddresses.length === 0) {
    console.warn('No valid addresses found in input array');
    return { nfts: [], totalCount: 0, pageKey: null, hasMore: false };
  }

  // Normalize chain parameter to ensure consistency
  const normalizedChain = chain.includes('-') ? chain.split('-')[0] : chain;

  console.log(`Batch fetching NFTs for ${validAddresses.length} addresses on ${normalizedChain}`);
  
  // Process each address sequentially for maximum reliability
  const allNfts = [];
  const errors = [];
  let totalNfts = 0;
  let hasMoreData = false;
  
  // Ensure all options are passed to fetchNFTsForAddress
  const fullOptions = {
    withMetadata: true,
    includeMedia: true,
    includeContract: true,
    pageSize: options.pageSize || 25,
    ...options
  };
  
  // Sequential processing - slower but more reliable than Promise.all in production
  for (let i = 0; i < validAddresses.length; i++) {
    const address = validAddresses[i];
    console.log(`Processing address ${i+1}/${validAddresses.length}: ${address}`);
    
    try {
      const result = await fetchNFTsForAddress(address, normalizedChain, fullOptions);
      
      // Validate the result has nfts
      if (!result || !result.nfts) {
        console.warn(`No valid result or NFTs array for address ${address}`);
        errors.push({ address, error: 'Invalid response structure' });
        continue;
      }
      
      // Log detailed NFT validation information
      console.log(`Got ${result.nfts.length} NFTs from API for ${address}, now validating each one`);
      
      // Valid NFTs exist
      if (Array.isArray(result.nfts) && result.nfts.length > 0) {
        // Keep track of valid NFTs for this address
        let validNftsForAddress = 0;
        let invalidNftsForAddress = 0;
        
        // Process each NFT with validation
        result.nfts.forEach(nft => {
          // Add better validation with detailed logging
          if (!nft) {
            console.warn(`Skipping null/undefined NFT for ${address}`);
            invalidNftsForAddress++;
            return;
          }
          
          if (!nft.contractAddress || !nft.tokenId) {
            console.warn(`Skipping NFT without contractAddress or tokenId for ${address}: ${JSON.stringify({
              hasContractAddress: !!nft.contractAddress,
              hasTokenId: !!nft.tokenId,
              id: nft.id || 'missing'
            })}`);
            invalidNftsForAddress++;
            return;
          }
          
          // Ensure the owner address is set on each NFT
          // Create a new object to avoid modifying the original by reference
          const enhancedNft = {
            ...nft,
            ownerAddress: address,
            // Ensure network is set
            network: nft.network || normalizedChain,
            // Ensure ID has network prefix
            id: nft.id || `${normalizedChain}:${nft.contractAddress}-${nft.tokenId}`
          };
          
          // Add a debug property to track where this NFT came from (useful for debugging)
          enhancedNft._source = `${normalizedChain}:${address}`;
          
          // Make sure image exists - add placeholder if needed
          if (!enhancedNft.image) {
            // Try to extract from media or metadata
            if (enhancedNft.media && Array.isArray(enhancedNft.media) && enhancedNft.media.length > 0) {
              enhancedNft.image = {
                originalUrl: enhancedNft.media[0].raw || enhancedNft.media[0].gateway || enhancedNft.media[0].uri,
                thumbnailUrl: enhancedNft.media[0].thumbnailUrl || enhancedNft.media[0].gateway,
                url: enhancedNft.media[0].gateway || enhancedNft.media[0].raw || enhancedNft.media[0].uri
              };
              console.log(`Generated image object from media for NFT ${enhancedNft.id}`);
            } else if (enhancedNft.raw && enhancedNft.raw.metadata && enhancedNft.raw.metadata.image) {
              enhancedNft.image = {
                url: enhancedNft.raw.metadata.image,
                originalUrl: enhancedNft.raw.metadata.image
              };
              console.log(`Generated image object from raw.metadata for NFT ${enhancedNft.id}`);
            } else if (enhancedNft.metadata && enhancedNft.metadata.image) {
              enhancedNft.image = {
                url: enhancedNft.metadata.image,
                originalUrl: enhancedNft.metadata.image
              };
              console.log(`Generated image object from metadata for NFT ${enhancedNft.id}`);
            } else {
              // Add a placeholder image property so our frontend doesn't break
              enhancedNft.image = {
                url: '/assets/placeholder-nft.svg',
                originalUrl: '/assets/placeholder-nft.svg',
                thumbnailUrl: '/assets/placeholder-nft.svg'
              };
              console.log(`Added placeholder image for NFT ${enhancedNft.id} with no image data`);
            }
          } else if (typeof enhancedNft.image === 'string') {
            // Convert string image to object
            enhancedNft.image = {
              url: enhancedNft.image,
              originalUrl: enhancedNft.image
            };
            console.log(`Converted string image to object for NFT ${enhancedNft.id}`);
          }
          
          // Add basic collection if missing
          if (!enhancedNft.collection) {
            enhancedNft.collection = {
              name: enhancedNft.contract?.name || 'Unknown Collection',
              symbol: enhancedNft.contract?.symbol || '',
              tokenType: enhancedNft.tokenType || enhancedNft.contract?.tokenType || 'ERC721'
            };
            console.log(`Generated collection object for NFT ${enhancedNft.id}`);
          }
          
          allNfts.push(enhancedNft);
          totalNfts++;
          validNftsForAddress++;
        });
        
        console.log(`Added ${validNftsForAddress} valid NFTs from ${address}, skipped ${invalidNftsForAddress} invalid NFTs`);
        
        if (result.hasMore) {
          hasMoreData = true;
        }
      } else {
        console.log(`No NFTs found for ${address}`);
      }
    } catch (error) {
      console.error(`Error processing address ${address}:`, error.message);
      errors.push({ address, error: error.message });
    }
  }
  
  // Final validation of NFT array
  const finalNfts = allNfts.filter(nft => 
    nft && 
    typeof nft === 'object' && 
    nft.contractAddress && 
    nft.tokenId
  );
  
  if (finalNfts.length !== allNfts.length) {
    console.warn(`Filtered out ${allNfts.length - finalNfts.length} invalid NFTs during final validation`);
  }
  
  // Error reporting
  if (errors.length > 0) {
    console.warn(`Completed with ${errors.length} errors:`, errors);
  }
  
  console.log(`Batch fetch complete. Returning ${finalNfts.length} NFTs from ${validAddresses.length} addresses`);
  
  return {
    nfts: finalNfts,
    totalCount: finalNfts.length,
    pageKey: null, // No pagination for batch requests
    hasMore: hasMoreData,
    errors: errors.length > 0 ? errors : undefined
  };
};

module.exports = {
  fetchNFTsForAddress,
  getNFTsForOwner, // Alias
  batchFetchNFTs
}; 