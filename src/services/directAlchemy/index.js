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
 * Fetch NFTs for an address (main method) - ULTRA SIMPLIFIED VERSION FOR PRODUCTION
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
    
    // ULTRA SIMPLIFIED VERSION - No retries, minimal error handling, direct axios call
    try {
      const response = await axios.get(apiUrl, { params, timeout: 30000 });
      
      // Basic response validation
      if (!response || !response.data) {
        return { nfts: [], pageKey: null, hasMore: false };
      }
      
      const ownedNfts = response.data.ownedNfts || [];
      
      // Build a simple array for the NFTs
      const formattedNfts = [];
      
      for (let i = 0; i < ownedNfts.length; i++) {
        try {
          const nft = ownedNfts[i];
          if (!nft) continue;
          
          formattedNfts.push({
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
          });
        } catch (e) {
          console.warn('Error formatting NFT:', e.message);
        }
      }
      
      console.log(`Successfully processed ${formattedNfts.length} NFTs for ${normalizedAddress}`);
      
      return {
        nfts: formattedNfts,
        pageKey: response.data.pageKey || null,
        hasMore: !!response.data.pageKey
      };
    } catch (apiError) {
      console.error(`API error for ${normalizedAddress}:`, apiError.message);
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
 * Ultra-simplified implementation without retry mechanisms or complex logic
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
  
  // Process each address one by one
  for (let i = 0; i < validAddresses.length; i++) {
    const address = validAddresses[i];
    
    if (!address) continue; // Skip empty addresses
    
    const normalizedAddress = address.toLowerCase().trim();
    console.log(`Processing address ${normalizedAddress} (${i + 1}/${validAddresses.length})`);
    
    // Simple direct fetch
    let result;
    try {
      result = await fetchNFTsForAddress(normalizedAddress, chain, options);
    } catch (err) {
      console.error(`Error fetching NFTs for address ${normalizedAddress}:`, err.message);
      continue; // Skip to next address on error
    }
    
    // Make sure we have valid NFTs before adding them
    if (result && Array.isArray(result.nfts) && result.nfts.length > 0) {
      // Add owner address explicitly to each NFT
      for (let j = 0; j < result.nfts.length; j++) {
        if (result.nfts[j]) {
          result.nfts[j].ownerAddress = normalizedAddress;
        }
      }
      
      // Add valid NFTs to our collection
      const validNfts = result.nfts.filter(nft => nft && typeof nft === 'object');
      allNfts.push(...validNfts);
      totalCount += validNfts.length;
      
      console.log(`Found ${validNfts.length} NFTs for ${normalizedAddress}`);
    } else {
      console.log(`No NFTs found for ${normalizedAddress}`);
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