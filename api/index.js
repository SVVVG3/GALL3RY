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
    
    // Define Alchemy V3 NFT endpoints
    const ENDPOINTS = {
      // Use consistent lowercase keys for the endpoints
      getnftsforowner: (apiKey, chain = 'eth') => {
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
        console.log(`Using Alchemy URL for ${chain}: ${baseUrl}${apiKey}/getNFTsForOwner`);
        
        return `${baseUrl}${apiKey}/getNFTsForOwner`;
      },
      getnftmetadata: (apiKey, chain = 'eth') => {
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
        
        return `${baseUrl}${apiKey}/getNFTMetadata`;
      },
      getnftsforcollection: (apiKey, chain = 'eth') => {
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
        
        return `${baseUrl}${apiKey}/getNFTsForCollection`;
      }
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
    const requestParams = { ...req.query };
    
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
      } else if (requestParams.excludeSpam === 'true') {
        // Convert excludeSpam parameter to the correct excludeFilters format
        requestParams.excludeFilters = ['SPAM'];
      }
      
      // Ensure proper boolean parameters
      requestParams.withMetadata = requestParams.withMetadata !== 'false';
      requestParams.includeContract = requestParams.includeContract !== 'false';
      
      // Alchemy V3 image params - ensure these are set to get full image URLs
      requestParams.includeMedia = true;
      
      // Set page size with default
      requestParams.pageSize = parseInt(requestParams.pageSize || '100', 10);
      
      console.log(`Enhanced getNFTsForOwner parameters:`, requestParams);
    }
    
    // Make the API request
    let response;
    if (req.method === 'GET') {
      console.log(`GET request to ${endpointUrl}`, { params: requestParams });
      response = await axios.get(endpointUrl, { params: requestParams });
    } else if (req.method === 'POST') {
      console.log(`POST request to ${endpointUrl}`, { body: req.body });
      
      // Handle special case for batch owners request
      if (normalizedEndpoint === 'getnftsforowner' && req.body.owners && Array.isArray(req.body.owners)) {
        console.log(`Batch request for multiple owners: ${req.body.owners.length} addresses`);
        
        // For multiple owners, we need to make separate requests
        const allNfts = [];
        let totalCount = 0;
        
        // Process each owner address
        for (const owner of req.body.owners) {
          try {
            const ownerParams = { 
              ...requestParams, 
              owner,
              withMetadata: req.body.withMetadata !== false,
              excludeFilters: req.body.excludeFilters || ['SPAM'],
              includeMedia: true // Ensure we get media/image data
            };
            
            console.log(`Fetching NFTs for owner: ${owner}`);
            const ownerResponse = await axios.get(endpointUrl, { params: ownerParams });
            
            if (ownerResponse.data?.ownedNfts) {
              // Add owner address to each NFT before adding to results
              const nftsWithOwner = ownerResponse.data.ownedNfts.map(nft => ({
                ...nft,
                ownerAddress: owner  // Explicitly add the owner address
              }));
              
              allNfts.push(...nftsWithOwner);
              totalCount += ownerResponse.data.totalCount || 0;
            }
          } catch (e) {
            console.error(`Error fetching NFTs for ${owner}:`, e.message);
          }
        }
        
        // Return combined results
        return res.status(200).json({
          ownedNfts: allNfts,
          totalCount,
          pageKey: null // No pagination for batch requests
        });
      }
      
      // Regular POST request
      response = await axios.post(endpointUrl, req.body);
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    
    // Debug: Log the response structure (not the full data)
    console.log(`Alchemy response status: ${response.status}, data keys: ${Object.keys(response.data || {})}`);
    
    // If this is a getNftsForOwner request, ensure ownerAddress is set on each NFT
    if (normalizedEndpoint === 'getnftsforowner' && response.data?.ownedNfts && requestParams.owner) {
      // Add owner address to each NFT
      response.data.ownedNfts = response.data.ownedNfts.map(nft => ({
        ...nft,
        ownerAddress: requestParams.owner // Explicitly add the owner address
      }));
    }
    
    return res.status(200).json(response.data);
  } catch (error) {
    console.error('Alchemy API error:', error.message);
    
    return res.status(error.response?.status || 500).json({
      error: 'Error from Alchemy API',
      message: error.message,
      details: error.response?.data
    });
  }
});

// Catch-all route for unmatched API endpoints
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    message: 'The requested API endpoint does not exist'
  });
});

// Vercel serverless function handler
module.exports = (req, res) => {
  // Get the path from the URL
  const url = new URL(req.url, `https://${req.headers.host}`);
  // Remove any '/api' prefix that Vercel might add
  req.url = url.pathname.replace(/^\/api/, '');
  if (req.url === '') req.url = '/';
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // Process the request with Express
  return app(req, res);
}; 