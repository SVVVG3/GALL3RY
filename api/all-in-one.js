// Single serverless function API handler for Vercel Hobby plan (function limit)
// -----------------------------------------------------------------------
// This file contains ALL API functionality in one file to avoid hitting Vercel's
// 12 function limit on the Hobby plan.

const axios = require('axios');

// Simple memory cache to avoid redundant API calls
const CACHE = {
  requests: {},
  transfers: {},
  profiles: {},
  nfts: {},
  getKey: (endpoint, params) => `${endpoint}:${JSON.stringify(params)}`,
  set: (type, key, data, ttl = 300000) => { // Default 5 minute TTL
    CACHE[type][key] = {
      data,
      expiry: Date.now() + ttl
    };
  },
  get: (type, key) => {
    const cached = CACHE[type][key];
    if (cached && cached.expiry > Date.now()) {
      console.log(`Cache hit for ${type}:${key}`);
      return cached.data;
    }
    return null;
  },
  clear: (type) => {
    CACHE[type] = {};
  }
};

// Farcaster API configuration
const FARCASTER_CONFIG = {
  CACHE_TTL: 10 * 60 * 1000, // 10 minutes
  API_ENDPOINTS: {
    NEYNAR: 'https://api.neynar.com/v2/farcaster',
    ZAPPER: 'https://api.zapper.xyz/v2/farcaster',
    PUBLIC: 'https://api.farcaster.xyz/v1'
  }
};

// -----------------------------------------------------------------------
// CORS HEADERS
// -----------------------------------------------------------------------
const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
};

// -----------------------------------------------------------------------
// MAIN API HANDLER
// -----------------------------------------------------------------------
module.exports = async function handler(req, res) {
  // Record start time for performance monitoring
  const startTime = Date.now();
  
  // Enable CORS for all requests
  setCorsHeaders(res);
  
  // Handle OPTIONS requests (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // Extract the path from the URL
    const url = req.url || '';
    const path = url.split('/api/')[1]?.split('?')[0] || '';
    
    // Check for action parameter - this allows actions to be specified in the query string
    const action = req.query.action;
    
    console.log(`[API] Request to: ${path}${action ? ` with action: ${action}` : ''}`);
    
    // Route based on the path or action
    let result;
    
    // First handle action-based routing
    if (action) {
      // Route based on the action parameter
      switch (action) {
        case 'collectionFriends':
          result = await handleCollectionFriendsRequest(req, res);
          break;
        // Add other actions as needed
        default:
          // If we don't recognize the action, fall through to path-based routing
          console.log(`Unknown action: ${action}, falling back to path-based routing`);
      }
      
      // If we handled the action, return the result
      if (result) {
        // Log performance metrics
        const duration = Date.now() - startTime;
        console.log(`[PERF] Action ${action} completed in ${duration}ms`);
        return result;
      }
    }
    
    // If no action or unhandled action, use path-based routing
    if (path.startsWith('zapper')) {
      result = await handleZapperRequest(req, res);
    } else if (path.startsWith('alchemy')) {
      result = await handleAlchemyRequest(req, res);
    } else if (path.startsWith('farcaster-profile')) {
      result = await handleFarcasterProfileRequest(req, res);
    } else if (path.startsWith('image-proxy')) {
      result = await handleImageProxyRequest(req, res);
    } else if (path === 'folders' || path.startsWith('folders/')) {
      result = await handleFoldersRequest(req, res, path);
    } else if (path.startsWith('collection-friends')) {
      result = await handleCollectionFriendsRequest(req, res);
    } else if (path.startsWith('login')) {
      result = await handleLoginRequest(req, res);
    } else if (path.startsWith('farcaster')) {
      result = await handleFarcasterRequest(req, res);
    } else if (path.startsWith('v2/')) {
      result = await handleV2Request(req, res);
    } else if (path.startsWith('diagnostic')) {
      result = await handleDiagnosticRequest(req, res);
    } else if (path.startsWith('neynar')) {
      result = await handleNeynarRequest(req, res);
    } else if (path === 'all-in-one' && !action) {
      // Handle the case where someone hits /api/all-in-one without an action
      return res.status(400).json({ 
        error: 'Missing action parameter',
        message: 'The all-in-one endpoint requires an action parameter'
      });
    } else {
      // Default: Not found
      return res.status(404).json({ 
        error: 'API endpoint not found',
        path,
        url,
        action
      });
    }
    
    // Log performance metrics
    const duration = Date.now() - startTime;
    console.log(`[PERF] ${path} request completed in ${duration}ms`);
    
    return result;
  } catch (error) {
    console.error(`[API] Error processing request:`, error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
}

// -----------------------------------------------------------------------
// HANDLER: ZAPPER API
// -----------------------------------------------------------------------
async function handleZapperRequest(req, res) {
  // Zapper GraphQL API URL - Updated to v2 endpoint
  const ZAPPER_API_URL = 'https://api.zapper.xyz/v2/graphql';
  const BACKUP_ZAPPER_API_URL = 'https://public.zapper.xyz/graphql';
  
  try {
    // Get Zapper API key from environment variables
    const apiKey = process.env.ZAPPER_API_KEY || '';
    
    if (!apiKey) {
      console.warn('⚠️ No ZAPPER_API_KEY found in environment variables!');
      return res.status(500).json({
        error: 'API Configuration Error',
        message: 'Zapper API key is missing. Please check server configuration.'
      });
    }
    
    // Validate request body
    if (!req.body?.query) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'GraphQL query is required'
      });
    }
    
    // Try to use cached response if available
    const cacheKey = CACHE.getKey('zapper', req.body);
    const cachedData = CACHE.get('requests', cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }
    
    // Debug request details
    console.log('Zapper REQUEST - GraphQL query:', req.body.query.replace(/\s+/g, ' ').trim().substring(0, 100) + '...');
    if (req.body.variables) {
      console.log('Zapper REQUEST - Variables:', JSON.stringify(req.body.variables));
    }
    
    // Set up headers with API key according to documentation
    const headers = {
      'Content-Type': 'application/json',
      'x-zapper-api-key': apiKey,
      'User-Agent': 'Gall3ry/1.0.0',
      'Accept': 'application/json'
    };
    
    // Create an array of endpoints to try in sequence
    const endpoints = [
      { url: ZAPPER_API_URL, name: 'Primary v2 endpoint' },
      { url: BACKUP_ZAPPER_API_URL, name: 'Backup public endpoint' }
    ];
    
    let lastError = null;
    
    // Try each endpoint in sequence
    for (const endpoint of endpoints) {
      try {
        // Forward the request to Zapper
        console.log(`Trying Zapper endpoint: ${endpoint.name}`);
        const response = await axios({
          method: 'post',
          url: endpoint.url,
          headers: headers,
          data: req.body,
          timeout: 15000 // Extended timeout to 15 seconds
        });
        
        console.log(`Zapper RESPONSE - Success from ${endpoint.name}, Status: ${response.status}`);
        
        // Check for GraphQL errors and handle them properly
        if (response.data?.errors) {
          console.warn('GraphQL errors from Zapper:', response.data.errors);
          // Only cache successful responses
          return res.status(200).json(response.data); // Still return 200 as it's a valid GraphQL response
        }
        
        // Cache the successful response
        CACHE.set('requests', cacheKey, response.data);
        
        // Return the response from Zapper
        return res.status(response.status).json(response.data);
      } catch (error) {
        console.error(`Error with Zapper endpoint ${endpoint.name}:`, error.message);
        if (error.response) {
          console.error('RESPONSE ERROR - Status:', error.response.status);
          console.error('RESPONSE ERROR - Data:', JSON.stringify(error.response.data).substring(0, 200));
        } else if (error.request) {
          console.error('REQUEST ERROR - No response received');
        }
        
        lastError = error;
        // Continue to next endpoint
      }
    }
    
    // If we get here, all endpoints failed
    console.error('All Zapper API endpoints failed');
    
    return res.status(lastError?.response?.status || 502).json({
      error: 'Error from Zapper API',
      message: `All Zapper endpoints failed: ${lastError?.message || 'Unknown error'}`,
      details: lastError?.response?.data
    });
  } catch (error) {
    console.error('Unexpected error in Zapper handler:', error);
    
    // Return an appropriate error response
    return res.status(error.response?.status || 500).json({
      error: 'Error from Zapper API',
      message: error.message,
      details: error.response?.data
    });
  }
}

// -----------------------------------------------------------------------
// HANDLER: ALCHEMY API
// -----------------------------------------------------------------------
async function handleAlchemyRequest(req, res) {
  // Get Alchemy API key
  const apiKey = process.env.ALCHEMY_API_KEY;
  
  if (!apiKey) {
    console.error('CRITICAL ERROR: No Alchemy API key found in environment variables');
    return res.status(500).json({ 
      error: 'Alchemy API key not configured', 
      message: 'The server is missing the Alchemy API key. Check environment variables.'
    });
  }
  
  try {
    // Get endpoint from query params
    const endpoint = req.query.endpoint;
    // Extract network parameter (support 'chain' or 'network' for backward compatibility)
    const network = req.query.network || req.query.chain || 'eth';
    
    if (!endpoint) {
      return res.status(400).json({ error: 'Missing endpoint parameter' });
    }
    
    // Standard chain mapping function for all endpoints
    const getChainUrl = (chain = 'eth') => {
        // Map chain IDs to their correct Alchemy URL formats
        const chainUrlMap = {
          'eth': 'eth-mainnet',
          'ethereum': 'eth-mainnet',
          'polygon': 'polygon-mainnet',
          'arbitrum': 'arb-mainnet',
        'arb': 'arb-mainnet',
          'optimism': 'opt-mainnet',
        'opt': 'opt-mainnet',
          'base': 'base-mainnet',
          'zora': 'zora-mainnet'
        };
        
      return chainUrlMap[chain.toLowerCase()] || 'eth-mainnet';
    };
    
    // Define all Alchemy endpoints and their URL construction
    const ENDPOINTS = {
      // NFT API v3 endpoints (format: /nft/v3/{apiKey})
      'getnftsforowner': (apiKey, chain) => {
        const chainUrl = getChainUrl(chain);
        const baseUrl = `https://${chainUrl}.g.alchemy.com/nft/v3/`;
        return `${baseUrl}${apiKey}/getNFTsForOwner`;
      },
      'getnftsforcollection': (apiKey, chain) => {
        const chainUrl = getChainUrl(chain);
        const baseUrl = `https://${chainUrl}.g.alchemy.com/nft/v3/`;
        return `${baseUrl}${apiKey}/getNFTsForCollection`;
      },
      'getnftmetadata': (apiKey, chain) => {
        const chainUrl = getChainUrl(chain);
        const baseUrl = `https://${chainUrl}.g.alchemy.com/nft/v3/`;
        return `${baseUrl}${apiKey}/getNFTMetadata`;
      },
      'getcontractmetadata': (apiKey, chain) => {
        const chainUrl = getChainUrl(chain);
        const baseUrl = `https://${chainUrl}.g.alchemy.com/nft/v3/`;
        return `${baseUrl}${apiKey}/getContractMetadata`;
      },
      'getownersforcontract': (apiKey, chain) => {
        const chainUrl = getChainUrl(chain);
        const baseUrl = `https://${chainUrl}.g.alchemy.com/nft/v3/`;
        return `${baseUrl}${apiKey}/getOwnersForContract`;
      },
      'getcontractsforowner': (apiKey, chain) => {
        const chainUrl = getChainUrl(chain);
        const baseUrl = `https://${chainUrl}.g.alchemy.com/nft/v3/`;
        return `${baseUrl}${apiKey}/getContractsForOwner`;
      },
      
      // Core API endpoints (format: /v2/{apiKey})
      'getassettransfers': (apiKey, chain) => {
        const chainUrl = getChainUrl(chain);
        return `https://${chainUrl}.g.alchemy.com/v2/${apiKey}`;
      },
      
      // Default handler for any other endpoint
      'default': (apiKey, chain, endpoint) => {
        const chainUrl = getChainUrl(chain);
        // Determine if this is likely a NFT API or Core API call
        if (endpoint.toLowerCase().includes('nft')) {
          // NFT API v3
          const baseUrl = `https://${chainUrl}.g.alchemy.com/nft/v3/`;
          return `${baseUrl}${apiKey}/${endpoint}`;
        } else {
          // Default to Core API
        return `https://${chainUrl}.g.alchemy.com/v2/${apiKey}`;
        }
      }
    };
    
    // Normalize the endpoint name to lowercase for case-insensitive comparison
    const normalizedEndpoint = endpoint.toLowerCase();
    
    // Check cache for this request
    const cacheKey = CACHE.getKey(normalizedEndpoint, req.query);
    const cachedData = CACHE.get('requests', cacheKey);
    if (cachedData) {
      console.log(`Cache hit for ${normalizedEndpoint} request on ${network}`);
      return res.status(200).json(cachedData);
    }
    
    // Get the appropriate URL builder function for this endpoint
    const urlBuilder = ENDPOINTS[normalizedEndpoint] || ENDPOINTS.default;
    
    // Build the request URL using the right chain
    const endpointUrl = urlBuilder(apiKey, network, endpoint);
    
    console.log(`Routing Alchemy request for ${normalizedEndpoint} to ${network} network`);
    console.log(`Using URL: ${endpointUrl.replace(apiKey, '[REDACTED]')}`);
    
    // Special handling for getAssetTransfers - uses JSON-RPC instead of REST
    if (normalizedEndpoint === 'getassettransfers') {
      // Extract addresses from query parameters
      let addresses = req.query.addresses ? req.query.addresses.split(',') : [];
      addresses = addresses.map(addr => addr.toLowerCase().trim());
      
      if (addresses.length === 0) {
        return res.status(400).json({ error: 'No addresses provided for getAssetTransfers' });
      }
      
      // Try to use cached transfer data first
      const transferCacheKey = `${network}_${addresses.sort().join(',')}`;
      const cachedTransfers = CACHE.get('transfers', transferCacheKey);
      if (cachedTransfers) {
        return res.status(200).json(cachedTransfers);
      }
      
      // Create the JSON-RPC payload for getAssetTransfers
      const rpcPayload = {
        id: 1,
        jsonrpc: "2.0",
        method: "alchemy_getAssetTransfers",
        params: [
          {
            category: ['ERC721', 'ERC1155'], // NFT transfers only
            fromBlock: "0x0",
            toBlock: "latest",
            withMetadata: true,
            excludeZeroValue: true,
            maxCount: "0x64", // Hex for 100
            order: req.query.order === 'asc' ? 'asc' : 'desc',
            fromAddress: addresses,
            toAddress: addresses
          }
        ]
      };
      
      console.log(`Fetching asset transfers for ${addresses.length} addresses on ${network}`);
      
      // Make the request to Alchemy RPC endpoint
      const response = await axios.post(endpointUrl, rpcPayload, {
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: 15000
      });
      
      // Extract the transfer data
      if (response.data && response.data.result && response.data.result.transfers) {
        const transfers = response.data.result.transfers;
        console.log(`Received ${transfers.length} transfers from Alchemy`);
        
        // Process transfers to build a map keyed by contract address and token ID
        const transferMap = {};
        const allTransfers = [];
        
        transfers.forEach(transfer => {
          // Normalize contract and token ID to create a key
          if (transfer.rawContract && transfer.tokenId) {
            const contractAddress = transfer.rawContract.address.toLowerCase();
            const tokenId = transfer.tokenId;
            const key = `${contractAddress}:${tokenId}`;
            
            // If we don't have a timestamp for this NFT yet, or this one is newer
            if (!transferMap[key] || new Date(transfer.metadata.blockTimestamp) > new Date(transferMap[key].timestamp)) {
              transferMap[key] = {
                timestamp: transfer.metadata.blockTimestamp,
                from: transfer.from,
                to: transfer.to,
                tokenId: tokenId,
                contractAddress: contractAddress
              };
            }
            
            // Keep track of all transfers
            allTransfers.push({
              timestamp: transfer.metadata.blockTimestamp,
              from: transfer.from,
              to: transfer.to,
              tokenId: tokenId,
              contractAddress: contractAddress,
              transactionHash: transfer.hash
            });
          }
        });
        
        const result = {
          transfers: allTransfers,
          transferMap: transferMap,
          count: allTransfers.length,
          processedCount: transfers.length,
          dataAvailable: transfers.length > 0,
          diagnostic: {
            addressCount: addresses.length,
            chain: network,
            requestMethod: 'alchemy_getAssetTransfers',
            transferCountFromRPC: transfers.length
          }
        };
        
        // Cache the result
        CACHE.set('transfers', transferCacheKey, result, 600000); // 10 minute TTL
        
        return res.status(200).json(result);
      }
      
      // Return response data if successful
      const fallbackResult = {
        transfers: [],
        transferMap: {},
        count: 0,
        dataAvailable: false,
        diagnostic: {
          addressCount: addresses.length,
          chain: network,
          error: "No transfers found or unexpected response format",
          requestMethod: 'alchemy_getAssetTransfers'
        }
      };
      
      return res.status(200).json(fallbackResult);
    }
    
    // Regular REST API handling for other endpoints
    // Clone query params to avoid modifying the original
    const requestParams = { ...req.query };
    
    // Remove our custom parameters so they don't get sent to Alchemy
    delete requestParams.endpoint;
    delete requestParams.chain;
    delete requestParams.network;
    
    // Enhanced handling for getNFTsForOwner
    if (normalizedEndpoint === 'getnftsforowner') {
      // Process parameters to match Alchemy v3 API expectations
      if (requestParams.excludeFilters) {
        // Handle excludeFilters array format conversion from string to array
        try {
          if (typeof requestParams.excludeFilters === 'string') {
            requestParams.excludeFilters = [requestParams.excludeFilters];
          }
        } catch (e) {
          console.error('Error processing excludeFilters:', e);
        }
      } else {
        // Default to excluding spam NFTs
        requestParams.excludeFilters = ['SPAM'];
      }
      
      // Ensure proper boolean parameters
      requestParams.withMetadata = requestParams.withMetadata !== 'false';
      
      // These parameters must be explicitly set according to Alchemy docs
      requestParams.pageSize = parseInt(requestParams.pageSize || '100', 10);
      requestParams.includeMedia = true;
    }

    // Special handling for getOwnersForContract endpoint
    if (normalizedEndpoint === 'getownersforcontract') {
      // Ensure contractAddress is properly set
      if (!requestParams.contractAddress) {
        console.error('Missing contractAddress parameter for getOwnersForContract');
        return res.status(400).json({ error: 'Missing contractAddress parameter' });
      }
      
      console.log(`Processing getOwnersForContract for address: ${requestParams.contractAddress} on ${network}`);
      
      // Normalize address to ensure proper format (lowercase)
      requestParams.contractAddress = requestParams.contractAddress.toLowerCase();
      
      // Set additional parameters according to Alchemy docs
      requestParams.withTokenBalances = requestParams.withTokenBalances === 'true';
    }
    
    // Make the API request
    console.log(`Making Alchemy API request to ${normalizedEndpoint} for chain ${network}`);
    const response = await axios.get(endpointUrl, { 
      params: requestParams,
      timeout: 15000 // 15 second timeout
    });
    
    // Add chain information to each item in the response for multi-chain compatibility
    if (response.data) {
      // Different endpoints have different response formats
      if (normalizedEndpoint === 'getnftsforowner' && response.data.ownedNfts) {
        // Add chain info to each NFT in the response
        response.data.ownedNfts = response.data.ownedNfts.map(nft => ({
          ...nft,
          chain: network,
          network: network,
          chainId: network
        }));
        
      // Try to get cached transfer data to enhance the NFTs with timestamps
        if (requestParams.owner) {
      const ownerAddress = requestParams.owner.toLowerCase();
          const transferCacheKey = `${network}_${ownerAddress}`;
      const cachedTransfers = CACHE.get('transfers', transferCacheKey);
      
      // Enhanced NFTs with better field normalization and timestamps if available
      response.data.ownedNfts = response.data.ownedNfts.map(nft => {
        // Get the contract address in lowercase
        const contractAddress = (nft.contract?.address || '').toLowerCase();
        const tokenId = nft.tokenId || '';
        const key = `${contractAddress}:${tokenId}`;
        
        // Start with basic owner info
        const enhancedNft = {
          ...nft,
          ownerAddress,
          // Normalize important fields that might be differently named
          name: nft.name || nft.title || `#${nft.tokenId || '0'}`,
          collection: {
            name: nft.contract?.name || 
                  nft.collection?.name || 
                  nft.contractMetadata?.name || 
                  `Contract ${contractAddress.substring(0, 6)}...`
          }
        };
        
        // Add transfer timestamp if we have it in our cache
        if (cachedTransfers && cachedTransfers.transferMap && cachedTransfers.transferMap[key]) {
          enhancedNft.transferTimestamp = cachedTransfers.transferMap[key].timestamp;
        }
        
        return enhancedNft;
      });
        }
      }
      
      // Add diagnostic info to help with debugging
      response.data._diagnostic = {
        chain: network,
        endpoint: normalizedEndpoint,
        timestamp: new Date().toISOString()
      };
    }
    
    // Cache the response data
    CACHE.set('requests', cacheKey, response.data, 300000); // 5 minute TTL
    
    return res.status(200).json(response.data);
  } catch (error) {
    console.error('Alchemy API error:', error.message);
    
    return res.status(error.response?.status || 500).json({
      error: 'Error from Alchemy API',
      message: error.message,
      details: error.response?.data
    });
  }
}

// -----------------------------------------------------------------------
// HANDLER: FARCASTER PROFILE
// -----------------------------------------------------------------------
async function handleFarcasterProfileRequest(req, res) {
  try {
    const { fid, username } = req.query;
    if (!fid && !username) {
      return res.status(400).json({ error: 'Missing fid or username parameter' });
    }

    const identifier = fid || username.toLowerCase();
    const cacheKey = `farcaster_profile_${identifier}`;

    // Use local memory cache instead of Redis
    const cachedProfile = CACHE.get('profiles', cacheKey);
    if (cachedProfile) {
      console.log(`Cache hit for Farcaster profile: ${identifier}`);
      return res.json(cachedProfile);
    }

    // If we're looking up by username, try the Neynar search endpoint first as it's more reliable
    if (username) {
      try {
        const neynarApiKey = process.env.NEYNAR_API_KEY || process.env.REACT_APP_NEYNAR_API_KEY || '';
        if (!neynarApiKey) {
          console.warn('No Neynar API key found, skipping search endpoint');
        } else {
          console.log(`Trying Neynar search for username: ${username}`);
          
          const searchResponse = await axios.get(`https://api.neynar.com/v2/farcaster/user/search`, {
            params: { q: username, limit: 5 },
            headers: { 'api-key': neynarApiKey },
            timeout: 5000
          });
          
          if (searchResponse.data?.result?.users?.length > 0) {
            // Look for exact match first
            const exactMatch = searchResponse.data.result.users.find(
              user => user.username.toLowerCase() === username.toLowerCase()
            );
            
            const userData = exactMatch || searchResponse.data.result.users[0];
            
            if (userData && userData.fid) {
              console.log(`Found user via Neynar search, fetching additional data for FID: ${userData.fid}`);
              
              // Now get the full user data with verified addresses
              const userResponse = await axios.get(`https://api.neynar.com/v2/farcaster/user`, {
                params: { fid: userData.fid },
                headers: { 'api-key': neynarApiKey },
                timeout: 5000
              });
              
              if (userResponse.data?.result?.user) {
                // Also fetch verified addresses separately as they might not be included in the user endpoint
                try {
                  const addressesResponse = await axios.get(`https://api.neynar.com/v2/farcaster/user/verified-addresses`, {
                    params: { fid: userData.fid },
                    headers: { 'api-key': neynarApiKey },
                    timeout: 5000
                  });
                  
                  // If we have verified addresses, add them to the user data
                  if (addressesResponse.data?.verified_addresses) {
                    console.log(`Found ${addressesResponse.data.verified_addresses.length} verified addresses`);
                    
                    if (!userResponse.data.result.user.verified_addresses) {
                      userResponse.data.result.user.verified_addresses = {};
                    }
                    
                    userResponse.data.result.user.verified_addresses.eth_addresses = 
                      addressesResponse.data.verified_addresses
                        .filter(a => a.type === 'ethereum')
                        .map(a => a.addr);
                  }
                } catch (addressesError) {
                  console.warn('Failed to fetch additional verified addresses:', addressesError.message);
                }
                
                const profile = formatFarcasterProfile(userResponse.data);
                
                if (profile) {
                  // Cache the profile
                  CACHE.set('profiles', cacheKey, profile, 600000); // 10 minutes cache
                  return res.json(profile);
                }
              }
            }
          }
        }
      } catch (neynarError) {
        console.error('Neynar search/user endpoint failed:', neynarError.message);
      }
    }

    // Fall back to the original endpoints approach if the optimized path didn't work
    console.log(`Falling back to API endpoints approach for ${identifier}`);
    
    // API endpoints to try in order
    const endpoints = [
      {
        name: 'Neynar API',
        url: `https://api.neynar.com/v2/farcaster/user`,
        params: fid ? { fid } : { username },
        headers: { 'api-key': process.env.NEYNAR_API_KEY || process.env.REACT_APP_NEYNAR_API_KEY || '' }
      },
      {
        name: 'Zapper API',
        url: `${FARCASTER_CONFIG.API_ENDPOINTS.ZAPPER}/profile`,
        params: fid ? { fid } : { username },
        headers: { 'X-API-KEY': process.env.ZAPPER_API_KEY || '' }
      },
      {
        name: 'Public API',
        url: `https://api.farcaster.xyz/v1/profiles/${identifier}`,
        params: {},
        headers: {}
      }
    ];

    let profile = null;
    let errors = [];

    // Try each endpoint until we get a successful response
    for (const endpoint of endpoints) {
      try {
        console.log(`Trying ${endpoint.name} for ${identifier}...`);
        
        // Skip if API key is missing and it's required
        if ((endpoint.name === 'Neynar API' || endpoint.name === 'Zapper API') && 
            (!endpoint.headers['api-key'] && !endpoint.headers['X-API-KEY'])) {
          console.warn(`Skipping ${endpoint.name} - API key missing`);
          continue;
        }
        
        const paramString = new URLSearchParams(endpoint.params).toString();
        const requestUrl = `${endpoint.url}${paramString ? '?' + paramString : ''}`;
        console.log(`Making request to: ${requestUrl.replace(/api-key=[^&]+/, 'api-key=REDACTED')}`);
        
        const response = await axios.get(requestUrl, { 
          headers: endpoint.headers,
          timeout: 5000 // 5 second timeout
        });

        if (!response.data) {
          errors.push(`${endpoint.name}: No data received`);
          continue;
        }

        profile = formatFarcasterProfile(response.data);
        
        if (profile) {
          console.log(`Successfully retrieved profile from ${endpoint.name}`);
          
          // If we got a profile but no connected addresses and we have an FID,
          // try to fetch verified addresses directly
          if (profile.fid && (!profile.connectedAddresses || profile.connectedAddresses.length === 0)) {
            try {
              const neynarApiKey = process.env.NEYNAR_API_KEY || process.env.REACT_APP_NEYNAR_API_KEY || '';
              if (neynarApiKey) {
                console.log(`Fetching additional verified addresses for FID: ${profile.fid}`);
                const addressesResponse = await axios.get(`https://api.neynar.com/v2/farcaster/user/verified-addresses`, {
                  params: { fid: profile.fid },
                  headers: { 'api-key': neynarApiKey },
                  timeout: 5000
                });
                
                if (addressesResponse.data?.verified_addresses) {
                  const ethAddresses = addressesResponse.data.verified_addresses
                    .filter(a => a.type === 'ethereum')
                    .map(a => a.addr.toLowerCase());
                  
                  if (ethAddresses.length > 0) {
                    console.log(`Found ${ethAddresses.length} additional ETH addresses for FID: ${profile.fid}`);
                    profile.connectedAddresses = [
                      ...(profile.connectedAddresses || []),
                      ...ethAddresses
                    ];
                    
                    // Deduplicate addresses
                    profile.connectedAddresses = [...new Set(profile.connectedAddresses)];
                  }
                }
              }
            } catch (addressesError) {
              console.warn('Failed to fetch additional verified addresses:', addressesError.message);
            }
          }
          
          // Cache successful response
          CACHE.set('profiles', cacheKey, profile, 600000); // 10 minutes cache
          
          console.log(`Returning profile with ${profile.connectedAddresses?.length || 0} connected addresses`);
          return res.json(profile);
        }
      } catch (error) {
        console.error(`${endpoint.name} error:`, error.message);
        errors.push(`${endpoint.name}: ${error.message}`);
      }
    }

    // If we get here, all endpoints failed
    console.error('Failed to fetch Farcaster profile:', errors);
    return res.status(404).json({
      error: 'Profile not found',
      details: errors
    });
  } catch (error) {
    console.error('Error in handleFarcasterProfileRequest:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

// Helper function to format profile data consistently
function formatFarcasterProfile(data) {
  try {
    // Handle Neynar API response format
    if (data.result?.user) {
      const user = data.result.user;
      const connectedAddresses = [];
      
      // Extract connected ETH addresses from verified_addresses
      if (user.verified_addresses && user.verified_addresses.eth_addresses) {
        user.verified_addresses.eth_addresses.forEach(addr => {
          if (addr && typeof addr === 'string') {
            connectedAddresses.push(addr.toLowerCase());
          }
        });
      }

      // Get custody address as well if available
      const custodyAddress = user.custody_address ? user.custody_address.toLowerCase() : null;
      if (custodyAddress && !connectedAddresses.includes(custodyAddress)) {
        connectedAddresses.push(custodyAddress);
      }
      
      return {
        fid: user.fid,
        username: user.username,
        displayName: user.displayName,
        pfp: user.pfp?.url,
        followerCount: user.followerCount,
        followingCount: user.followingCount,
        activeStatus: user.activeStatus,
        viewerContext: user.viewerContext,
        custodyAddress: custodyAddress,
        connectedAddresses: connectedAddresses,
        _timestamp: Date.now()
      };
    }
    
    // Handle Zapper API response format
    if (data.profile) {
      const profile = data.profile;
      const connectedAddresses = [];
      
      // Extract addresses if available
      if (profile.addresses && Array.isArray(profile.addresses)) {
        profile.addresses.forEach(addr => {
          if (addr && typeof addr === 'string') {
            connectedAddresses.push(addr.toLowerCase());
          }
        });
      }
      
      // Get custody address as well if available
      const custodyAddress = profile.custody_address ? profile.custody_address.toLowerCase() : null;
      if (custodyAddress && !connectedAddresses.includes(custodyAddress)) {
        connectedAddresses.push(custodyAddress);
      }
      
      return {
        fid: profile.fid,
        username: profile.username,
        displayName: profile.displayName,
        pfp: profile.avatar,
        followerCount: profile.followers,
        followingCount: profile.following,
        activeStatus: profile.active ? 'active' : 'inactive',
        custodyAddress: custodyAddress,
        connectedAddresses: connectedAddresses,
        _timestamp: Date.now()
      };
    }
    
    // Handle public API response format
    if (data.fid) {
      const connectedAddresses = [];
      
      // Extract addresses if available
      if (data.verified_addresses && Array.isArray(data.verified_addresses)) {
        data.verified_addresses.forEach(addr => {
          if (addr && typeof addr === 'string') {
            connectedAddresses.push(addr.toLowerCase());
          }
        });
      }
      
      // Get custody address as well if available
      const custodyAddress = data.custody_address ? data.custody_address.toLowerCase() : null;
      if (custodyAddress && !connectedAddresses.includes(custodyAddress)) {
        connectedAddresses.push(custodyAddress);
      }
      
      return {
        fid: data.fid,
        username: data.username,
        displayName: data.display_name,
        pfp: data.avatar_url,
        followerCount: data.followers_count,
        followingCount: data.following_count,
        activeStatus: data.active ? 'active' : 'inactive',
        custodyAddress: custodyAddress,
        connectedAddresses: connectedAddresses,
        _timestamp: Date.now()
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error formatting Farcaster profile:', error);
    return null;
  }
}

// -----------------------------------------------------------------------
// HANDLER: IMAGE PROXY
// -----------------------------------------------------------------------
async function handleImageProxyRequest(req, res) {
  // Get image URL from query parameter
  const { url } = req.query;
  
  // Add request debugging to track which URLs are problematic
  console.log(`[IMAGE-PROXY] Received request for: ${url}`);
  
  if (!url) {
    console.warn("[IMAGE-PROXY] Missing URL parameter");
    return res.status(400).json({ error: 'Missing url parameter' });
  }
  
  try {
    // Always decode the URL to handle any encoded characters
    let proxyUrl = decodeURIComponent(url);
    console.log(`[IMAGE-PROXY] Decoded URL: ${proxyUrl}`);
    
    // Default headers for most requests
    let customHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
      'Referer': 'https://gall3ry.vercel.app/',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache', // Force fresh content
      'Pragma': 'no-cache' // For HTTP 1.0 compatibility
    };
    
    // Handle Alchemy CDN URLs specifically - special handling for their unique format
    if (proxyUrl.includes('nft-cdn.alchemy.com')) {
      console.log(`[IMAGE-PROXY] Handling Alchemy CDN URL: ${proxyUrl}`);
      
      // Check if URL has format specifier (/original or /thumb)
      // If not, add it - /original for better quality
      if (!proxyUrl.includes('/original') && !proxyUrl.includes('/thumb')) {
        proxyUrl = `${proxyUrl}/original`;
        console.log(`[IMAGE-PROXY] Added format specifier to Alchemy URL: ${proxyUrl}`);
      }
      
      // Add API key if available
      const apiKey = process.env.ALCHEMY_API_KEY || '-DhGb2lvitCWrrAmLnF5TZLl-N6l8Lak';
      if (!proxyUrl.includes('apiKey=') && apiKey) {
        proxyUrl = `${proxyUrl}${proxyUrl.includes('?') ? '&' : '?'}apiKey=${apiKey}`;
        console.log(`[IMAGE-PROXY] Added API key to Alchemy URL`);
      }
      
      // Use specific headers for Alchemy
      customHeaders = {
        ...customHeaders,
        'Cache-Control': 'no-cache',
        'Origin': 'https://gall3ry.vercel.app'
      };
    }
    
    // Special handling for IPFS URLs
    if (proxyUrl.startsWith('ipfs://')) {
      // Use an array of IPFS gateways to try instead of just one
      const ipfsGateways = [
        'https://cloudflare-ipfs.com/ipfs/',
        'https://ipfs.io/ipfs/',
        'https://gateway.pinata.cloud/ipfs/',
        'https://dweb.link/ipfs/',
        'https://ipfs.infura.io/ipfs/'
      ];
      
      // Store the original IPFS hash
      const ipfsHash = proxyUrl.replace('ipfs://', '');
      console.log(`[IMAGE-PROXY] Processing IPFS URL, hash: ${ipfsHash}`);
      
      // Use the first gateway by default, we'll try others if this fails
      proxyUrl = `${ipfsGateways[0]}${ipfsHash}`;
      console.log(`[IMAGE-PROXY] Converted to gateway URL: ${proxyUrl}`);
      
      // Track that this is an IPFS URL for potential fallback
      req.ipfsData = {
        isIpfs: true,
        hash: ipfsHash,
        gateways: ipfsGateways,
        currentGatewayIndex: 0
      };
      
      customHeaders = {
        ...customHeaders,
        'Origin': null
      };
    }
    
    // Handle ipfs links that aren't using the ipfs:// protocol
    if (proxyUrl.includes('/ipfs/')) {
      console.log(`[IMAGE-PROXY] Detected standard IPFS gateway URL: ${proxyUrl}`);
      // Extract the IPFS hash for potential fallback
      try {
        const ipfsMatch = proxyUrl.match(/\/ipfs\/([^/?#]+)/);
        if (ipfsMatch && ipfsMatch[1]) {
          const ipfsHash = ipfsMatch[1];
          console.log(`[IMAGE-PROXY] Extracted IPFS hash: ${ipfsHash}`);
          
          // Track Pinata-specific URLs for special handling
          const isPinata = proxyUrl.includes('pinata.cloud');
          
          // Setup IPFS fallback data
          req.ipfsData = {
            isIpfs: true,
            hash: ipfsHash,
            gateways: [
              'https://cloudflare-ipfs.com/ipfs/',
              'https://ipfs.io/ipfs/',
              'https://gateway.pinata.cloud/ipfs/',
              'https://dweb.link/ipfs/',
              'https://ipfs.infura.io/ipfs/'
            ],
            currentGatewayIndex: isPinata ? 1 : 0, // Skip Pinata gateway if URL is already from Pinata
            isPinata: isPinata
          };
        }
      } catch (error) {
        console.warn('[IMAGE-PROXY] Error parsing IPFS URL:', error);
      }
      
      // Just keep the URL as is, but add special headers
      customHeaders = {
        ...customHeaders,
        'Origin': null
      };
    }
    
    // Special handling for Arweave URLs
    if (proxyUrl.startsWith('ar://')) {
      const arweaveId = proxyUrl.replace('ar://', '');
      console.log(`[IMAGE-PROXY] Processing Arweave URL, ID: ${arweaveId}`);
      proxyUrl = `https://arweave.net/${arweaveId}`;
      console.log(`[IMAGE-PROXY] Converted to Arweave gateway: ${proxyUrl}`);
    }
    
    // Fetch the image with retries
    let response;
    let retries = 0;
    const maxRetries = 3; // Increased from 2 to 3 for more fallback attempts
    
    while (retries <= maxRetries) {
      try {
        console.log(`[IMAGE-PROXY] Attempt ${retries + 1} for: ${proxyUrl}`);
        
        response = await axios({
          method: 'get',
          url: proxyUrl,
          responseType: 'arraybuffer',
          timeout: 10000, // 10 second timeout
          headers: customHeaders,
          // Allow non-2xx status codes to handle them manually
          validateStatus: null
        });
        
        console.log(`[IMAGE-PROXY] Response status: ${response.status} for ${proxyUrl}`);
        
        // If successful, break out of retry loop
        if (response.status >= 200 && response.status < 300) {
          break;
        }
        
        // Handle IPFS gateway fallbacks for 403/404 errors
        if (req.ipfsData && req.ipfsData.isIpfs && (response.status === 403 || response.status === 404)) {
          req.ipfsData.currentGatewayIndex++;
          
          // Try the next gateway if available
          if (req.ipfsData.currentGatewayIndex < req.ipfsData.gateways.length) {
            const nextGateway = req.ipfsData.gateways[req.ipfsData.currentGatewayIndex];
            const ipfsHash = req.ipfsData.hash;
            
            console.log(`[IMAGE-PROXY] IPFS gateway failed with status ${response.status}. Trying next gateway: ${nextGateway}`);
            proxyUrl = `${nextGateway}${ipfsHash}`;
            retries++;
            continue;
          }
        }
        
        // If this is Alchemy CDN and we got an error, try an alternative URL format
        if (proxyUrl.includes('nft-cdn.alchemy.com') && retries === 0) {
          console.log(`[IMAGE-PROXY] Alchemy URL failed with status ${response.status}. Trying alternative format.`);
          
          // Try switching format specifier
          if (proxyUrl.includes('/original')) {
            proxyUrl = proxyUrl.replace('/original', '/thumb');
            console.log(`[IMAGE-PROXY] Switching to thumbnail format: ${proxyUrl}`);
            retries++;
            continue;
          } else if (proxyUrl.includes('/thumb')) {
            proxyUrl = proxyUrl.replace('/thumb', '/original');
            console.log(`[IMAGE-PROXY] Switching to original format: ${proxyUrl}`);
            retries++;
            continue;
          }
          
          // Try removing any query parameters that might be causing issues
          const urlWithoutParams = proxyUrl.split('?')[0];
          if (urlWithoutParams !== proxyUrl) {
            console.log(`[IMAGE-PROXY] Removing query parameters: ${urlWithoutParams}`);
            proxyUrl = urlWithoutParams;
            retries++;
            continue;
          }
        }
        
        retries++;
      } catch (retryError) {
        console.error(`[IMAGE-PROXY] Request error: ${retryError.message} for ${proxyUrl}`);
        
        // Special handling for IPFS URLs - try next gateway if available
        if (req.ipfsData && req.ipfsData.isIpfs) {
          req.ipfsData.currentGatewayIndex++;
          
          if (req.ipfsData.currentGatewayIndex < req.ipfsData.gateways.length) {
            const nextGateway = req.ipfsData.gateways[req.ipfsData.currentGatewayIndex];
            const ipfsHash = req.ipfsData.hash;
            
            console.log(`[IMAGE-PROXY] IPFS gateway request failed. Trying next gateway: ${nextGateway}`);
            proxyUrl = `${nextGateway}${ipfsHash}`;
            retries++;
            continue;
          }
        }
        
        retries++;
        
        // If we've exhausted retries, propagate the error
        if (retries > maxRetries) {
          throw retryError;
        }
      }
    }
    
    // Check for non-successful status after all retries
    if (!response || response.status >= 400) {
      console.log(`[IMAGE-PROXY] Failed to retrieve image after ${retries} attempts. Returning placeholder SVG.`);
      
      // Create a more detailed SVG placeholder with the original URL for debugging
      const svgText = url.length > 30 ? `${url.substring(0, 30)}...` : url;
      const placeholderSvg = Buffer.from(`<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
        <rect width="400" height="400" fill="#f0f0f0"/>
        <text x="50%" y="40%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="24px" fill="#666666">
          Image Not Available
        </text>
        <text x="50%" y="60%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="12px" fill="#999999">
          ${svgText}
        </text>
      </svg>`, 'utf-8');
      
      res.setHeader('Content-Type', 'image/svg+xml');
      return res.status(200).send(placeholderSvg);
    }
    
    // Forward the image response with proper content type and caching headers
    res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    res.setHeader('X-GALL3RY-Source', url.substring(0, 100)); // Debugging header
    console.log(`[IMAGE-PROXY] Successfully proxied image: ${url.substring(0, 100)}...`);
    
    return res.status(200).send(response.data);
  } catch (error) {
    console.error(`[IMAGE-PROXY] Fatal error proxying image: ${error.message}`);
    
    // Return a placeholder SVG instead of JSON error
    const placeholderSvg = Buffer.from(`<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
      <rect width="400" height="400" fill="#ffeeee"/>
      <text x="50%" y="40%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="24px" fill="#cc5555">
        Image Proxy Error
      </text>
      <text x="50%" y="60%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="12px" fill="#cc5555">
        ${error.message.substring(0, 50)}
      </text>
    </svg>`, 'utf-8');
    
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.status(200).send(placeholderSvg);
  }
}

// -----------------------------------------------------------------------
// HANDLER: FOLDERS
// -----------------------------------------------------------------------
async function handleFoldersRequest(req, res, path) {
  // Placeholder for folders functionality
  return res.status(200).json({ 
    status: 'Folders API stub', 
    path 
  });
}

// -----------------------------------------------------------------------
// HANDLER: COLLECTION FRIENDS
// -----------------------------------------------------------------------
async function handleCollectionFriendsRequest(req, res) {
  // Get parameters from request
  const { 
    contractAddress, 
    fid, 
    network = 'eth',
    limit = 50
  } = req.query;

  console.log(`[CollectionFriends] Starting request with contractAddress=${contractAddress}, fid=${fid}, network=${network}, limit=${limit}`);

  if (!contractAddress) {
    return res.status(400).json({ error: 'Missing parameter', message: 'contractAddress is required' });
  }

  if (!fid) {
    return res.status(400).json({ error: 'Missing parameter', message: 'fid (Farcaster ID) is required' });
  }

  // Ensure cache objects exist
  if (!CACHE.friends) {
    console.log("[CollectionFriends] Initializing friends cache object");
    CACHE.friends = {};
  }

  // Check cache first - with better error handling
  try {
    const cacheKey = `${contractAddress}:${fid}`;
    console.log(`[CollectionFriends] Cache key: ${cacheKey}`);
    
    const cachedData = CACHE.get('friends', cacheKey);
    if (cachedData) {
      console.log(`[CollectionFriends] Cache hit for ${cacheKey}`);
      return res.status(200).json(cachedData);
    }
  } catch (cacheError) {
    console.error('[CollectionFriends] Cache access error:', cacheError);
    // Continue with normal execution - don't return early on cache error
  }

  try {
    console.log(`[CollectionFriends] Getting collection friends for contract: ${contractAddress}, user FID: ${fid}`);

    // Get Neynar API key
    const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY || process.env.REACT_APP_NEYNAR_API_KEY || 'NEYNAR_API_DOCS';
    console.log(`[CollectionFriends] Using Neynar API key: ${NEYNAR_API_KEY.substring(0, 4)}...`);

    // STEP 1: Get the list of users the Farcaster user follows (using Neynar API)
    let followingList = [];
    let followingCursor = null;
    let hasMoreFollowing = true;

    while (hasMoreFollowing) {
      try {
        // Build Neynar API URL for following list
        const neynarUrl = `https://api.neynar.com/v2/farcaster/following?viewerFid=${fid}&limit=100${followingCursor ? `&cursor=${followingCursor}` : ''}`;
        
        const followingResponse = await axios.get(neynarUrl, {
          headers: {
            'Accept': 'application/json',
            'api_key': NEYNAR_API_KEY
          }
        });
        
        if (followingResponse.data && followingResponse.data.result && followingResponse.data.result.users) {
          followingList = [...followingList, ...followingResponse.data.result.users];
          
          // Check if there's more data to fetch
          if (followingResponse.data.result.next && followingResponse.data.result.next.cursor) {
            followingCursor = followingResponse.data.result.next.cursor;
          } else {
            hasMoreFollowing = false;
          }
        } else {
          hasMoreFollowing = false;
        }
      } catch (error) {
        console.error('Error fetching following list from Neynar:', error.message);
        return res.status(500).json({ 
          error: 'Neynar API error', 
          message: error.message || 'Failed to fetch following list'
        });
      }
    }

    console.log(`Found ${followingList.length} following users for FID ${fid}`);
    
    // Extract all unique addresses from the following list
    let uniqueFollowingAddresses = [];
    
    followingList.forEach(user => {
      // Add custody addresses
      if (user.custody_address) {
        uniqueFollowingAddresses.push(user.custody_address.toLowerCase());
      }
      
      // Add verified ETH addresses if available
      if (user.verified_addresses && user.verified_addresses.eth_addresses) {
        user.verified_addresses.eth_addresses.forEach(address => {
          uniqueFollowingAddresses.push(address.toLowerCase());
        });
      }
    });
    
    // Remove duplicates
    uniqueFollowingAddresses = [...new Set(uniqueFollowingAddresses)];
    
    console.log(`Found ${uniqueFollowingAddresses.length} unique wallet addresses from following list`);

    // STEP 2: Get all wallet addresses that hold NFTs from the specified contract (using Alchemy API)
    // Get Alchemy API key
    const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;
    
    if (!ALCHEMY_API_KEY) {
      return res.status(500).json({ 
        error: 'Server configuration error', 
        message: 'Missing Alchemy API key' 
      });
    }
    
    // Map chain IDs to their correct Alchemy URL formats
    const chainUrlMap = {
      'eth': 'eth-mainnet',
      'ethereum': 'eth-mainnet',
      'polygon': 'polygon-mainnet',
      'arbitrum': 'arb-mainnet',
      'optimism': 'opt-mainnet',
      'base': 'base-mainnet',
      'zora': 'zora-mainnet'
    };
    
    // Get the correct chain URL or default to eth-mainnet
    const chainUrl = chainUrlMap[network.toLowerCase()] || 'eth-mainnet';
    const alchemyUrl = `https://${chainUrl}.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}/getOwnersForContract`;
    
    let allOwners = [];
    let ownersCursor = null;
    let hasMoreOwners = true;

    while (hasMoreOwners) {
      try {
        // Make the request to Alchemy
        const ownersResponse = await axios.get(alchemyUrl, {
          params: {
            contractAddress,
            withTokenBalances: true,
            pageKey: ownersCursor
          }
        });

        if (ownersResponse.data && ownersResponse.data.owners) {
          allOwners = [...allOwners, ...ownersResponse.data.owners];
          
          // Check if there's more data to fetch
          if (ownersResponse.data.pageKey) {
            ownersCursor = ownersResponse.data.pageKey;
          } else {
            hasMoreOwners = false;
          }
        } else {
          hasMoreOwners = false;
        }
      } catch (error) {
        console.error('Error fetching owners for contract from Alchemy:', error.message);
        return res.status(500).json({ 
          error: 'Alchemy API error', 
          message: error.message || 'Failed to fetch contract owners'
        });
      }
    }

    console.log(`Found ${allOwners.length} owners of NFTs from contract ${contractAddress}`);

    // Find the intersection between following addresses and contract owners
    const friendOwners = uniqueFollowingAddresses.filter(address => 
      allOwners.some(owner => owner.toLowerCase() === address.toLowerCase())
    );

    console.log(`Found ${friendOwners.length} friends who own NFTs from collection ${contractAddress}`);
    
    // Return the matching addresses
    return res.status(200).json({
      friendOwners,
      totalFriends: uniqueFollowingAddresses.length,
      totalOwners: allOwners.length
    });
  } catch (error) {
    console.error('Error in collection friends handler:', error);
    return res.status(500).json({
      error: 'Server error',
      message: error.message || 'An unexpected error occurred'
    });
  }
}

// -----------------------------------------------------------------------
// HANDLER: LOGIN
// -----------------------------------------------------------------------
async function handleLoginRequest(req, res) {
  // Placeholder for login functionality
  return res.status(200).json({ 
    status: 'Login API stub' 
  });
}

// -----------------------------------------------------------------------
// HANDLER: V2
// -----------------------------------------------------------------------
async function handleV2Request(req, res) {
  try {
    // Get the endpoint parameter to determine which handler to call
    const { endpoint } = req.query;
    
    if (!endpoint) {
      return res.status(400).json({
        error: "Missing endpoint parameter",
        message: "The v2 API requires an 'endpoint' parameter to specify which service to access"
      });
    }

    console.log(`V2 API request for endpoint: ${endpoint}`);
    
    // Route to the appropriate handler based on the endpoint
    switch (endpoint.toLowerCase()) {
      case 'zapper':
        return await handleZapperRequest(req, res);
      
      case 'alchemy':
        return await handleAlchemyRequest(req, res);
      
      case 'farcaster':
      case 'farcaster-profile':
        return await handleFarcasterProfileRequest(req, res);
      
      case 'basescan':
        return await handleBasescanRequest(req, res);
      
      case 'etherscan':
        return await handleEtherscanRequest(req, res);
      
      case 'opensea':
        return await handleOpenseaRequest(req, res);
      
      default:
        return res.status(400).json({
          error: "Invalid endpoint",
          message: `Endpoint '${endpoint}' is not supported by the v2 API`
        });
    }
  } catch (error) {
    console.error(`Error in V2 API handler: ${error.message}`);
    return res.status(500).json({
      error: "Server Error",
      message: error.message
    });
  }
}

// -----------------------------------------------------------------------
// HANDLER: DIAGNOSTIC API
// -----------------------------------------------------------------------
async function handleDiagnosticRequest(req, res) {
  try {
    // Simple implementation that just acknowledges the diagnostic data
    // This is a simplified version of api/diagnostic.js
    if (req.method === 'POST') {
      console.log('Received diagnostic data:', JSON.stringify(req.body).substring(0, 200) + '...');
      
      // Just return success - in production this would save the data
      return res.status(200).json({
        success: true,
        message: 'Diagnostic data received',
        timestamp: new Date().toISOString()
      });
    } 
    
    if (req.method === 'GET') {
      // Simple check for authorization
      const apiKey = req.headers['x-api-key'];
      const configuredKey = process.env.DIAGNOSTIC_API_KEY;
      
      if (!configuredKey || apiKey !== configuredKey) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      
      // Return empty diagnostic data
      return res.status(200).json({
        success: true,
        message: 'No diagnostic data available',
        timestamp: new Date().toISOString()
      });
    }
    
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error in diagnostic handler:', error);
    return res.status(500).json({
      error: 'Internal server error in diagnostic handler',
      message: error.message
    });
  }
}

// -----------------------------------------------------------------------
// HANDLER: NEYNAR API
// -----------------------------------------------------------------------
async function handleNeynarRequest(req, res) {
  const NEYNAR_API_URL = 'https://api.neynar.com/v2/farcaster';
  
  try {
    // Get Neynar API key from environment variables
    const apiKey = process.env.NEYNAR_API_KEY || process.env.REACT_APP_NEYNAR_API_KEY || '';
    
    if (!apiKey) {
      console.warn('⚠️ No NEYNAR_API_KEY found in environment variables!');
      return res.status(500).json({
        error: 'API Configuration Error',
        message: 'Neynar API key is missing. Please check server configuration.'
      });
    }
    
    // Extract the endpoint from the path
    const endpoint = req.query.endpoint || '';
    if (!endpoint) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Endpoint parameter is required'
      });
    }
    
    // Create API URL
    const apiUrl = `${NEYNAR_API_URL}/${endpoint}`;
    
    // Debug request
    console.log(`Neynar REQUEST - ${apiUrl} with params:`, req.query);
    
    // Set up headers
    const headers = {
      'Accept': 'application/json',
      'api_key': apiKey
    };
    
    // Prepare query parameters (excluding 'endpoint')
    const params = {};
    Object.entries(req.query).forEach(([key, value]) => {
      if (key !== 'endpoint') {
        params[key] = value;
      }
    });
    
    // Try to use cached response if available
    const cacheKey = CACHE.getKey('neynar', { endpoint, params });
    const cachedData = CACHE.get('requests', cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }
    
    // Make request to Neynar API
    const response = await axios.get(apiUrl, {
      headers,
      params
    });
    
    // Cache successful responses
    CACHE.set('requests', cacheKey, response.data, 60000); // 1 minute cache
    
    return res.status(200).json(response.data);
  } catch (error) {
    console.error('Neynar API Error:', error.message);
    
    // Return structured error response
    return res.status(error.response?.status || 500).json({
      error: 'Neynar API error',
      message: error.message,
      details: error.response?.data
    });
  }
}