const axios = require('axios');
const { parse } = require('url');

// Load configuration - ensure this is compatible with Vercel's serverless environment
let config;
try {
  config = require('../src/config');
} catch (error) {
  console.error('Error loading config:', error.message);
  config = {
    ALCHEMY_API_KEY: process.env.ALCHEMY_API_KEY || '',
    ALCHEMY_BASE_URL: process.env.ALCHEMY_BASE_URL || 'https://eth-mainnet.g.alchemy.com/v3/',
  };
}

// Alchemy API key - fallback to environment variable if not in config
const ALCHEMY_API_KEY = config.ALCHEMY_API_KEY || process.env.ALCHEMY_API_KEY || process.env.REACT_APP_ALCHEMY_API_KEY;
const ALCHEMY_BASE_URL = config.ALCHEMY_BASE_URL || 'https://eth-mainnet.g.alchemy.com/v3/';

// Log debugging information about API key (masked for security)
console.log(`API key source: ${config.ALCHEMY_API_KEY ? 'config' : process.env.ALCHEMY_API_KEY ? 'process.env' : process.env.REACT_APP_ALCHEMY_API_KEY ? 'REACT_APP env' : 'not found'}`);
console.log(`API key length: ${ALCHEMY_API_KEY ? ALCHEMY_API_KEY.length : 0}`);

// V3 NFT endpoints
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

/**
 * Alchemy API proxy handler for serverless environments
 */
module.exports = async (req, res) => {
  // CORS headers for local development
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS requests (pre-flight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Parse query parameters
  const { query } = parse(req.url, true);
  const { endpoint, chain = 'eth', ...params } = query;
  
  // Validate API key
  if (!ALCHEMY_API_KEY) {
    console.error('Alchemy API key not configured');
    return res.status(401).json({ 
      error: 'API key not configured',
      message: 'Please set your ALCHEMY_API_KEY in config or environment variables'
    });
  }
  
  // Log a masked version of the API key for debugging
  const maskedKey = ALCHEMY_API_KEY.substring(0, 4) + '...' + ALCHEMY_API_KEY.substring(ALCHEMY_API_KEY.length - 4);
  console.log(`Using Alchemy API key: ${maskedKey}`);
  
  // Validate endpoint
  if (!endpoint) {
    return res.status(400).json({ error: 'Missing endpoint parameter' });
  }
  
  if (!ENDPOINTS[endpoint]) {
    return res.status(400).json({ error: `Invalid endpoint: ${endpoint}` });
  }
  
  try {
    // Build the request URL
    const endpointUrl = ENDPOINTS[endpoint](ALCHEMY_API_KEY, chain);
    
    // Prepare request parameters
    const requestParams = { ...params };
    
    // Ensure we always get complete metadata for better image handling
    if (endpoint === 'getNFTsForOwner') {
      // Make sure these parameters are explicitly set for best results
      requestParams.withMetadata = true;
      requestParams.pageSize = requestParams.pageSize || 100;
      
      // Exclude spam by default unless explicitly set to false
      if (requestParams.excludeSpam !== 'false') {
        requestParams.excludeFilters = 'SPAM';
      }
    }
    
    // Handle array parameters
    Object.keys(requestParams).forEach(key => {
      if (key.endsWith('[]')) {
        const baseKey = key.slice(0, -2);
        if (!Array.isArray(requestParams[baseKey])) {
          requestParams[baseKey] = [requestParams[key]];
        }
        delete requestParams[key];
      }
    });
    
    // Log the request (without sensitive data)
    console.log(`Proxying Alchemy API request to ${endpoint} on ${chain} chain`);
    
    // Special handling for POST requests like getNFTMetadataBatch
    if (endpoint === 'getNFTMetadataBatch') {
      console.log(`Batch request to ${endpointUrl}`);
      
      // For POST requests, get the body from the request
      let requestBody = {};
      
      // If this is actually a GET request with tokens in params, convert to proper format
      if (req.method === 'GET' && requestParams.tokens) {
        try {
          requestBody.tokens = JSON.parse(requestParams.tokens);
        } catch (e) {
          console.error('Invalid tokens parameter:', e);
          requestBody.tokens = [];
        }
        
        // Add other params
        if (requestParams.refreshCache) {
          requestBody.refreshCache = requestParams.refreshCache === 'true';
        }
      } else {
        // Otherwise, parse the body if available
        if (req.body) {
          requestBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        }
      }
      
      // Make the POST request
      console.log(`Making POST request with body:`, JSON.stringify(requestBody).substring(0, 100) + '...');
      
      const response = await axios.post(endpointUrl, requestBody);
      
      // Return the response
      return res.status(200).json(response.data);
    }
    
    // Regular GET request for other endpoints
    console.log(`Full URL: ${endpointUrl}?${new URLSearchParams(requestParams).toString()}`);
    
    // Call the Alchemy API
    const response = await axios.get(endpointUrl, { params: requestParams });
    
    // Log success response summary
    console.log(`Alchemy API success: ${response.status}, data length: ${JSON.stringify(response.data).length}`);
    if (response.data.ownedNfts) {
      console.log(`Retrieved ${response.data.ownedNfts.length} NFTs for owner`);
    }
    
    // Return the API response
    return res.status(200).json(response.data);
  } catch (error) {
    console.error('Alchemy API error:', error.message);
    
    // Check for a response with error details
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Data:`, error.response.data);
      
      if (error.response.status === 401) {
        console.error('API KEY ERROR: Your Alchemy API key is invalid or missing');
        console.error(`Key used: ${ALCHEMY_API_KEY ? ALCHEMY_API_KEY.substring(0, 4) + '...' + ALCHEMY_API_KEY.substring(ALCHEMY_API_KEY.length - 4) : 'NONE'}`);
      }
      
      // Return the error details
      return res.status(error.response.status).json({
        error: 'Alchemy API request failed',
        status: error.response.status,
        message: error.message,
        details: error.response.data
      });
    }
    
    // Generic error handling
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}; 