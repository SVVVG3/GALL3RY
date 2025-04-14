/**
 * Direct Alchemy NFT service (bypasses dynamic loading)
 * Uses direct API calls to the Alchemy API or server endpoints
 */

const config = require('../../config');
const axios = require('axios');

// API key handling - prioritize direct key or fallback to proxy
const ALCHEMY_API_KEY = config.ALCHEMY_API_KEY;
const ALCHEMY_BASE_URL = config.ALCHEMY_BASE_URL || 'https://eth-mainnet.g.alchemy.com/v3/';
const ALCHEMY_PROXY_URL = config.ALCHEMY_PROXY_URL || '/api/alchemy';

// ALWAYS use the proxy API to ensure we use the server's API key
const USE_PROXY = true;

// NFT API endpoints
const NFT_ENDPOINTS = {
  getNftsForOwner: 'getNftsForOwner',
  getNftMetadata: 'getNftMetadata',
  getContractMetadata: 'getContractMetadata',
  getOwnersForToken: 'getOwnersForToken',
  getOwnersForCollection: 'getOwnersForCollection'
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
  return `${ALCHEMY_BASE_URL.replace(/\/+$/, '')}/${ALCHEMY_API_KEY}`;
};

// Helper to build the API URL
const buildApiUrl = (endpoint, chain) => {
  if (USE_PROXY) {
    // Use the proxy API
    return `${ALCHEMY_PROXY_URL}?endpoint=${endpoint}&chain=${chain || 'eth'}`;
  } else {
    // Use direct Alchemy API
    return `${getChainBaseUrl(chain)}/nft/v3/${endpoint}`;
  }
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
      nfts: (response.data.ownedNfts || []).map(nft => ({
        id: `${chain}:${nft.contract.address}-${nft.tokenId}`,
        tokenId: nft.tokenId,
        contractAddress: nft.contract.address,
        name: nft.title || `#${nft.tokenId}`,
        description: nft.description || '',
        network: chain,
        ownerAddress: normalizedAddress,
        collection: {
          name: nft.contract.name || 'Unknown Collection',
          symbol: nft.contract.symbol || '',
          tokenType: nft.contract.tokenType || 'ERC721',
        },
        metadata: nft.metadata || {},
        media: {
          original: nft.media[0]?.raw || nft.media[0]?.gateway || '',
          gateway: nft.media[0]?.gateway || '',
          thumbnail: nft.media[0]?.thumbnail || '',
          format: nft.media[0]?.format || '',
        },
        timeLastUpdated: nft.timeLastUpdated,
      })),
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
    return {};
  }
  
  try {
    // Process addresses in parallel with limit
    const results = {};
    const batchSize = 5; // Process 5 addresses at a time
    
    for (let i = 0; i < addresses.length; i += batchSize) {
      const batch = addresses.slice(i, i + batchSize);
      
      // Process batch in parallel
      const batchPromises = batch.map(address => 
        fetchNFTsForAddress(address, chain, options)
          .then(result => ({ address, result }))
      );
      
      // Wait for all promises in this batch
      const batchResults = await Promise.all(batchPromises);
      
      // Add results to the collection
      batchResults.forEach(({ address, result }) => {
        results[address] = result;
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