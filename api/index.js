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

// Zapper API endpoint
app.post('/zapper', async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // CORRECT API URL FROM DOCUMENTATION
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
    
    // CORRECT AUTHORIZATION HEADER AS PER DOCUMENTATION
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'x-zapper-api-key': apiKey,
      'User-Agent': 'GALL3RY/1.0 (https://gall3ry.vercel.app)'
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

// Alchemy API endpoint
app.get('/alchemy', async (req, res) => {
  // Get Alchemy API keys from environment variables
  const ALCHEMY_ETH_API_KEY = process.env.REACT_APP_ALCHEMY_ETH_API_KEY || '';
  const ALCHEMY_BASE_API_KEY = process.env.REACT_APP_ALCHEMY_BASE_API_KEY || '';
  
  // Parse query parameters
  const { query } = parse(req.url, true);
  const { endpoint, chain = 'eth', ...params } = query;
  
  // Determine which API key to use based on chain
  const apiKey = chain === 'base' ? ALCHEMY_BASE_API_KEY : ALCHEMY_ETH_API_KEY;
  
  // Validate API key
  if (!apiKey) {
    console.error('Alchemy API key not configured for chain:', chain);
    return res.status(401).json({ 
      error: 'API key not configured',
      message: `Please set your ALCHEMY_${chain.toUpperCase()}_API_KEY in environment variables`
    });
  }
  
  // Build the API URL
  const baseUrl = chain === 'eth' 
    ? 'https://eth-mainnet.g.alchemy.com/nft/v3/' 
    : `https://${chain}-mainnet.g.alchemy.com/nft/v3/`;
  const apiUrl = `${baseUrl}${apiKey}/${endpoint || 'getNFTsForOwner'}`;
  
  try {
    // Make the request to Alchemy
    const response = await axios.get(apiUrl, { params });
    
    // Return the response from Alchemy
    return res.status(200).json(response.data);
  } catch (error) {
    console.error('Error calling Alchemy API:', error.message);
    
    // Return an appropriate error response
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