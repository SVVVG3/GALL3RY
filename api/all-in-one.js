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
    const chain = req.query.chain || 'eth';
    
    if (!endpoint) {
      return res.status(400).json({ error: 'Missing endpoint parameter' });
    }
    
    // Define Alchemy V3 NFT endpoints - format based on official docs
    const ENDPOINTS = {
      'getnftsforowner': (apiKey, chain = 'eth') => {
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
        const chainUrl = chainUrlMap[chain.toLowerCase()] || 'eth-mainnet';
        
        // Build the full URL with the correct format
        const baseUrl = `https://${chainUrl}.g.alchemy.com/nft/v3/`;
        return `${baseUrl}${apiKey}/getNFTsForOwner`;
      },
      'getassettransfers': (apiKey, chain = 'eth') => {
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
        const chainUrl = chainUrlMap[chain.toLowerCase()] || 'eth-mainnet';
        
        // Build the URL for Alchemy's Core API (getAssetTransfers is part of core, not NFT API)
        return `https://${chainUrl}.g.alchemy.com/v2/${apiKey}`;
      }
    };
    
    // Normalize the endpoint name to lowercase for case-insensitive comparison
    const normalizedEndpoint = endpoint.toLowerCase();
    
    // Validate endpoint
    if (!ENDPOINTS[normalizedEndpoint]) {
      return res.status(400).json({ 
        error: `Invalid endpoint: ${endpoint}`,
        validEndpoints: Object.keys(ENDPOINTS).join(', ')
      });
    }
    
    // Check cache for this request
    const cacheKey = CACHE.getKey(normalizedEndpoint, req.query);
    const cachedData = CACHE.get('requests', cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }
    
    // Build the request URL using the normalized endpoint
    const endpointUrl = ENDPOINTS[normalizedEndpoint](apiKey, chain);
    
    // Special handling for getAssetTransfers - uses JSON-RPC instead of REST
    if (normalizedEndpoint === 'getassettransfers') {
      // Extract addresses from query parameters
      let addresses = req.query.addresses ? req.query.addresses.split(',') : [];
      addresses = addresses.map(addr => addr.toLowerCase().trim());
      
      if (addresses.length === 0) {
        return res.status(400).json({ error: 'No addresses provided for getAssetTransfers' });
      }
      
      // Try to use cached transfer data first
      const transferCacheKey = addresses.sort().join(',');
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
      
      console.log(`Fetching asset transfers for ${addresses.length} addresses`);
      
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
            chain: chain,
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
          chain: chain,
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
    
    // Make the API request
    console.log(`Making Alchemy API request to ${normalizedEndpoint} for chain ${chain}`);
    const response = await axios.get(endpointUrl, { 
      params: requestParams,
      timeout: 15000 // 15 second timeout
    });
    
    // If this is a getNftsForOwner request, ensure ownerAddress is set on each NFT
    // AND add transferTimestamp from our cached transfer data if available
    if (normalizedEndpoint === 'getnftsforowner' && response.data?.ownedNfts && requestParams.owner) {
      // Try to get cached transfer data to enhance the NFTs with timestamps
      const ownerAddress = requestParams.owner.toLowerCase();
      const transferCacheKey = ownerAddress;
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
  // Zapper GraphQL API URLs for fallback
  const PRIMARY_API_URL = 'https://api.zapper.xyz/v2/graphql';
  const BACKUP_API_URL = 'https://public.zapper.xyz/graphql';

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

    // Get username or FID from query parameters
    const { username, fid } = req.query;
    
    if (!username && !fid) {
      return res.status(400).json({
        error: 'Invalid Request',
        message: 'Either username or fid parameter is required'
      });
    }

    console.log(`Farcaster profile request via dedicated endpoint for: ${username || fid}`);
    
    // Check cache first
    const cacheKey = username || `fid-${fid}`;
    const cachedProfile = CACHE.get('profiles', cacheKey);
    if (cachedProfile) {
      return res.status(200).json(cachedProfile);
    }
    
    // Build the GraphQL query based on what was provided
    const query = `
      query GetFarcasterProfile(${fid ? '$fid: Int' : '$username: String'}) {
        farcasterProfile(${fid ? 'fid: $fid' : 'username: $username'}) {
          username
          fid
          metadata {
            displayName
            description
            imageUrl
            warpcast
          }
          custodyAddress
          connectedAddresses
        }
      }
    `;

    // Build variables based on what was provided
    const variables = fid ? { fid: parseInt(fid, 10) } : { username };

    // Debug request details
    console.log('Farcaster REQUEST - GraphQL query:', query.replace(/\s+/g, ' ').trim().substring(0, 100) + '...');
    console.log('Farcaster REQUEST - Variables:', JSON.stringify(variables));

    // Set up headers with API key according to documentation
    const headers = {
      'Content-Type': 'application/json',
      'x-zapper-api-key': apiKey,
      'User-Agent': 'Gall3ry/1.0.0',
      'Accept': 'application/json'
    };
    
    // Create an array of endpoints to try in sequence
    const endpoints = [
      { url: PRIMARY_API_URL, name: 'Primary API endpoint' },
      { url: BACKUP_API_URL, name: 'Backup public endpoint' }
    ];
    
    let lastError = null;
    
    // Try each endpoint in sequence
    for (const endpoint of endpoints) {
      try {
        console.log(`Trying Farcaster profile endpoint: ${endpoint.name}`);
        // Make the GraphQL request to Zapper with better error handling
        const response = await axios({
          method: 'post',
          url: endpoint.url,
          headers: headers,
          data: {
            query,
            variables
          },
          timeout: 15000 // Extended to 15 second timeout for better reliability
        });
        
        console.log(`Farcaster RESPONSE - Success from ${endpoint.name}, Status: ${response.status}`);
        
        // Check for GraphQL errors
        if (response.data?.errors) {
          console.log('GraphQL errors received:', JSON.stringify(response.data.errors));
          
          // Only log this as a warning and continue to the next endpoint if this isn't a "not found" error
          const notFoundError = response.data.errors.some(err => 
            err.message && (
              err.message.includes('not found') || 
              err.message.includes('No profile') ||
              err.message.includes('Invalid')
            )
          );
          
          if (notFoundError) {
            // This is a valid "not found" response, return it directly
            return res.status(404).json({
              error: 'Profile Not Found',
              message: `No Farcaster profile found for ${username || fid}`
            });
          }
          
          // For other GraphQL errors, try the next endpoint
          lastError = new Error('GraphQL Errors: ' + response.data.errors.map(e => e.message).join('; '));
          continue;
        }
        
        // Return the profile data
        if (response.data?.data?.farcasterProfile) {
          // Cache the profile
          CACHE.set('profiles', cacheKey, response.data.data.farcasterProfile, 600000); // 10 minute TTL
          
          return res.status(200).json(response.data.data.farcasterProfile);
        } else {
          // No profile found but no errors either (unusual case)
          lastError = new Error('Profile data not found in response');
          continue;
        }
      } catch (error) {
        console.error(`Error with Farcaster endpoint ${endpoint.name}:`, error.message);
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
    console.error('All Farcaster profile endpoints failed');
    
    return res.status(lastError?.response?.status || 502).json({
      error: 'Error fetching Farcaster profile',
      message: `All Farcaster endpoints failed: ${lastError?.message || 'Unknown error'}`,
      details: lastError?.response?.data
    });
  } catch (error) {
    console.error('Unexpected error in Farcaster profile handler:', error);
    
    // Return an appropriate error response
    return res.status(error.response?.status || 500).json({
      error: 'Error fetching Farcaster profile',
      message: error.message,
      details: error.response?.data
    });
  }
}

// -----------------------------------------------------------------------
// HANDLER: IMAGE PROXY
// -----------------------------------------------------------------------
async function handleImageProxyRequest(req, res) {
  // Get image URL from query parameter
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }
  
  try {
    // Always decode the URL to handle any encoded characters
    let proxyUrl = decodeURIComponent(url);
    
    // Default headers for most requests
    let customHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
      'Referer': 'https://gall3ry.vercel.app/',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br'
    };
    
    // Handle Alchemy CDN URLs specifically
    if (proxyUrl.includes('nft-cdn.alchemy.com')) {
      customHeaders = {
        ...customHeaders,
        'Cache-Control': 'no-cache',
        'Origin': 'https://gall3ry.vercel.app'
      };
    }
    
    // Special handling for IPFS URLs
    if (proxyUrl.startsWith('ipfs://')) {
      proxyUrl = proxyUrl.replace('ipfs://', 'https://cloudflare-ipfs.com/ipfs/');
    }
    
    // Handle ipfs links that aren't using the ipfs:// protocol
    if (proxyUrl.includes('/ipfs/')) {
      // Just keep the URL as is, but add special headers
      customHeaders = {
        ...customHeaders,
        'Origin': null
      };
    }
    
    // Special handling for Arweave URLs
    if (proxyUrl.startsWith('ar://')) {
      proxyUrl = proxyUrl.replace('ar://', 'https://arweave.net/');
    }
    
    // Fetch the image with retries
    let response;
    let retries = 0;
    const maxRetries = 2;
    
    while (retries <= maxRetries) {
      try {
        response = await axios({
          method: 'get',
          url: proxyUrl,
          responseType: 'arraybuffer',
          timeout: 10000, // 10 second timeout
          headers: customHeaders,
          // Allow non-2xx status codes to handle them manually
          validateStatus: null
        });
        
        // If successful, break out of retry loop
        if (response.status >= 200 && response.status < 300) {
          break;
        }
        
        // If this is Alchemy CDN and we got an error, try an alternative URL format
        if (proxyUrl.includes('nft-cdn.alchemy.com') && retries === 0) {
          // Try removing any query parameters that might be causing issues
          const urlWithoutParams = proxyUrl.split('?')[0];
          if (urlWithoutParams !== proxyUrl) {
            proxyUrl = urlWithoutParams;
            retries++;
            continue;
          }
        }
        
        retries++;
      } catch (retryError) {
        retries++;
        
        // If we've exhausted retries, propagate the error
        if (retries > maxRetries) {
          throw retryError;
        }
      }
    }
    
    // Check for non-successful status after all retries
    if (!response || response.status >= 400) {
      // Create a simple SVG placeholder instead of returning JSON
      const placeholderSvg = Buffer.from(`<svg width="400" height="400" xmlns="http://www.w3.org/2000/svg">
        <rect width="400" height="400" fill="#cccccc"/>
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="24px" fill="#666666">
          Image Not Available
        </text>
      </svg>`, 'utf-8');
      
      res.setHeader('Content-Type', 'image/svg+xml');
      return res.status(200).send(placeholderSvg);
    }
    
    // Forward the image response
    res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // Cache for 1 year
    return res.status(200).send(response.data);
  } catch (error) {
    console.error(`Error proxying image: ${error.message}`);
    return res.status(500).json({ error: 'Failed to proxy image' });
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
// HANDLER: FARCASTER
// -----------------------------------------------------------------------
async function handleFarcasterRequest(req, res) {
  // Zapper GraphQL API URL
  const ZAPPER_API_URL = 'https://public.zapper.xyz/graphql';

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

    // Get username or FID from query parameters
    const { username, fid } = req.query;
    
    if (!username && !fid) {
      return res.status(400).json({
        error: 'Invalid Request',
        message: 'Either username or fid parameter is required'
      });
    }

    console.log(`Farcaster profile request via /api/farcaster endpoint for: ${username || fid}`);
    
    // Check cache first
    const cacheKey = username || `fid-${fid}`;
    const cachedProfile = CACHE.get('profiles', cacheKey);
    if (cachedProfile) {
      return res.status(200).json(cachedProfile);
    }
    
    // Build the GraphQL query based on what was provided
    const query = `
      query GetFarcasterProfile(${fid ? '$fid: Int' : '$username: String'}) {
        farcasterProfile(${fid ? 'fid: $fid' : 'username: $username'}) {
          username
          fid
          metadata {
            displayName
            description
            imageUrl
            warpcast
          }
          custodyAddress
          connectedAddresses
        }
      }
    `;

    // Build variables based on what was provided
    const variables = fid ? { fid: parseInt(fid, 10) } : { username };

    // Set up headers with API key according to documentation
    const headers = {
      'Content-Type': 'application/json',
      'x-zapper-api-key': apiKey
    };
    
    // Make the GraphQL request to Zapper with better error handling
    const response = await axios({
      method: 'post',
      url: ZAPPER_API_URL,
      headers: headers,
      data: {
        query,
        variables
      },
      timeout: 15000 // Extended to 15 second timeout for better reliability
    });
    
    // Check for GraphQL errors
    if (response.data?.errors) {
      console.log('GraphQL errors received:', JSON.stringify(response.data.errors));
      return res.status(400).json({
        error: 'GraphQL Error',
        message: response.data.errors[0]?.message || 'Unknown GraphQL error',
        details: response.data.errors
      });
    }
    
    // Return the profile data
    if (response.data?.data?.farcasterProfile) {
      // Cache the profile
      CACHE.set('profiles', cacheKey, response.data.data.farcasterProfile, 600000); // 10 minute TTL
      
      return res.status(200).json(response.data.data.farcasterProfile);
    } else {
      return res.status(404).json({
        error: 'Profile Not Found',
        message: `No Farcaster profile found for ${username || fid}`
      });
    }
    
  } catch (error) {
    console.error('Error fetching Farcaster profile:', error.message);
    
    // Return an appropriate error response
    return res.status(error.response?.status || 500).json({
      error: 'Error fetching Farcaster profile',
      message: error.message,
      details: error.response?.data
    });
  }
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