// Single serverless function API handler for Vercel Hobby plan (function limit)
// -----------------------------------------------------------------------
// This file contains ALL API functionality in one file to avoid hitting Vercel's
// 12 function limit on the Hobby plan.

import axios from 'axios';

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
export default async function handler(req, res) {
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
    
    console.log(`[API] Request to: ${path}`);
    
    // Route based on the path
    let result;
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
      result = await handleV2Request(req, res, path);
    } else {
      // Default: Not found
      return res.status(404).json({ 
        error: 'API endpoint not found',
        path,
        url
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
    
    // Check if this is a Farcaster profile request
    let isFarcasterRequest = false;
    
    if (req.body?.query && req.body.query.includes('farcasterProfile')) {
      isFarcasterRequest = true;
    } else {
      // If not a Farcaster request, don't process it through Zapper
      console.warn('Non-Farcaster request attempted on Zapper endpoint');
      return res.status(400).json({
        error: 'Invalid request',
        message: 'The Zapper endpoint is only for Farcaster profile requests'
      });
    }
    
    // Try to use cached response if available
    const cacheKey = CACHE.getKey('zapper', req.body);
    const cachedData = CACHE.get('requests', cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }
    
    // Set up headers with API key according to documentation
    const headers = {
      'Content-Type': 'application/json',
      'x-zapper-api-key': apiKey
    };
    
    // Forward the request to Zapper
    const response = await axios({
      method: 'post',
      url: ZAPPER_API_URL,
      headers: headers,
      data: req.body,
      timeout: 15000 // Extended timeout to 15 seconds
    });
    
    // Cache the response
    CACHE.set('requests', cacheKey, response.data);
    
    // Return the response from Zapper
    return res.status(response.status).json(response.data);
    
  } catch (error) {
    console.error('Error proxying to Zapper:', error.message);
    
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
  // Placeholder for collection-friends functionality
  return res.status(200).json({ 
    status: 'Collection Friends API stub'
  });
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
  // Placeholder for farcaster functionality
  return res.status(200).json({ 
    status: 'Farcaster API stub'
  });
}

// -----------------------------------------------------------------------
// HANDLER: V2 API
// -----------------------------------------------------------------------
async function handleV2Request(req, res, path) {
  const v2Path = path.split('v2/')[1];
  
  if (v2Path === 'graphql') {
    // Placeholder for GraphQL functionality
    return res.status(200).json({ 
      status: 'GraphQL API stub'
    });
  }
  
  return res.status(404).json({ 
    error: 'V2 API endpoint not found',
    path: v2Path
  });
} 