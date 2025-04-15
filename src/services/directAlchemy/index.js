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
 * ULTRA SIMPLIFIED Fetch NFTs for an address - Guaranteed to work in production
 * No retry logic, no complex Promise chains, simple error handling
 * Single direct fetch request with timeout
 */
const fetchNFTsForAddress = async (address, chain = 'eth', options = {}) => {
  // Defensive check for address
  if (!address) {
    console.error('No address provided to fetchNFTsForAddress');
    return { nfts: [], pageKey: null, hasMore: false };
  }
  
  try {
    // Normalize the address
    const normalizedAddress = address.toLowerCase().trim();
    
    // Normalize chain parameter
    const normalizedChain = chain.includes('-') ? chain.split('-')[0] : chain;
    
    // Generate cache key
    const key = cacheKey('getNftsForOwner', normalizedAddress, normalizedChain, options);
    
    // Check cache
    const cachedData = getCachedData(key);
    if (cachedData) {
      console.log(`Using cached NFTs for ${normalizedAddress} on ${normalizedChain}`);
      return cachedData;
    }
    
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
    
    console.log(`Fetching NFTs for ${normalizedAddress} on ${normalizedChain}`, { url: fullUrl });
    
    // ULTRA SIMPLIFIED - Single direct fetch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
    
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
        return { nfts: [], pageKey: null, hasMore: false };
      }
      
      // Parse the JSON response
      const data = await response.json();
      
      // Enhanced logging for debugging
      console.log(`Response from ${normalizedChain} for ${normalizedAddress}:`, {
        status: response.status,
        hasOwnedNfts: !!data.ownedNfts,
        ownedNftsCount: data.ownedNfts ? data.ownedNfts.length : 0,
        totalCount: data.totalCount || 0,
        hasPageKey: !!data.pageKey
      });
      
      // Basic validation
      if (!data) {
        return { nfts: [], pageKey: null, hasMore: false };
      }
      
      const ownedNfts = data.ownedNfts || [];
      const formattedNfts = [];
      
      // Fully defensive approach to processing NFTs
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
          media: !!sample.media
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
  
  // Sequential processing - slower but more reliable than Promise.all in production
  for (let i = 0; i < validAddresses.length; i++) {
    const address = validAddresses[i];
    console.log(`Processing address ${i+1}/${validAddresses.length}: ${address}`);
    
    try {
      const result = await fetchNFTsForAddress(address, normalizedChain, options);
      
      // Validate the result has nfts
      if (!result || !result.nfts) {
        console.warn(`No valid result or NFTs array for address ${address}`);
        errors.push({ address, error: 'Invalid response structure' });
        continue;
      }
      
      // Valid NFTs exist
      if (Array.isArray(result.nfts) && result.nfts.length > 0) {
        // Keep track of valid NFTs for this address
        let validNftsForAddress = 0;
        
        // Process each NFT with validation
        result.nfts.forEach(nft => {
          if (!nft) {
            console.warn(`Skipping null/undefined NFT for ${address}`);
            return;
          }
          
          if (!nft.contractAddress || !nft.tokenId) {
            console.warn(`Skipping NFT with missing contractAddress or tokenId for ${address}`);
            return;
          }
          
          // Ensure the owner address is set on each NFT
          // Deep copy to avoid reference issues
          const enhancedNft = {
            ...nft,
            ownerAddress: address,
            // Ensure network is set
            network: nft.network || normalizedChain,
            // Ensure ID has network prefix
            id: nft.id || `${normalizedChain}:${nft.contractAddress}-${nft.tokenId}`
          };
          
          allNfts.push(enhancedNft);
          totalNfts++;
          validNftsForAddress++;
        });
        
        console.log(`Added ${validNftsForAddress} valid NFTs from ${address}`);
        
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