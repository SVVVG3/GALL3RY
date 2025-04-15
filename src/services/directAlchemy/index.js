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
 * Simplified version that avoids setTimeout Promise issues in serverless environments
 */
const fetchWithRetry = async (config, retries = 3, delay = 1000) => {
  let lastError = null;
  
  // Try up to retries + 1 times (initial attempt + retries)
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Make the request
      return await axios(config);
    } catch (error) {
      // Save the error for potential re-throw
      lastError = error;
      
      // Log the failure
      console.warn(`Request failed (attempt ${attempt + 1}/${retries + 1}):`, error.message);
      
      // If this was our last attempt, throw the error
      if (attempt >= retries) {
        // Enhance error message when throwing
        let errorMessage = error.message || 'Unknown error';
        
        // Create a more descriptive error that includes attempt info
        const enhancedError = new Error(`Max retries (${retries}) reached: ${errorMessage}`);
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
      
      // If not the last attempt, wait a bit before trying again
      // We'll use a synchronous approach rather than Promises+setTimeout to avoid issues
      const sleepMs = delay * Math.pow(2, attempt);
      console.log(`Waiting ${sleepMs}ms before retry ${attempt + 1}...`);
      
      // Simple sleep function that doesn't use Promise + setTimeout
      // This is a safer approach for serverless environments
      const start = Date.now();
      while (Date.now() - start < sleepMs) {
        // Busy wait - not ideal but guaranteed to work in all environments
        // We only use this for small delays during retries
      }
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
    
    // Simple request with direct error handling - no retries
    try {
      // Make a single request with reasonable timeout
      const response = await axios({
        method: 'get',
        url: apiUrl,
        params,
        timeout: options.timeout || 30000
      });
      
      if (!response || !response.data) {
        console.warn(`Empty or invalid response from API for ${normalizedAddress}`);
        return { nfts: [], pageKey: null, hasMore: false, error: 'Empty response from API' };
      }
      
      // Safety check for ownedNfts 
      const ownedNfts = response.data.ownedNfts || [];
      if (!Array.isArray(ownedNfts)) {
        console.warn(`Invalid ownedNfts data: not an array`);
        return { nfts: [], pageKey: null, hasMore: false, error: 'Invalid NFT data format' };
      }
      
      // Process NFTs with basic formatting - fully defensive approach
      const formattedNfts = [];
      
      for (let i = 0; i < ownedNfts.length; i++) {
        try {
          const nft = ownedNfts[i];
          if (!nft) continue;
          
          // Safely extract properties with defaults
          const tokenId = nft.tokenId || '0';
          const contractAddress = nft.contract?.address || 'unknown';
          const contractName = nft.contract?.name || 'Unknown Collection';
          const contractSymbol = nft.contract?.symbol || '';
          const tokenType = nft.contract?.tokenType || 'ERC721';
          const title = nft.title || `#${tokenId}`;
          const description = nft.description || '';
          
          // Create a formatted NFT with safe defaults
          formattedNfts.push({
            id: `${chain}:${contractAddress}-${tokenId}`,
            tokenId,
            contractAddress,
            name: title,
            description,
            network: chain,
            ownerAddress: normalizedAddress,
            collection: {
              name: contractName,
              symbol: contractSymbol,
              tokenType,
            },
            metadata: nft.metadata || {},
            media: nft.media || {},
            timeLastUpdated: nft.timeLastUpdated || new Date().toISOString(),
          });
        } catch (nftError) {
          // Just log and continue if one NFT fails
          console.warn(`Error formatting NFT at index ${i}:`, nftError.message);
        }
      }
      
      console.log(`Successfully processed ${formattedNfts.length} NFTs for ${normalizedAddress}`);
      
      return {
        nfts: formattedNfts,
        pageKey: response.data.pageKey || null,
        hasMore: !!response.data.pageKey
      };
    } catch (apiError) {
      // Enhanced error logging with more details
      console.error(`API error for ${normalizedAddress}:`, {
        message: apiError.message,
        status: apiError.response?.status,
        statusText: apiError.response?.statusText,
        data: apiError.response?.data,
        code: apiError.code
      });
      
      // Return informative error based on the type of error
      let errorMessage = 'Unknown API error';
      
      if (apiError.code === 'ECONNABORTED') {
        errorMessage = 'Request timeout - the API took too long to respond';
      } else if (apiError.code === 'ECONNREFUSED') {
        errorMessage = 'Connection refused - the API server is not available';
      } else if (apiError.response?.status === 404) {
        errorMessage = 'API endpoint not found';
      } else if (apiError.response?.status === 401 || apiError.response?.status === 403) {
        errorMessage = 'API key unauthorized or invalid';
      } else if (apiError.response?.status >= 500) {
        errorMessage = 'API server error';
      }
      
      return { 
        nfts: [], 
        pageKey: null, 
        hasMore: false, 
        error: errorMessage
      };
    }
  } catch (error) {
    console.error(`Overall error fetching NFTs for ${address}:`, error.message);
    return { 
      nfts: [], 
      pageKey: null, 
      hasMore: false,
      error: `Error fetching NFTs: ${error.message}`
    };
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
  let errors = [];
  
  try {
    // Process each address one by one (sequential to avoid rate limits)
    for (let addrIndex = 0; addrIndex < validAddresses.length; addrIndex++) {
      const address = validAddresses[addrIndex];
      
      try {
        if (!address) continue; // Skip empty addresses
        
        const normalizedAddress = address.toLowerCase().trim();
        console.log(`Processing address ${normalizedAddress} (${addrIndex + 1}/${validAddresses.length})`);
        
        // Simple direct fetch - no retries or complex logic
        const result = await fetchNFTsForAddress(normalizedAddress, chain, options);
        
        // Process results if valid - fully defensive
        if (result && Array.isArray(result.nfts)) {
          // Safety check each NFT before adding
          const validNfts = result.nfts.filter(nft => nft && typeof nft === 'object');
          
          // Make sure each NFT has the owner address
          const nftsWithOwner = validNfts.map(nft => {
            // Create a new object instead of mutating
            return {
              ...nft,
              ownerAddress: normalizedAddress // Explicitly add the owner address
            };
          });
          
          // Add to our collection - push all at once to reduce mutations
          if (nftsWithOwner.length > 0) {
            allNfts.push(...nftsWithOwner);
            totalCount += nftsWithOwner.length;
            console.log(`Found ${nftsWithOwner.length} NFTs for ${normalizedAddress}`);
          } else {
            console.log(`No NFTs found for ${normalizedAddress}`);
          }
        } else if (result.error) {
          // Track this error
          errors.push(`${normalizedAddress}: ${result.error}`);
          console.warn(`Error fetching NFTs for ${normalizedAddress}: ${result.error}`);
        } else {
          console.warn(`No valid NFTs found for ${normalizedAddress}`);
        }
      } catch (addressError) {
        // Collect the error but continue processing
        const errorMsg = addressError.message || 'Unknown error';
        errors.push(`${address}: ${errorMsg}`);
        console.error(`Error processing address ${address}:`, errorMsg);
        // Continue to next address
      }
    }
    
    console.log(`Successfully processed ${allNfts.length} NFTs from ${validAddresses.length} addresses`);
    
    // Return error details if we had problems
    if (errors.length > 0) {
      return {
        nfts: allNfts,
        totalCount: totalCount,
        pageKey: null, // No pagination for batch requests
        hasMore: false,
        error: `Encountered ${errors.length} errors while fetching NFTs: ${errors.slice(0, 3).join('; ')}${errors.length > 3 ? '...' : ''}`
      };
    }
    
    // Otherwise return successful result
    return {
      nfts: allNfts,
      totalCount: totalCount,
      pageKey: null, // No pagination for batch requests
      hasMore: false
    };
  } catch (error) {
    console.error('Critical error in batchFetchNFTs:', error.message);
    // Return a valid result even if there was an error
    return {
      nfts: allNfts, // Return any NFTs we managed to collect before the error
      totalCount: totalCount,
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