/**
 * API routes for the application
 */
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { URL, parse } = require('url');

// Create router
const app = express();

// Middleware
app.use(express.json());

// CORS options for all routes
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ZAPPER API - Used only for Farcaster profile data and connected wallets
app.post('/zapper', async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

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
    let username = null;
    let fid = null;
    
    if (req.body?.query && req.body.query.includes('farcasterProfile')) {
      isFarcasterRequest = true;
      
      if (req.body.variables) {
        username = req.body.variables.username;
        fid = req.body.variables.fid;
      }
      
      console.log(`Farcaster profile request for username: ${username}, fid: ${fid}`);
    } else {
      // If not a Farcaster request, don't process it through Zapper
      console.warn('Non-Farcaster request attempted on Zapper endpoint');
      return res.status(400).json({
        error: 'Invalid request',
        message: 'The Zapper endpoint is only for Farcaster profile requests'
      });
    }
    
    // Set up headers with API key
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'x-zapper-api-key': apiKey,
      'User-Agent': 'GALL3RY/1.0 (+https://gall3ry.vercel.app)'
    };
    
    // Forward the request to Zapper
    const response = await axios({
      method: 'post',
      url: ZAPPER_API_URL,
      headers: headers,
      data: req.body,
      timeout: 10000 // 10 second timeout
    });
    
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
});

// FARCASTER PROFILE API - Dedicated endpoint for Farcaster profile data
app.get('/farcaster-profile', async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

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

    // Set up headers with API key
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'x-zapper-api-key': apiKey,
      'User-Agent': 'GALL3RY/1.0 (+https://gall3ry.vercel.app)'
    };
    
    // Make the GraphQL request to Zapper
    const response = await axios({
      method: 'post',
      url: ZAPPER_API_URL,
      headers: headers,
      data: {
        query,
        variables
      },
      timeout: 10000 // 10 second timeout
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
      console.log('Profile found:', JSON.stringify(response.data.data.farcasterProfile, null, 2));
      return res.status(200).json(response.data.data.farcasterProfile);
    } else {
      console.log('No profile found in response:', JSON.stringify(response.data));
      return res.status(404).json({
        error: 'Profile Not Found',
        message: `No Farcaster profile found for ${username || fid}`
      });
    }
    
  } catch (error) {
    console.error('Error fetching Farcaster profile:', error.message);
    
    // Log the full error for debugging
    if (error.response) {
      console.error('Error response data:', JSON.stringify(error.response.data));
      console.error('Error response status:', error.response.status);
      console.error('Error response headers:', JSON.stringify(error.response.headers));
    }
    
    // Return an appropriate error response
    return res.status(error.response?.status || 500).json({
      error: 'Error fetching Farcaster profile',
      message: error.message,
      details: error.response?.data
    });
  }
});

// ALCHEMY API - Used for all NFT data
app.all('/alchemy', cors(corsOptions), async (req, res) => {
  // Add CORS headers for pre-flight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).send('OK');
  }
  
  // Get Alchemy API key - prioritize the server environment variable
  // NOTE: NEVER fallback to a demo key, fail properly if no key is available
  const apiKey = process.env.ALCHEMY_API_KEY;
  
  // Debug: Log API key (redacted) to verify it's set
  console.log('Alchemy API Key Status:', apiKey ? 
    `Valid key found (${apiKey.slice(0, 4)}...${apiKey.slice(-4)})` : 
    'NOT SET - CRITICAL ERROR');
  
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
    
    // Debug: Log request details
    console.log('Alchemy request:', { 
      endpoint, 
      chain, 
      method: req.method,
      params: req.method === 'GET' ? req.query : req.body,
      url: req.url,
      originalUrl: req.originalUrl
    });
    
    if (!endpoint) {
      return res.status(400).json({ error: 'Missing endpoint parameter' });
    }
    
    // Define Alchemy V3 NFT endpoints - format based on official docs
    // See: https://docs.alchemy.com/reference/getnftsforowner-v3
    const ENDPOINTS = {
      // Map endpoint keys to functions that build the correct URL
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
        // Using the format from Alchemy docs: https://docs.alchemy.com/reference/getnftsforowner-v3
        const baseUrl = `https://${chainUrl}.g.alchemy.com/nft/v3/`;
        console.log(`Using Alchemy URL for ${chain}: ${baseUrl}${apiKey}/getNFTsForOwner`);
        
        return `${baseUrl}${apiKey}/getNFTsForOwner`;
      },
      // Add other endpoints with the same pattern as needed...
    };
    
    // Normalize the endpoint name to lowercase for case-insensitive comparison
    const normalizedEndpoint = endpoint.toLowerCase();
    console.log('Normalized endpoint:', normalizedEndpoint);
    
    // Validate endpoint
    if (!ENDPOINTS[normalizedEndpoint]) {
      return res.status(400).json({ 
        error: `Invalid endpoint: ${endpoint}`,
        validEndpoints: Object.keys(ENDPOINTS).join(', ')
      });
    }
    
    // Build the request URL using the normalized endpoint
    const endpointUrl = ENDPOINTS[normalizedEndpoint](apiKey, chain);
    
    // Prepare request parameters according to Alchemy v3 API format
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
      
      console.log(`Enhanced getNFTsForOwner parameters:`, requestParams);
    }
    
    // Make the API request
    console.log(`GET request to ${endpointUrl}`, { params: requestParams });
    const response = await axios.get(endpointUrl, { 
      params: requestParams,
      timeout: 15000 // 15 second timeout
    });
    
    // Debug: Log the response structure (not the full data)
    console.log(`Alchemy response status: ${response.status}, data keys: ${Object.keys(response.data || {})}, NFTs count: ${response.data?.ownedNfts?.length || 0}`);
    
    // If this is a getNftsForOwner request, ensure ownerAddress is set on each NFT
    if (normalizedEndpoint === 'getnftsforowner' && response.data?.ownedNfts && requestParams.owner) {
      // Add owner address to each NFT for easier filtering later
      response.data.ownedNfts = response.data.ownedNfts.map(nft => ({
        ...nft,
        ownerAddress: requestParams.owner
      }));
    }
    
    return res.status(200).json(response.data);
  } catch (error) {
    console.error('Alchemy API error:', error.message);
    
    // Enhanced error reporting
    if (error.response) {
      console.error('Alchemy API error details:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    }
    
    return res.status(error.response?.status || 500).json({
      error: 'Error from Alchemy API',
      message: error.message,
      details: error.response?.data
    });
  }
});

// IMAGE PROXY API - Used for loading NFT images across different providers
app.get('/image-proxy', async (req, res) => {
  // Set CORS headers to allow cross-origin requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Get image URL from query parameter
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'Missing url parameter' });
  }
  
  console.log(`Image proxy request for: ${decodeURIComponent(url)}`);
  
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
    
    // Special handling for different URL types
    
    // Handle Alchemy CDN URLs specifically
    if (proxyUrl.includes('nft-cdn.alchemy.com')) {
      console.log('Detected Alchemy CDN URL, adding special headers');
      customHeaders = {
        ...customHeaders,
        'Cache-Control': 'no-cache',
        'Origin': 'https://gall3ry.vercel.app'
      };
    }
    
    // Special handling for IPFS URLs
    if (proxyUrl.startsWith('ipfs://')) {
      proxyUrl = proxyUrl.replace('ipfs://', 'https://cloudflare-ipfs.com/ipfs/');
      console.log(`Converted IPFS URL: ${url} -> ${proxyUrl}`);
    }
    
    // Handle ipfs links that aren't using the ipfs:// protocol
    if (proxyUrl.includes('/ipfs/')) {
      console.log('Detected standard IPFS gateway URL');
      // Just keep the URL as is, but add special headers
      customHeaders = {
        ...customHeaders,
        'Origin': null
      };
    }
    
    // Special handling for Arweave URLs
    if (proxyUrl.startsWith('ar://')) {
      proxyUrl = proxyUrl.replace('ar://', 'https://arweave.net/');
      console.log(`Converted Arweave URL: ${url} -> ${proxyUrl}`);
    }
    
    console.log(`Fetching from final URL: ${proxyUrl}`);
    
    // Fetch the image with retries
    let response;
    let retries = 0;
    const maxRetries = 2;
    
    while (retries <= maxRetries) {
      try {
        console.log(`Fetching image (attempt ${retries + 1}): ${proxyUrl}`);
        
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
        
        console.log(`Received status ${response.status} from ${proxyUrl}`);
        
        // If this is Alchemy CDN and we got an error, try an alternative URL format
        if (proxyUrl.includes('nft-cdn.alchemy.com') && retries === 0) {
          // Try removing any query parameters that might be causing issues
          const urlWithoutParams = proxyUrl.split('?')[0];
          if (urlWithoutParams !== proxyUrl) {
            console.log(`Retrying with cleaned URL: ${urlWithoutParams}`);
            proxyUrl = urlWithoutParams;
            retries++;
            continue;
          }
        }
        
        retries++;
      } catch (retryError) {
        console.error(`Error on attempt ${retries + 1}:`, retryError.message);
        retries++;
        
        // If we've exhausted retries, propagate the error
        if (retries > maxRetries) {
          throw retryError;
        }
      }
    }
    
    // Check for non-successful status after all retries
    if (!response || response.status >= 400) {
      console.error(`Source returned error status ${response?.status || 'unknown'} for: ${proxyUrl}`);
      
      // Create a simple SVG placeholder instead of returning JSON
      const placeholderSvg = Buffer.from(`