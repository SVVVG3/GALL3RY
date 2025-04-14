// Consolidated API handler for Vercel deployment
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { parse } = require('url');

// Create Express app
const app = express();

// Configure middleware
app.use(cors());
app.use(express.json());

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
  const ZAPPER_API_URL = 'https://api.zapper.xyz/v2/graphql';
  
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
  const ZAPPER_API_URL = 'https://api.zapper.xyz/v2/graphql';

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
app.all('/alchemy', async (req, res) => {
  // CORS headers for local development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS requests (pre-flight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Get Alchemy API keys from environment variables
  const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || process.env.REACT_APP_ALCHEMY_API_KEY || '';
  
  // Define Alchemy V3 NFT endpoints
  const ENDPOINTS = {
    getNFTsForOwner: (apiKey, chain = 'eth') => {
      const baseUrl = chain === 'eth' 
        ? 'https://eth-mainnet.g.alchemy.com/nft/v3/' 
        : `https://${chain}-mainnet.g.alchemy.com/nft/v3/`;
      return `${baseUrl}${apiKey}/getNFTsForOwner`;
    },
    getNFTMetadata: (apiKey, chain = 'eth') => {
      const baseUrl = chain === 'eth' 
        ? 'https://eth-mainnet.g.alchemy.com/nft/v3/' 
        : `https://${chain}-mainnet.g.alchemy.com/nft/v3/`;
      return `${baseUrl}${apiKey}/getNFTMetadata`;
    },
    getNFTMetadataBatch: (apiKey, chain = 'eth') => {
      const baseUrl = chain === 'eth' 
        ? 'https://eth-mainnet.g.alchemy.com/nft/v3/' 
        : `https://${chain}-mainnet.g.alchemy.com/nft/v3/`;
      return `${baseUrl}${apiKey}/getNFTMetadataBatch`;
    }
  };
  
  // Parse query parameters
  const { query } = parse(req.url, true);
  const { endpoint = 'getNFTsForOwner', chain = 'eth', ...params } = query;
  
  // Validate API key
  if (!ALCHEMY_API_KEY) {
    console.error('Alchemy API key not configured');
    return res.status(401).json({ 
      error: 'API key not configured',
      message: 'Please set your ALCHEMY_API_KEY in environment variables'
    });
  }
  
  // Validate endpoint
  if (!ENDPOINTS[endpoint]) {
    return res.status(400).json({ error: `Invalid endpoint: ${endpoint}` });
  }
  
  try {
    // Build the request URL
    const endpointUrl = ENDPOINTS[endpoint](ALCHEMY_API_KEY, chain);
    
    // Prepare request parameters
    const requestParams = { ...params };
    
    // Enhanced handling for getNFTsForOwner
    if (endpoint === 'getNFTsForOwner') {
      // Make sure all vital parameters are explicitly set for better results
      requestParams.withMetadata = true;
      requestParams.pageSize = requestParams.pageSize || 100;
      requestParams.tokenUriTimeoutInMs = 5000;
      requestParams.includeContract = true;
      requestParams.excludeFilters = requestParams.excludeSpam === 'true' ? ['SPAM'] : [];
      requestParams.includePrice = true;
      requestParams.floorPrice = true;
      
      console.log(`Enhanced getNFTsForOwner parameters:`, requestParams);
    }
    
    // Special handling for POST requests like getNFTMetadataBatch
    if (endpoint === 'getNFTMetadataBatch' && req.method === 'POST') {
      console.log(`Batch request to ${endpointUrl}`);
      
      // Get the request body
      const requestBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      
      if (!requestBody.tokens || !Array.isArray(requestBody.tokens)) {
        return res.status(400).json({ error: 'Tokens must be an array of contractAddress and tokenId objects' });
      }
      
      // Make the POST request
      const response = await axios.post(endpointUrl, requestBody);
      return res.status(200).json(response.data);
    } else {
      // Regular GET request
      console.log(`GET request to ${endpointUrl}`);
      const response = await axios.get(endpointUrl, { params: requestParams });
      return res.status(200).json(response.data);
    }
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