/**
 * Direct Alchemy NFT service (bypasses dynamic loading)
 * Uses direct API calls to the Alchemy API or server endpoints
 */

const config = require('../../config');
const axios = require('axios');

// Removed demo key - we will ONLY use the proxy API with server's key
// const DEMO_KEY = 'demo';
// const ALCHEMY_API_KEY = config.ALCHEMY_API_KEY || DEMO_KEY;

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
  // Use server's API key from environment variable through proxy instead
  return `${ALCHEMY_BASE_URL.replace(/\/+$/, '')}/${config.ALCHEMY_API_KEY}`;
};

// Helper to build the API URL
const buildApiUrl = (endpoint, chain) => {
  // Always use the proxy API, never direct
  // Make sure the chain parameter is included
  const chainParam = chain || 'eth';
  console.log(`Building proxy URL for chain: ${chainParam}`);
  return `${ALCHEMY_PROXY_URL}?endpoint=${endpoint}&chain=${chainParam}`;
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
 * Fetch NFTs for an address (main method)
 */
const fetchNFTsForAddress = async (address, chain = 'eth', options = {}) => {
  if (!address) {
    console.error('No address provided to fetchNFTsForAddress');
    return { nfts: [], pageKey: null, hasMore: false };
  }
  
  try {
    // Normalize the address
    const normalizedAddress = address.toLowerCase().trim();
    
    // Generate cache key
    const key = cacheKey('getNftsForOwner', normalizedAddress, chain, options);
    
    // Check cache first
    const cached = getCachedData(key);
    if (cached) {
      console.log(`Cache hit for ${normalizedAddress}`);
      return cached;
    }
    
    // Build the API URL
    const apiUrl = buildApiUrl(NFT_ENDPOINTS.getNftsForOwner, chain);
    
    // Build query parameters
    const params = {
      owner: normalizedAddress,
      pageSize: options.pageSize || 100,
      withMetadata: options.withMetadata !== false,
      excludeSpam: options.excludeSpam !== false,
    };
    
    // Add pageKey if provided
    if (options.pageKey) {
      params.pageKey = options.pageKey;
    }
    
    // Build the request config
    const requestConfig = {
      method: 'get',
      url: apiUrl,
      params,
    };
    
    console.log(`Fetching NFTs for ${normalizedAddress} on ${chain}`, requestConfig);
    
    // Make the request
    const response = await axios(requestConfig);
    
    // Process the response
    if (!response.data) {
      throw new Error('No data received from Alchemy API');
    }
    
    // Map the response to our expected format
    const result = {
      nfts: (response.data.ownedNfts || []).map(nft => {
        // Safely extract media data with fallbacks
        const mediaArray = Array.isArray(nft.media) ? nft.media : [];
        const firstMedia = mediaArray[0] || {};
        
        return {
          id: `${chain}:${nft.contract?.address || 'unknown'}-${nft.tokenId || '0'}`,
          tokenId: nft.tokenId || '0',
          contractAddress: nft.contract?.address || 'unknown',
          name: nft.title || `#${nft.tokenId || '0'}`,
          description: nft.description || '',
          network: chain,
          ownerAddress: normalizedAddress,
          collection: {
            name: nft.contract?.name || 'Unknown Collection',
            symbol: nft.contract?.symbol || '',
            tokenType: nft.contract?.tokenType || 'ERC721',
          },
          metadata: nft.metadata || {},
          media: {
            original: firstMedia.raw || firstMedia.gateway || '',
            gateway: firstMedia.gateway || '',
            thumbnail: firstMedia.thumbnail || '',
            format: firstMedia.format || '',
          },
          timeLastUpdated: nft.timeLastUpdated || new Date().toISOString(),
        };
      }),
      pageKey: response.data.pageKey || null,
      hasMore: !!response.data.pageKey,
    };
    
    // Cache the result
    setCachedData(key, result);
    
    return result;
  } catch (error) {
    console.error(`Error fetching NFTs for ${address}:`, error);
    // Return empty result in case of error
    return { nfts: [], pageKey: null, hasMore: false };
  }
};

// Alias for compatibility
const getNFTsForOwner = fetchNFTsForAddress;

/**
 * Batch fetch NFTs for multiple addresses
 */
const batchFetchNFTs = async (addresses, chain = 'eth', options = {}) => {
  if (!addresses || addresses.length === 0) {
    console.log('No addresses provided to batchFetchNFTs');
    return {};
  }
  
  try {
    // Process addresses in parallel with limit
    const results = {};
    const batchSize = 5; // Process 5 addresses at a time
    
    for (let i = 0; i < addresses.length; i += batchSize) {
      const batch = addresses.slice(i, i + batchSize);
      
      // Improved error handling for each address in the batch
      const batchPromises = batch.map(address => {
        // Ensure address is valid
        if (!address) {
          console.warn('Skipping empty address in batch fetch');
          return Promise.resolve({ address: 'unknown', result: { nfts: [], pageKey: null, hasMore: false } });
        }
        
        // Safely fetch NFTs for this address
        return fetchNFTsForAddress(address, chain, options)
          .then(result => {
            // Ensure we have a valid result object with all required properties
            if (!result) {
              console.warn(`No result returned for address ${address}`);
              return { address, result: { nfts: [], pageKey: null, hasMore: false } };
            }
            
            // Ensure nfts is always an array
            if (!result.nfts || !Array.isArray(result.nfts)) {
              console.warn(`Invalid nfts array for address ${address}, replacing with empty array`);
              result.nfts = [];
            }
            
            // Ensure each NFT has the expected properties
            result.nfts = result.nfts.map(nft => {
              if (!nft) return null;
              
              // Ensure media property exists
              if (!nft.media) {
                nft.media = [];
              }
              
              // Ensure contract property exists
              if (!nft.contract) {
                nft.contract = {};
              }
              
              // Add owner address if not present
              if (!nft.ownerAddress) {
                nft.ownerAddress = address;
              }
              
              return nft;
            }).filter(Boolean); // Remove any null entries
            
            return { address, result };
          })
          .catch(error => {
            // Don't let one failure fail the entire batch
            console.error(`Error in batch fetch for ${address}:`, error.message);
            return { address, result: { nfts: [], pageKey: null, hasMore: false } };
          });
      });
      
      // Wait for all promises in this batch
      const batchResults = await Promise.all(batchPromises);
      
      // Add results to the collection
      batchResults.forEach(({ address, result }) => {
        if (address && result) {
          results[address] = result;
        }
      });
    }
    
    return results;
  } catch (error) {
    console.error('Error in batch fetching NFTs:', error);
    return {};
  }
};

/**
 * Export the service
 */
module.exports = {
  fetchNFTsForAddress,
  getNFTsForOwner,
  batchFetchNFTs,
}; 