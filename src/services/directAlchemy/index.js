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
  
  // This function is no longer used since we always use the proxy
  // Left for reference in case direct API access is needed in the future
  return `https://${chainUrl}.g.alchemy.com/nft/v3/`;
};

// Helper to build the API URL
const buildApiUrl = (endpoint, chain) => {
  // Always use the proxy API, never direct
  // Make sure the chain parameter is included
  const chainParam = chain || 'eth';
  
  // Ensure we have a valid proxy URL with proper formatting
  let proxyUrl = ALCHEMY_PROXY_URL;
  
  // Make sure the URL doesn't have double slashes
  if (proxyUrl.endsWith('/') && endpoint.startsWith('/')) {
    proxyUrl = proxyUrl.slice(0, -1);
  }
  
  console.log(`Building proxy URL for chain: ${chainParam}`);
  return `${proxyUrl}?endpoint=${endpoint}&chain=${chainParam}`;
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
 * Helper function to retry a failed request with exponential backoff
 */
const fetchWithRetry = async (config, retries = 3, delay = 1000) => {
  try {
    return await axios(config);
  } catch (error) {
    if (retries === 0) {
      // Enhance error message when throwing
      let errorMessage = error.message || 'Unknown error';
      
      // Create a more descriptive error if possible
      const enhancedError = new Error(`Max retries reached: ${errorMessage}`);
      enhancedError.originalError = error;
      enhancedError.config = config;
      enhancedError.status = error.response?.status;
      
      // Include response data if available for debugging
      if (error.response && error.response.data) {
        enhancedError.responseData = error.response.data;
      }
      
      console.error('Fetch failed after all retries:', {
        url: config.url,
        method: config.method,
        errorMessage,
        status: error.response?.status
      });
      
      throw enhancedError;
    }
    
    console.warn(`Request failed, retrying (${retries} attempts left):`, error.message);
    
    // Wait for the delay period
    await new Promise(resolve => setTimeout(resolve, delay));
    
    // Retry with exponential backoff
    return fetchWithRetry(config, retries - 1, delay * 2);
  }
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
      includeMedia: true, // Always include media data
    };
    
    // Add pageKey if provided
    if (options.pageKey) {
      params.pageKey = options.pageKey;
    }
    
    // Build the request config with timeout
    const requestConfig = {
      method: 'get',
      url: apiUrl,
      params,
      timeout: options.timeout || 30000, // 30 second timeout
    };
    
    console.log(`Fetching NFTs for ${normalizedAddress} on ${chain}`, requestConfig);
    
    // Make the request with retry logic
    const response = await fetchWithRetry(requestConfig, 3);
    
    // Process the response
    if (!response.data) {
      throw new Error('No data received from Alchemy API');
    }
    
    // Map the response to our expected format
    const result = {
      nfts: Array.isArray(response.data.ownedNfts) ? response.data.ownedNfts.map(nft => {
        try {
          // Safely extract media data with fallbacks
          let media = {};
          
          // Handle different media formats safely
          if (nft.media) {
            if (Array.isArray(nft.media) && nft.media.length > 0) {
              const firstMedia = nft.media[0] || {};
              media = {
                original: firstMedia.raw || firstMedia.gateway || '',
                gateway: firstMedia.gateway || '',
                thumbnail: firstMedia.thumbnail || '',
                format: firstMedia.format || ''
              };
            } else if (typeof nft.media === 'object') {
              media = {
                original: nft.media.raw || nft.media.gateway || '',
                gateway: nft.media.gateway || '',
                thumbnail: nft.media.thumbnail || '',
                format: nft.media.format || ''
              };
            }
          }
          
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
            media: media,
            timeLastUpdated: nft.timeLastUpdated || new Date().toISOString(),
          };
        } catch (err) {
          console.error('Error processing NFT:', err);
          // Return a minimal valid NFT object on error
          return {
            id: `${chain}:unknown-0`,
            tokenId: '0',
            contractAddress: 'unknown',
            name: 'Error Processing NFT',
            description: '',
            network: chain,
            ownerAddress: normalizedAddress,
            collection: { name: 'Unknown', symbol: '', tokenType: 'UNKNOWN' },
            metadata: {},
            media: { original: '', gateway: '', thumbnail: '', format: '' },
          };
        }
      }) : [],
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
 * Fetch NFTs for multiple addresses simultaneously
 * Simplified implementation to avoid the "i is not a function" error
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

  try {
    console.log(`Batch fetching NFTs for ${validAddresses.length} addresses on ${chain}`);
    
    // For multiple wallets, we need separate requests (this is the fundamental change)
    // Use a straightforward Promise.all approach with proper error handling
    const allNfts = [];
    let totalCount = 0;
    
    // Map each address to its own promise
    const promises = validAddresses.map(address => {
      const normalizedAddress = address.toLowerCase().trim();
      
      // Return a promise that will either resolve with NFTs or resolve with an empty array on error
      return fetchNFTsForAddress(
        normalizedAddress,
        chain,
        {
          pageSize: options.pageSize || 100,
          withMetadata: options.withMetadata !== false,
          excludeSpam: options.excludeSpam !== false
        }
      )
      .then(result => {
        // Process successful results
        if (result && Array.isArray(result.nfts)) {
          // Add owner address to each NFT
          const nftsWithOwner = result.nfts.map(nft => ({
            ...nft,
            ownerAddress: normalizedAddress
          }));
          
          return {
            success: true,
            address: normalizedAddress,
            nfts: nftsWithOwner,
            count: nftsWithOwner.length
          };
        } else {
          console.warn(`No NFTs or invalid response for ${normalizedAddress}`);
          return { 
            success: true, 
            address: normalizedAddress, 
            nfts: [], 
            count: 0 
          };
        }
      })
      .catch(error => {
        // Handle errors for this specific address
        console.error(`Error fetching NFTs for ${normalizedAddress}:`, error.message);
        return { 
          success: false, 
          address: normalizedAddress, 
          error: error.message,
          nfts: [], 
          count: 0 
        };
      });
    });
    
    // Wait for all promises to complete (even those that failed)
    const results = await Promise.all(promises);
    
    // Process all results
    results.forEach(result => {
      if (result && result.success && Array.isArray(result.nfts)) {
        allNfts.push(...result.nfts);
        totalCount += result.count;
      }
    });
    
    console.log(`Successfully processed ${allNfts.length} NFTs from ${validAddresses.length} addresses`);
    
    return {
      nfts: allNfts,
      totalCount: totalCount,
      pageKey: null, // No pagination for batch requests
      hasMore: false
    };
  } catch (error) {
    console.error('Error in batchFetchNFTs:', error);
    return {
      nfts: [],
      totalCount: 0,
      pageKey: null,
      hasMore: false,
      error: error.message
    };
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