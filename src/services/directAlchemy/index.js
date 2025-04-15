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
    
    // Wait for the delay period - wrap in try/catch to prevent "i is not a function" errors
    try {
      await new Promise(resolve => setTimeout(resolve, delay));
    } catch (timeoutError) {
      console.error('Error in delay timeout:', timeoutError);
      // Continue without delay if setTimeout fails for some reason
    }
    
    // Retry with exponential backoff - wrap in try/catch
    try {
      return await fetchWithRetry(config, retries - 1, delay * 2);
    } catch (retryError) {
      console.error('Error in retry:', retryError);
      throw retryError; // Re-throw the error after logging
    }
  }
};

/**
 * Fetch NFTs for an address (main method) - SIMPLIFIED VERSION
 */
const fetchNFTsForAddress = async (address, chain = 'eth', options = {}) => {
  if (!address) {
    console.error('No address provided to fetchNFTsForAddress');
    return { nfts: [], pageKey: null, hasMore: false };
  }
  
  try {
    // Normalize the address
    const normalizedAddress = address.toLowerCase().trim();
    
    // Build the API URL - directly construct it to avoid any issues
    const apiUrl = `${ALCHEMY_PROXY_URL}?endpoint=${NFT_ENDPOINTS.getNftsForOwner}&chain=${chain}`;
    
    // Build query parameters
    const params = {
      owner: normalizedAddress,
      pageSize: options.pageSize || 100,
      withMetadata: options.withMetadata !== false,
      excludeSpam: options.excludeSpam !== false,
      includeMedia: true // Always include media data
    };
    
    // Add pageKey if provided
    if (options.pageKey) {
      params.pageKey = options.pageKey;
    }
    
    console.log(`Fetching NFTs for ${normalizedAddress} on ${chain}`, { method: 'get', url: apiUrl, params });
    
    // Use a direct axios call with no retries to simplify debugging
    try {
      const response = await axios({
        method: 'get',
        url: apiUrl,
        params,
        timeout: options.timeout || 30000
      });
      
      if (!response || !response.data) {
        console.warn(`Empty or invalid response from API for ${normalizedAddress}`);
        return { nfts: [], pageKey: null, hasMore: false };
      }
      
      // Safety check for ownedNfts 
      const ownedNfts = response.data.ownedNfts || [];
      if (!Array.isArray(ownedNfts)) {
        console.warn(`Invalid ownedNfts data: not an array`);
        return { nfts: [], pageKey: null, hasMore: false };
      }
      
      // Process NFTs with basic formatting
      const formattedNfts = ownedNfts.map(nft => {
        try {
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
            media: nft.media || {},
            timeLastUpdated: nft.timeLastUpdated || new Date().toISOString(),
          };
        } catch (err) {
          console.warn('Error formatting NFT:', err);
          return {
            id: `${chain}:unknown-${Math.random().toString(36).substring(7)}`,
            tokenId: '0',
            contractAddress: 'unknown',
            name: 'Error Processing NFT',
            description: '',
            network: chain,
            ownerAddress: normalizedAddress,
            collection: { name: 'Unknown', symbol: '', tokenType: 'UNKNOWN' },
            metadata: {},
            media: {},
          };
        }
      });
      
      console.log(`Successfully processed ${formattedNfts.length} NFTs for ${normalizedAddress}`);
      
      return {
        nfts: formattedNfts,
        pageKey: response.data.pageKey || null,
        hasMore: !!response.data.pageKey
      };
    } catch (apiError) {
      console.error(`Direct API error for ${normalizedAddress}:`, apiError.message);
      return { nfts: [], pageKey: null, hasMore: false };
    }
  } catch (error) {
    console.error(`Overall error fetching NFTs for ${address}:`, error.message);
    return { nfts: [], pageKey: null, hasMore: false };
  }
};

// Alias for compatibility
const getNFTsForOwner = fetchNFTsForAddress;

/**
 * Fetch NFTs for multiple addresses simultaneously
 * Ultra-simplified implementation with minimal dependencies
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

  console.log(`Batch fetching NFTs for ${validAddresses.length} addresses on ${chain}`);
  
  // Store all results
  const allNfts = [];
  let totalCount = 0;
  
  // Process each address one by one (sequential to avoid rate limits)
  for (const address of validAddresses) {
    try {
      const normalizedAddress = address.toLowerCase().trim();
      console.log(`Processing address ${normalizedAddress}`);
      
      // Simple direct fetch
      const result = await fetchNFTsForAddress(normalizedAddress, chain, options);
      
      // Process results if valid
      if (result && Array.isArray(result.nfts)) {
        // Make sure each NFT has the owner address
        const nftsWithOwner = result.nfts.map(nft => ({
          ...nft,
          ownerAddress: normalizedAddress
        }));
        
        // Add to our collection
        allNfts.push(...nftsWithOwner);
        totalCount += nftsWithOwner.length;
        
        console.log(`Found ${nftsWithOwner.length} NFTs for ${normalizedAddress}`);
      } else {
        console.warn(`No valid NFTs found for ${normalizedAddress}`);
      }
    } catch (addressError) {
      console.error(`Error processing address ${address}:`, addressError.message);
      // Continue to next address
    }
  }
  
  console.log(`Successfully processed ${allNfts.length} NFTs from ${validAddresses.length} addresses`);
  
  return {
    nfts: allNfts,
    totalCount: totalCount,
    pageKey: null, // No pagination for batch requests
    hasMore: false
  };
};

/**
 * Export the service
 */
module.exports = {
  fetchNFTsForAddress,
  getNFTsForOwner,
  batchFetchNFTs,
}; 