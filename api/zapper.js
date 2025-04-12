const fetch = require('node-fetch');
const NodeCache = require('node-cache');

// Improved caching with TTL and size limits
const cache = new NodeCache({
  stdTTL: 600, // 10 minutes default TTL (up from 300)
  checkperiod: 60, // Check for expired keys every minute
  maxKeys: 2000, // Increased max keys (up from 1000)
  useClones: false // Disable cloning for better performance
});

// Enhanced cache keys with more context
const CACHE_KEYS = {
  NFT_USERS_TOKENS: (owners, opts) => {
    const key = `nft_users_tokens_${owners.sort().join('_')}`;
    const optsKey = opts ? `_${JSON.stringify(opts)}` : '';
    return `${key}${optsKey}`;
  },
  NFTS_QUERY_NEW: (owners, opts) => {
    const key = `nfts_query_new_${owners.sort().join('_')}`;
    const optsKey = opts ? `_${JSON.stringify(opts)}` : '';
    return `${key}${optsKey}`;
  },
  PORTFOLIO: (walletAddress) => `portfolio_${walletAddress}`,
  PROFILE: (fid) => `profile_${fid}`
};

// Headers for Zapper API calls
const ZAPPER_HEADERS = {
  'Content-Type': 'application/json',
  'X-API-KEY': process.env.ZAPPER_API_KEY || ''
};

// CORS Headers
const CORS_HEADERS = {
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS,PATCH,DELETE,POST,PUT',
  'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, Origin, Cache-Control, Pragma'
};

// Zapper GraphQL API endpoint
const ZAPPER_API_URL = 'https://api.zapper.xyz/v2/graphql';
// Default request timeout
const API_TIMEOUT = 12000; // 12 seconds

/**
 * Proxy API handler for Zapper API GraphQL requests
 * This helps solve CORS issues and protect API keys
 */
const handler = async (req, res) => {
  // Set CORS headers for all responses
  Object.entries(CORS_HEADERS).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Handle OPTIONS requests (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get API key from environment variables
    const apiKey = process.env.ZAPPER_API_KEY;
    if (!apiKey) {
      console.error('[ZAPPER] Missing API key');
      return res.status(500).json({ 
        error: 'Configuration error',
        message: 'Zapper API key is missing'
      });
    }

    // Parse request body
    const requestBody = req.body || {};
    let { query, variables } = requestBody;

    if (!query) {
      return res.status(400).json({ 
        error: 'Invalid request',
        message: 'GraphQL query is required' 
      });
    }

    // Log query type for debugging
    const queryType = extractQueryType(query);
    
    // Enhanced logging for debugging
    console.log(`[ZAPPER] Processing ${queryType} query:`, {
      queryPreview: query.substring(0, 100) + '...',
      variablesKeys: Object.keys(variables || {}),
      addresses: variables?.addresses ? `${variables.addresses.length} addresses` : 'none',
      owners: variables?.owners ? `${variables.owners.length} owners` : 'none',
      collectionIds: variables?.collectionIds || 'none',
      collectionAddress: variables?.collectionAddress || 'none'
    });

    // Extract query type and prioritize flags from variables
    const options = {
      prioritizeSpeed: variables?.prioritizeSpeed === true,
      ...variables
    };

    // Check for cached response before making network request
    let cacheKey = null;
    
    if (queryType === 'NFT_USERS_TOKENS' && variables?.owners) {
      cacheKey = CACHE_KEYS.NFT_USERS_TOKENS(variables.owners, {
        first: variables.first,
        after: variables.after,
        prioritizeSpeed: options.prioritizeSpeed
      });
    } else if (queryType === 'NFTS_QUERY_NEW' && variables?.owners) {
      cacheKey = CACHE_KEYS.NFTS_QUERY_NEW(variables.owners, {
        first: variables.first,
        after: variables.after,
        prioritizeSpeed: options.prioritizeSpeed
      });
    } else if (queryType === 'PORTFOLIO' && variables?.ownerAddress) {
      cacheKey = CACHE_KEYS.PORTFOLIO(variables.ownerAddress);
    } else if (queryType === 'PROFILE' && variables?.fid) {
      cacheKey = CACHE_KEYS.PROFILE(variables.fid);
    }

    // Try to get data from cache
    if (cacheKey) {
      const cachedData = cache.get(cacheKey);
      if (cachedData) {
        console.log(`[ZAPPER] Cache hit for ${queryType}`);
        return res.status(200).json(cachedData);
      }
    }

    // Transform the query to meet Zapper API expectations
    const { transformedQuery, transformedVariables } = transformQuery(query, variables, queryType, options);

    // Prepare the request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT);
    
    // Log the full request for debugging
    console.log(`[ZAPPER] Sending request to Zapper API`, { 
      queryType,
      variableKeys: Object.keys(transformedVariables || {}),
      prioritizeSpeed: options.prioritizeSpeed
    });

    // Make the request to Zapper API
    const response = await fetch(ZAPPER_API_URL, {
      method: 'POST',
      headers: ZAPPER_HEADERS,
      body: JSON.stringify({
        query: transformedQuery,
        variables: transformedVariables
      }),
      signal: controller.signal
    }).finally(() => clearTimeout(timeoutId));

    const data = await response.json();

    // Handle GraphQL errors
    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
      return res.status(400).json(data);
    }

    // Process and deduplicate the data if necessary
    let processedData = data;
    
    if (queryType === 'NFT_USERS_TOKENS' && data.data?.nftUsersTokens?.edges) {
      // Apply deduplication to NFT query results
      processedData = deduplicateNfts(data, options.prioritizeSpeed);
    } else if (queryType === 'PORTFOLIO' && data.data?.portfolioV2?.nftBalances?.nfts) {
      // Deduplicate NFTs in portfolio responses
      processedData = deduplicatePortfolioNfts(data);
    }

    // Cache the response
    if (cacheKey) {
      const cacheTTL = options.prioritizeSpeed ? 900 : 600; // 15 minutes for speed-prioritized queries, 10 minutes for normal
      cache.set(cacheKey, processedData, cacheTTL);
    }

    // Return the processed data
    return res.status(200).json(processedData);
  } catch (error) {
    // Handle overall handler errors
    console.error('[ZAPPER] Handler error:', error);
    return res.status(500).json({
      error: 'Server error',
      message: error.message
    });
  }
};

/**
 * Deduplicate NFTs based on their unique token identifiers
 * This prevents the same NFT from appearing multiple times in the results
 */
const deduplicateNfts = (data, prioritizeSpeed = false) => {
  if (!data.data?.nftUsersTokens?.edges) return data;
  
  console.log(`[ZAPPER] Deduplicating NFTs, original count: ${data.data.nftUsersTokens.edges.length}`);
  
  const uniqueNfts = new Map();
  const dedupedEdges = [];
  
  // Process each NFT
  data.data.nftUsersTokens.edges.forEach(edge => {
    if (!edge.node) return;
    
    // Create a unique key for each NFT based on collection address and token ID
    const nft = edge.node;
    const collectionAddr = nft.collection?.address || '';
    const tokenId = nft.tokenId || '';
    const uniqueKey = `${collectionAddr.toLowerCase()}-${tokenId}`;
    
    // Only add if we haven't seen this NFT before
    if (!uniqueNfts.has(uniqueKey)) {
      uniqueNfts.set(uniqueKey, true);
      dedupedEdges.push(edge);
    }
  });
  
  console.log(`[ZAPPER] After deduplication: ${dedupedEdges.length}`);
  
  // Update the response data with deduplicated NFTs
  data.data.nftUsersTokens.edges = dedupedEdges;
  return data;
};

/**
 * Deduplicate NFTs in portfolio response format
 */
const deduplicatePortfolioNfts = (data) => {
  if (!data.data?.portfolioV2?.nftBalances?.nfts) return data;
  
  console.log(`[ZAPPER] Deduplicating portfolio NFTs, original count: ${data.data.portfolioV2.nftBalances.nfts.length}`);
  
  const uniqueNfts = new Map();
  const dedupedNfts = [];
  
  // Process each NFT item
  data.data.portfolioV2.nftBalances.nfts.forEach(nft => {
    if (!nft || !nft.collection || !nft.tokenId) return;
    
    // Create a unique key for each NFT based on collection address and token ID
    const collectionAddr = nft.collection.address || '';
    const tokenId = nft.tokenId || '';
    const uniqueKey = `${collectionAddr.toLowerCase()}-${tokenId}`;
    
    // Only add if we haven't seen this NFT before
    if (!uniqueNfts.has(uniqueKey)) {
      uniqueNfts.set(uniqueKey, true);
      dedupedNfts.push(nft);
    }
  });
  
  console.log(`[ZAPPER] After portfolio deduplication: ${dedupedNfts.length}`);
  
  // Update the response data with deduplicated NFTs
  data.data.portfolioV2.nftBalances.nfts = dedupedNfts;
  return data;
};

// Function to extract the query type from a GraphQL query
function extractQueryType(query) {
  if (query.includes('nftUsersTokens')) {
    return 'NFT_USERS_TOKENS';
  } else if (query.includes('farcasterProfile')) {
    return 'PROFILE';
  } else if (query.includes('portfolioV2')) {
    return 'PORTFOLIO';
  } else if (query.includes('nfts') && query.includes('collection')) {
    return 'NFTS_QUERY_NEW';
  } else if (query.includes('nfts') && !query.includes('collection')) {
    return 'NFTS_QUERY_OLD';
  }
  return 'UNKNOWN';
}

// Transform the query and variables based on the query type
function transformQuery(query, variables, queryType, options) {
  let transformedQuery = query;
  let transformedVariables = { ...variables };

  // For speed-prioritized requests, limit the number of results
  if (options.prioritizeSpeed) {
    if (queryType === 'NFT_USERS_TOKENS') {
      // If prioritizing speed, limit the number of NFTs per request
      const limitedFirst = Math.min(variables.first || 50, 32);
      transformedVariables = { ...transformedVariables, first: limitedFirst };
      console.log(`[ZAPPER] Speed prioritized: Limited first to ${limitedFirst}`);
    }
    // Additional speed optimizations for other query types could be added here
  }

  return { transformedQuery, transformedVariables };
}

module.exports = handler; 