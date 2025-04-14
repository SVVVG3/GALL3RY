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
 * Helper function to retry a failed request with exponential backoff
 */
const fetchWithRetry = async (config, retries = 3, delay = 1000) => {
  try {
    return await axios(config);
  } catch (error) {
    if (retries === 0) {
      throw error;
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
 * Enhanced with better error handling and retry logic
 */
const batchFetchNFTs = async (addresses, chain = 'eth', options = {}) => {
  if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
    console.error('Invalid addresses array provided to batchFetchNFTs');
    return { nfts: [], totalCount: 0, pageKey: null, hasMore: false };
  }

  // Create an object to track retry attempts for each address
  const retryTracker = {};
  addresses.forEach(addr => {
    retryTracker[addr.toLowerCase()] = 0;
  });

  try {
    console.log(`Batch fetching NFTs for ${addresses.length} addresses on ${chain}`);
    
    // If we're using the proxy API, we can try to use its batch capability
    if (USE_PROXY) {
      try {
        console.log('Using proxy batch API endpoint');
        const response = await axios({
          method: 'post',
          url: `${PROXY_BASE_URL}?endpoint=getnftsforowner&chain=${chain}`,
          data: {
            owners: addresses,
            chain: chain,
            pageSize: options.pageSize || 100,
            withMetadata: options.withMetadata !== false,
            excludeFilters: options.excludeSpam !== false ? ['SPAM'] : [],
            includeMedia: true
          },
          timeout: 30000 // 30 second timeout
        });
        
        // Verify the response structure and return if valid
        if (response.data && Array.isArray(response.data.ownedNfts)) {
          return {
            nfts: response.data.ownedNfts,
            totalCount: response.data.totalCount || response.data.ownedNfts.length,
            pageKey: response.data.pageKey || null,
            hasMore: !!response.data.pageKey
          };
        }
      } catch (error) {
        console.warn('Batch API request failed, falling back to individual requests:', error.message);
        // Continue to individual requests fallback
      }
    }
    
    // Fallback: fetch NFTs for each address individually with retry logic
    console.log('Using individual requests for each address with retry logic');
    
    const allNfts = [];
    let totalCount = 0;
    
    // Maximum number of concurrent requests
    const MAX_CONCURRENT = 3;
    
    // Process addresses in batches to avoid too many concurrent requests
    for (let i = 0; i < addresses.length; i += MAX_CONCURRENT) {
      const batch = addresses.slice(i, i + MAX_CONCURRENT);
      
      // Execute requests for this batch concurrently
      const results = await Promise.all(
        batch.map(async (address) => {
          const normalizedAddress = address.toLowerCase().trim();
          
          // Try up to 3 times for each address
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              retryTracker[normalizedAddress] = attempt;
              
              // Add small delay between retries
              if (attempt > 0) {
                await new Promise(resolve => setTimeout(resolve, attempt * 1000));
                console.log(`Retry #${attempt} for ${normalizedAddress}`);
              }
              
              const result = await fetchNFTsForAddress(
                normalizedAddress,
                chain,
                {
                  pageSize: options.pageSize || 100,
                  withMetadata: options.withMetadata !== false,
                  excludeSpam: options.excludeSpam !== false,
                  timeout: 20000 + (attempt * 5000) // Increase timeout with each retry
                }
              );
              
              // Return successful result
              return {
                success: true,
                address: normalizedAddress,
                nfts: result.nfts || [],
                count: result.nfts ? result.nfts.length : 0
              };
            } catch (error) {
              console.error(`Attempt ${attempt + 1} failed for ${normalizedAddress}:`, error.message);
              
              // If this is the last attempt, return error result
              if (attempt === 2) {
                return {
                  success: false,
                  address: normalizedAddress,
                  error: error.message,
                  nfts: [],
                  count: 0
                };
              }
              // Otherwise continue to next retry attempt
            }
          }
        })
      );
      
      // Process results from this batch
      results.forEach(result => {
        if (result && result.success && Array.isArray(result.nfts)) {
          // Add owner address to each NFT
          const nftsWithOwner = result.nfts.map(nft => ({
            ...nft,
            ownerAddress: result.address
          }));
          
          allNfts.push(...nftsWithOwner);
          totalCount += result.count;
        } else if (result) {
          console.error(`Failed to fetch NFTs for ${result.address}: ${result.error || 'Unknown error'}`);
        }
      });
    }
    
    console.log(`Successfully processed ${allNfts.length} NFTs from ${addresses.length} addresses`);
    
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