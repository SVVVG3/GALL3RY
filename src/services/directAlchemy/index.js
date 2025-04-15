/**
 * Direct Alchemy NFT service (bypasses dynamic loading)
 * Uses direct API calls to the Alchemy API or server endpoints
 * FETCH VERSION - No axios dependency
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
 * Fetch NFTs for an address (main method) - ULTRA SIMPLIFIED FETCH VERSION
 */
const fetchNFTsForAddress = async (address, chain = 'eth', options = {}) => {
  if (!address) {
    console.error('No address provided to fetchNFTsForAddress');
    return { nfts: [], pageKey: null, hasMore: false };
  }
  
  try {
    // Normalize the address
    const normalizedAddress = address.toLowerCase().trim();
    
    // Normalize chain parameter to ensure consistency
    // Some requests might use 'eth-mainnet' while the server expects 'eth'
    const normalizedChain = chain.includes('-') ? chain.split('-')[0] : chain;
    
    // Build the API URL base
    const apiUrl = `${ALCHEMY_PROXY_URL}`;
    
    // Build query parameters
    const params = {
      endpoint: NFT_ENDPOINTS.getNftsForOwner,
      chain: normalizedChain,
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
    
    // Build full URL with query parameters
    const fullUrl = buildUrl(apiUrl, params);
    
    console.log(`Fetching NFTs for ${normalizedAddress} on ${normalizedChain}`, { 
      method: 'get', 
      url: fullUrl 
    });
    
    // ULTRA SIMPLIFIED VERSION - Using native fetch API instead of axios
    try {
      const response = await fetch(fullUrl, { 
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      // Check if the response is OK
      if (!response.ok) {
        console.error(`API error: ${response.status} ${response.statusText}`);
        return { nfts: [], pageKey: null, hasMore: false };
      }
      
      // Parse the JSON response
      const data = await response.json();
      
      // Enhanced logging for response debugging
      console.log(`Response from ${normalizedChain} for ${normalizedAddress}:`, {
        status: response.status,
        hasOwnedNfts: !!data.ownedNfts,
        ownedNftsCount: data.ownedNfts ? data.ownedNfts.length : 0,
        totalCount: data.totalCount || 0,
        hasPageKey: !!data.pageKey
      });
      
      // Basic response validation
      if (!data) {
        return { nfts: [], pageKey: null, hasMore: false };
      }
      
      const ownedNfts = data.ownedNfts || [];
      
      // Build a simple array for the NFTs
      const formattedNfts = [];
      
      for (let i = 0; i < ownedNfts.length; i++) {
        try {
          const nft = ownedNfts[i];
          if (!nft) continue;
          
          formattedNfts.push({
            id: `${normalizedChain}:${nft.contract?.address || 'unknown'}-${nft.tokenId || '0'}`,
            tokenId: nft.tokenId || '0',
            contractAddress: nft.contract?.address || 'unknown',
            name: nft.title || `#${nft.tokenId || '0'}`,
            description: nft.description || '',
            network: normalizedChain,
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
      
      // If we got NFTs, log a sample for debugging
      if (formattedNfts.length > 0) {
        const sample = formattedNfts[0];
        console.log(`Sample formatted NFT (of ${formattedNfts.length}):`, {
          id: sample.id,
          name: sample.name,
          collection: sample.collection?.name,
          media: !!sample.media
        });
      }
      
      console.log(`Successfully processed ${formattedNfts.length} NFTs for ${normalizedAddress}`);
      
      return {
        nfts: formattedNfts,
        pageKey: data.pageKey || null,
        hasMore: !!data.pageKey
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
 * Using fetch instead of axios
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
  
  try {
    // Process each address sequentially to avoid race conditions
    const allNfts = [];
    let totalNfts = 0;
    let hasMoreData = false;
    
    // Process each address
    for (let i = 0; i < validAddresses.length; i++) {
      const address = validAddresses[i];
      console.log(`Processing address ${address} (${i+1}/${validAddresses.length})`);
      
      // Fetch NFTs for this address
      try {
        const result = await fetchNFTsForAddress(address, normalizedChain, options);
        
        if (result.nfts && result.nfts.length > 0) {
          // Add each NFT to the results
          result.nfts.forEach(nft => {
            if (nft) {
              // Ensure the owner address is included on each NFT
              nft.ownerAddress = address;
              allNfts.push(nft);
              totalNfts++;
            }
          });
          
          if (result.hasMore) {
            hasMoreData = true;
          }
          
          console.log(`Found ${result.nfts.length} NFTs for ${address}`);
        } else {
          console.log(`No NFTs found for ${address}`);
        }
      } catch (error) {
        console.error(`Error processing address ${address}:`, error.message);
      }
    }
    
    console.log(`Successfully processed ${totalNfts} NFTs from ${validAddresses.length} addresses`);
    
    return {
      nfts: allNfts,
      totalCount: totalNfts,
      pageKey: null, // No pagination for batch requests
      hasMore: hasMoreData
    };
  } catch (error) {
    console.error('Error in batchFetchNFTs:', error.message);
    return { nfts: [], totalCount: 0, pageKey: null, hasMore: false };
  }
};

module.exports = {
  fetchNFTsForAddress,
  getNFTsForOwner, // Alias
  batchFetchNFTs
}; 