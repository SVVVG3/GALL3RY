// Load environment variables from .env file
require('dotenv').config();

// Validate critical environment variables
if (!process.env.ALCHEMY_API_KEY) {
  console.error('CRITICAL ERROR: ALCHEMY_API_KEY environment variable is not set');
  console.error('The application requires a valid Alchemy API key to function properly');
  console.error('Please set this in your .env file or in your deployment environment');
}

// Log environment variables (safely)
console.log('Environment variables loaded:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- Has ALCHEMY_API_KEY:', process.env.ALCHEMY_API_KEY ? 
  `Yes (${process.env.ALCHEMY_API_KEY.slice(0, 4)}...${process.env.ALCHEMY_API_KEY.slice(-4)})` : 
  'NO - APPLICATION WILL FAIL');

// Minimal server.js file for development
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const { parse } = require('url');
const fs = require('fs');
const compression = require('compression');
const { createProxyMiddleware } = require('http-proxy-middleware');
const apiRoutes = require('./api/index.js'); // Import API routes from api/index.js
const net = require('net');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(compression());
app.use(express.json());

// Configure CORS - more permissive for development
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// API Routes
const apiRouter = express.Router();

// Health check endpoint
apiRouter.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', version: '1.0.0' });
});

// Database status endpoint (simplified)
apiRouter.get('/db-status', (req, res) => {
  res.status(200).json({ 
    status: 'Database check bypassed for testing',
    message: 'Database connection disabled during core functionality testing'
  });
});

// Create a CORS middleware function for consistent application
const corsMiddleware = (req, res, next) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
};

// Apply CORS middleware to all API routes
apiRouter.use(corsMiddleware);

// ZAPPER API - Used only for Farcaster profile data and connected wallets
apiRouter.post('/zapper', async (req, res) => {
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
      errors: [{
        message: 'The Zapper endpoint is only for Farcaster profile requests',
        extensions: {
          error: 'Invalid request'
        }
      }]
    });
  }

  // Zapper GraphQL API URL
  const ZAPPER_API_URL = 'https://public.zapper.xyz/graphql';
  
  try {
    // Get Zapper API key from environment variables
    const apiKey = process.env.ZAPPER_API_KEY || '';
    
    if (!apiKey) {
      console.warn('⚠️ No ZAPPER_API_KEY found in environment variables!');
      return res.status(500).json({
        errors: [{
          message: 'Zapper API key is missing. Please check server configuration.',
          extensions: {
            error: 'API Configuration Error'
          }
        }]
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
    return res.status(error.response?.status || 502).json({
      errors: [{
        message: error.message || 'Error from Zapper API',
        extensions: {
          details: error.response?.data
        }
      }]
    });
  }
});

// FARCASTER PROFILE API - Dedicated endpoint for Farcaster profile data
apiRouter.all('/farcaster-profile', async (req, res) => {
  // If it's not a GET or OPTIONS request, return method not allowed
  if (req.method !== 'GET' && req.method !== 'OPTIONS') {
    return res.status(405).json({ 
      errors: [{ 
        message: 'Method not allowed. Use GET request.', 
        extensions: { error: 'Method Not Allowed' } 
      }]
    });
  }
  
  // Handle OPTIONS separately (though our middleware should catch this)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Zapper GraphQL API URL
  const ZAPPER_API_URL = 'https://public.zapper.xyz/graphql';

  try {
    // Get Zapper API key from environment variables
    const apiKey = process.env.ZAPPER_API_KEY || '';
    
    if (!apiKey) {
      console.warn('⚠️ No ZAPPER_API_KEY found in environment variables!');
      return res.status(500).json({
        errors: [{
          message: 'Zapper API key is missing. Please check server configuration.',
          extensions: {
            error: 'API Configuration Error'
          }
        }]
      });
    }

    // Get username or FID from query parameters
    const { username, fid } = req.query;
    
    if (!username && !fid) {
      return res.status(400).json({
        errors: [{
          message: 'Either username or fid parameter is required',
          extensions: {
            error: 'Invalid Request'
          }
        }]
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
    
    // Print API key for debugging (first 4 chars)
    if (apiKey) {
      console.log(`Using API key: ${apiKey.substring(0, 4)}...`);
    }

    console.log(`Sending request to ${ZAPPER_API_URL} with variables:`, variables);
    
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
    
    // Log successful response for debugging
    console.log(`Received response with status ${response.status}`);
    
    // Check for GraphQL errors
    if (response.data?.errors) {
      console.log('GraphQL errors received:', JSON.stringify(response.data.errors));
      return res.status(400).json({
        errors: [{
          message: response.data.errors[0]?.message || 'Unknown GraphQL error',
          extensions: {
            details: response.data.errors
          }
        }]
      });
    }
    
    // Return the profile data
    if (response.data?.data?.farcasterProfile) {
      console.log('Profile found:', JSON.stringify(response.data.data.farcasterProfile, null, 2));
      return res.status(200).json(response.data.data.farcasterProfile);
    } else {
      console.log('No profile found in response:', JSON.stringify(response.data));
      return res.status(404).json({
        errors: [{
          message: `No Farcaster profile found for ${username || fid}`,
          extensions: {
            error: 'Profile Not Found'
          }
        }]
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
      errors: [{
        message: error.message || 'Error fetching Farcaster profile',
        extensions: {
          details: error.response?.data
        }
      }]
    });
  }
});

// ALCHEMY API - Used for all NFT data
/*
apiRouter.all('/alchemy', async (req, res) => {
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
  
  // Improved validation with helpful error message
  if (!ALCHEMY_API_KEY || ALCHEMY_API_KEY === 'demo') {
    console.error('Alchemy API key not configured or using demo key');
    return res.status(401).json({ 
      error: 'API key not properly configured',
      message: 'Please set a valid ALCHEMY_API_KEY in environment variables. "demo" is not a valid API key.'
    });
  }
  
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
    getNFTsForCollection: (apiKey, chain = 'eth') => {
      const baseUrl = chain === 'eth' 
        ? 'https://eth-mainnet.g.alchemy.com/nft/v3/' 
        : `https://${chain}-mainnet.g.alchemy.com/nft/v3/`;
      return `${baseUrl}${apiKey}/getNFTsForCollection`;
    }
  };
  
  // Parse query parameters
  const { query } = parse(req.url, true);
  const { endpoint = 'getNFTsForOwner', chain = 'eth', ...params } = query;
  
  // Validate endpoint
  if (!ENDPOINTS[endpoint]) {
    return res.status(400).json({ error: `Invalid endpoint: ${endpoint}` });
  }
  
  try {
    // Build the request URL
    const endpointUrl = ENDPOINTS[endpoint](ALCHEMY_API_KEY, chain);
    
    // Prepare request parameters
    const requestParams = { ...params };
    
    // Enhanced handling for getNFTsForOwner with better defaults
    if (endpoint === 'getNFTsForOwner') {
      // Make sure all vital parameters are explicitly set for better results
      requestParams.withMetadata = true;
      requestParams.pageSize = Math.min(parseInt(requestParams.pageSize || '50', 10), 50); // Limit to 50 max
      requestParams.tokenUriTimeoutInMs = 5000;
      requestParams.includeContract = true;
      
      // Convert excludeFilters from string to array if needed
      if (requestParams.excludeSpam === 'true') {
        requestParams.excludeFilters = ['SPAM'];
      } else {
        // Make sure excludeFilters is an array, not a string
        requestParams.excludeFilters = Array.isArray(requestParams.excludeFilters) 
          ? requestParams.excludeFilters 
          : (requestParams.excludeFilters ? [requestParams.excludeFilters] : []);
      }
      
      // Make sure boolean parameters are correctly set
      const boolParams = ['withMetadata', 'includeContract', 'includePrice', 'floorPrice'];
      boolParams.forEach(param => {
        if (param in requestParams) {
          requestParams[param] = requestParams[param] === 'true';
        }
      });
      
      console.log(`Enhanced getNFTsForOwner parameters:`, requestParams);
    }
    
    // Regular GET request with timeout
    console.log(`GET request to ${endpointUrl}`);
    
    // Add timeout to prevent hanging
    const response = await axios.get(endpointUrl, { 
      params: requestParams,
      timeout: 10000 // 10 second timeout
    });
    
    // Return the response
    return res.status(200).json(response.data);
  } catch (error) {
    // Improved error handling
    console.error('Alchemy API error:', error.message);
    
    let statusCode = error.response?.status || 500;
    let errorMessage = error.message || 'Unknown error';
    
    // Provide more helpful error messages based on common issues
    if (error.code === 'ECONNABORTED') {
      statusCode = 504;
      errorMessage = 'Request to Alchemy API timed out. Try with a smaller page size.';
    } else if (statusCode === 429) {
      errorMessage = 'Rate limit exceeded. Please use a real Alchemy API key.';
    } else if (statusCode === 401) {
      errorMessage = 'Invalid Alchemy API key. Make sure your API key is correctly set.';
    } else if (statusCode >= 500) {
      errorMessage = 'Alchemy API server error. Please try again later.';
    }
    
    return res.status(statusCode).json({
      error: 'Error from Alchemy API',
      message: errorMessage,
      details: error.response?.data
    });
  }
});
*/

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
    
    // Handle Alchemy CDN URLs specifically - this needs special attention
    if (proxyUrl.includes('nft-cdn.alchemy.com')) {
      console.log('Detected Alchemy CDN URL, adding special headers and API key');
      
      // Add Alchemy API key to the URL if not already present
      if (!proxyUrl.includes('apiKey=')) {
        const alchemyApiKey = process.env.ALCHEMY_API_KEY || process.env.REACT_APP_ALCHEMY_API_KEY;
        if (alchemyApiKey) {
          const separator = proxyUrl.includes('?') ? '&' : '?';
          proxyUrl = `${proxyUrl}${separator}apiKey=${alchemyApiKey}`;
          console.log('Added API key to Alchemy URL');
        }
      }
      
      // Use specific headers for Alchemy CDN that worked in testing
      customHeaders = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Origin': 'https://dashboard.alchemy.com',
        'Referer': 'https://dashboard.alchemy.com/',
        'Sec-Fetch-Dest': 'image',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'same-site',
        'If-None-Match': '', // Clear any conditional requests
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      };
      
      // For some Alchemy CDN URLs, we might need to fix the path format
      if (!proxyUrl.includes('/original') && !proxyUrl.includes('/thumb') && !proxyUrl.includes('.jpg') && !proxyUrl.includes('.png')) {
        proxyUrl = `${proxyUrl}/original`;
        console.log(`Fixed Alchemy URL format: ${proxyUrl}`);
      }
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
    
    // Handle HTTP URLs - ensure they are HTTPS
    if (proxyUrl.startsWith('http://')) {
      proxyUrl = proxyUrl.replace('http://', 'https://');
      console.log(`Converted HTTP to HTTPS: ${url} -> ${proxyUrl}`);
    }
    
    // Handle api.zora.co renderer URLs that include ipfs content
    if (proxyUrl.includes('api.zora.co') && proxyUrl.includes('ipfs')) {
      // Try to extract the ipfs hash from various formats
      let ipfsHash = null;
      
      // Common patterns seen in the Zora URLs
      const ipfsPatterns = [
        /ipfs(?:%3a|:)%2f%2f([a-zA-Z0-9]+)/i, // URL encoded ipfs://hash
        /ipfs:\/\/([a-zA-Z0-9]+)/i,           // Direct ipfs://hash
        /ipfs\/([a-zA-Z0-9]+)/i               // /ipfs/hash format
      ];
      
      // Try each pattern
      for (const pattern of ipfsPatterns) {
        const match = proxyUrl.match(pattern);
        if (match && match[1]) {
          ipfsHash = match[1];
          console.log(`Extracted IPFS hash ${ipfsHash} from Zora URL`);
          break;
        }
      }
      
      // If we found a hash, use a more reliable IPFS gateway
      if (ipfsHash) {
        proxyUrl = `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`;
        console.log(`Using alternative IPFS gateway: ${proxyUrl}`);
      }
    }
    
    console.log(`Fetching image: ${proxyUrl}`);
    
    // Function to attempt image fetch with retries
    const fetchWithRetries = async (url, headers, maxRetries = 2) => {
      let lastError;
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const response = await axios({
            method: 'get',
            url: url,
            responseType: 'arraybuffer',
            timeout: 10000,
            headers: headers,
            validateStatus: false // Allow non-200 status codes to process them below
          });
          
          // If we got a successful response, return it
          if (response.status < 400) {
            return response;
          }
          
          // If we got a 403 Forbidden specifically from Alchemy CDN
          if (response.status === 403 && url.includes('nft-cdn.alchemy.com')) {
            console.log(`Attempt ${attempt + 1}: Got 403 from Alchemy CDN, trying with different headers`);
            
            // Modify headers for next attempt
            headers = {
              ...headers,
              'Referer': 'https://dashboard.alchemy.com/',
              'Origin': 'https://dashboard.alchemy.com'
            };
            
            // Add API key directly to URL as a different parameter format
            if (!url.includes('api_key=') && !url.includes('apiKey=')) {
              const alchemyApiKey = process.env.ALCHEMY_API_KEY || process.env.REACT_APP_ALCHEMY_API_KEY;
              if (alchemyApiKey) {
                const separator = url.includes('?') ? '&' : '?';
                url = `${url}${separator}api_key=${alchemyApiKey}`;
                console.log('Added API key in alternate format');
              }
            }
            
            // Wait briefly before retry
            await new Promise(resolve => setTimeout(resolve, 500));
            continue;
          }
          
          // For other error status codes, log and continue to next attempt
          console.error(`Attempt ${attempt + 1}: Error status ${response.status} for: ${url}`);
          lastError = new Error(`HTTP ${response.status}`);
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`Attempt ${attempt + 1}: Network error fetching from ${url}:`, error.message);
          lastError = error;
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // If we got here, all attempts failed
      throw lastError || new Error('All retry attempts failed');
    };
    
    // Attempt to proxy the image with retries
    let response;
    try {
      response = await fetchWithRetries(proxyUrl, customHeaders);
    } catch (error) {
      console.error(`All attempts failed for ${proxyUrl}:`, error.message);
      
      // Create a simple SVG placeholder instead of returning JSON
      const placeholderSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
        <rect width="200" height="200" fill="#f0f0f0"/>
        <text x="50%" y="50%" font-family="Arial" font-size="12" text-anchor="middle" fill="#888">Image unavailable</text>
      </svg>`);
      
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, max-age=3600'); 
      return res.send(placeholderSvg);
    }
    
    // Check for non-successful status after all retries
    if (!response || response.status >= 400) {
      console.error(`Source returned error status ${response?.status || 'unknown'} for: ${proxyUrl}`);
      
      // Create a simple SVG placeholder instead of returning JSON
      const placeholderSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
        <rect width="200" height="200" fill="#f0f0f0"/>
        <text x="50%" y="50%" font-family="Arial" font-size="12" text-anchor="middle" fill="#888">Image unavailable</text>
      </svg>`);
      
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, max-age=3600'); 
      return res.send(placeholderSvg);
    }
    
    // Set content type from response
    const contentType = response.headers['content-type'];
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    } else {
      // Try to guess content type from URL
      if (proxyUrl.match(/\.(jpg|jpeg)$/i)) res.setHeader('Content-Type', 'image/jpeg');
      else if (proxyUrl.match(/\.png$/i)) res.setHeader('Content-Type', 'image/png');
      else if (proxyUrl.match(/\.gif$/i)) res.setHeader('Content-Type', 'image/gif');
      else if (proxyUrl.match(/\.svg$/i)) res.setHeader('Content-Type', 'image/svg+xml');
      else res.setHeader('Content-Type', 'application/octet-stream');
    }
    
    // Set cache headers for better performance
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    
    // Return the image data
    return res.send(response.data);
  } catch (error) {
    console.error(`Error proxying image (${url}):`, error.message);
    
    // Return a placeholder SVG image instead of JSON
    const placeholderSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
      <rect width="200" height="200" fill="#f0f0f0"/>
      <text x="50%" y="50%" font-family="Arial" font-size="12" text-anchor="middle" fill="#888">Image unavailable</text>
    </svg>`);
    
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=3600'); 
    return res.send(placeholderSvg);
  }
});

// Add diagnostic route to test Alchemy NFT image loading
app.get('/test-nft-image', async (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  
  let output = '<html><head><title>NFT Image Test</title></head><body style="font-family: monospace; white-space: pre-wrap;">';
  output += '<h1>NFT Image Loading Diagnostic Tool</h1>';
  
  try {
    // Check environment variables
    const alchemyApiKey = process.env.ALCHEMY_API_KEY || process.env.REACT_APP_ALCHEMY_API_KEY;
    output += `<p>Alchemy API Key: ${alchemyApiKey ? alchemyApiKey.substring(0, 4) + '...' : 'Not found'}</p>`;
    
    // Test contract and token for a known NFT
    const testContract = req.query.contract || '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d'; // BAYC by default
    const testTokenId = req.query.tokenId || '1'; // Token ID 1 by default
    
    output += `<p>Testing with contract: ${testContract}, tokenId: ${testTokenId}</p>`;
    
    // Construct the Alchemy API URL
    const apiUrl = `https://eth-mainnet.g.alchemy.com/nft/v3/${alchemyApiKey}/getNFTMetadata?contractAddress=${testContract}&tokenId=${testTokenId}`;
    
    output += `<p>Fetching NFT metadata from Alchemy...</p>`;
    
    // Make the request to get NFT metadata
    const response = await axios.get(apiUrl);
    
    // Extract image URL from the response
    let imageUrl = null;
    let gatewayUrl = null;
    
    if (response.data && response.data.media && response.data.media.length > 0) {
      gatewayUrl = response.data.media[0].gateway;
      const rawUrl = response.data.media[0].raw;
      
      output += `<p>Media found in response:</p>`;
      output += `<p>Gateway URL: ${gatewayUrl || 'Not found'}</p>`;
      output += `<p>Raw URL: ${rawUrl || 'Not found'}</p>`;
      
      imageUrl = gatewayUrl || rawUrl;
    } else if (response.data && response.data.metadata && response.data.metadata.image) {
      imageUrl = response.data.metadata.image;
      output += `<p>Image URL found in metadata: ${imageUrl}</p>`;
    } else {
      output += `<p style="color:red">No image URL found in the NFT metadata</p>`;
      output += `<p>Raw response data: ${JSON.stringify(response.data, null, 2)}</p>`;
    }
    
    // If we have an image URL, try to fetch it directly and through our proxy
    if (imageUrl) {
      output += `<h2>Testing Image Loading</h2>`;
      
      // Test the image directly with custom headers
      const directHeaders = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Origin': 'https://dashboard.alchemy.com',
        'Referer': 'https://dashboard.alchemy.com/',
      };
      
      // First, test direct image loading
      try {
        output += `<p>Testing direct image loading from: ${imageUrl}</p>`;
        const directResponse = await axios({
          method: 'get',
          url: imageUrl,
          responseType: 'arraybuffer',
          timeout: 10000,
          headers: directHeaders,
          validateStatus: false
        });
        
        output += `<p>Direct image loading status: ${directResponse.status}</p>`;
        output += `<p>Content-Type: ${directResponse.headers['content-type'] || 'Not specified'}</p>`;
        
        if (directResponse.status >= 400) {
          output += `<p style="color:red">Direct image loading failed with status ${directResponse.status}</p>`;
        } else {
          output += `<p style="color:green">Successfully loaded image directly!</p>`;
          const base64Image = Buffer.from(directResponse.data).toString('base64');
          const contentType = directResponse.headers['content-type'] || 'image/jpeg';
          output += `<p>Direct image preview:</p><img src="data:${contentType};base64,${base64Image}" style="max-width:300px; border:1px solid #ccc;" />`;
        }
      } catch (directError) {
        output += `<p style="color:red">Error loading image directly: ${directError.message}</p>`;
      }
      
      // Then, test loading through our proxy
      try {
        const proxyUrl = `http://localhost:${PORT}/image-proxy?url=${encodeURIComponent(imageUrl)}`;
        output += `<p>Testing image loading through proxy: ${proxyUrl}</p>`;
        
        const proxyResponse = await axios({
          method: 'get',
          url: proxyUrl,
          responseType: 'arraybuffer',
          timeout: 10000,
          validateStatus: false
        });
        
        output += `<p>Proxy image loading status: ${proxyResponse.status}</p>`;
        output += `<p>Content-Type: ${proxyResponse.headers['content-type'] || 'Not specified'}</p>`;
        
        if (proxyResponse.status >= 400) {
          output += `<p style="color:red">Proxy image loading failed with status ${proxyResponse.status}</p>`;
        } else {
          output += `<p style="color:green">Successfully loaded image through proxy!</p>`;
          const base64Image = Buffer.from(proxyResponse.data).toString('base64');
          const contentType = proxyResponse.headers['content-type'] || 'image/jpeg';
          output += `<p>Proxy image preview:</p><img src="data:${contentType};base64,${base64Image}" style="max-width:300px; border:1px solid #ccc;" />`;
        }
      } catch (proxyError) {
        output += `<p style="color:red">Error loading image through proxy: ${proxyError.message}</p>`;
      }
      
      // Show an IMG tag that uses our proxy directly - this will show how the browser loads it
      const browserProxyUrl = `/image-proxy?url=${encodeURIComponent(imageUrl)}`;
      output += `<p>Browser loading through proxy:</p>`;
      output += `<img src="${browserProxyUrl}" style="max-width:300px; border:1px solid #333;" onerror="this.onerror=null; this.src='/assets/placeholder-nft.svg'; this.style.border='1px solid red';" />`;
    }
    
  } catch (error) {
    output += `<p style="color:red">Error during testing: ${error.message}</p>`;
    output += `<pre>${error.stack}</pre>`;
  }
  
  output += '</body></html>';
  res.send(output);
});

// Mount API routes
app.use('/api', apiRouter);

// Mount API routes from the imported module (replaces the apiRouter)
app.use('/api', apiRoutes);

// Serve static files from the public directory with appropriate headers
app.use('/assets', express.static(path.join(__dirname, 'public', 'assets'), {
  maxAge: '1d',
  setHeaders: (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
  }
}));

// Serve static files from the public directory (for both development and production)
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d',
  setHeaders: (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
  }
}));

// Serve static files from the build directory in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'build'), {
    maxAge: '1d',
    setHeaders: (res) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  }));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
  });
} else {
  // In development, allow React's dev server to handle routes
  // But serve our static assets from public directory
  console.log('Running in development mode - serving static assets from /public');
}

// Function to find an available port
const findAvailablePort = (startPort, maxTries = 10) => {
  return new Promise((resolve, reject) => {
    let currentPort = startPort;
    let tries = 0;
    
    const tryPort = (port) => {
      tries++;
      if (tries > maxTries) {
        return reject(new Error(`Could not find an available port after ${maxTries} attempts`));
      }
      
      const tester = net.createServer()
        .once('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            console.log(`Port ${port} is in use, trying ${port + 1}`);
            tryPort(port + 1);
          } else {
            reject(err);
          }
        })
        .once('listening', () => {
          tester.once('close', () => resolve(port))
            .close();
        })
        .listen(port);
    };
    
    tryPort(currentPort);
  });
};

// Start the server with port conflict handling
const startServer = async () => {
  try {
    const availablePort = await findAvailablePort(PORT);
    
    // Create HTTP server and listen on the available port
    const server = app.listen(availablePort, () => {
      console.log(`Server running on port ${availablePort}`);
      console.log(`API base URL: http://localhost:${availablePort}/api`);
      
      // Add development mode indicator
      if (process.env.NODE_ENV !== 'production') {
        console.log('Running in development mode - serving static assets from /public');
      }
    });
    
    // Handle graceful shutdown
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });
    
    process.on('SIGINT', () => {
      console.log('SIGINT received, shutting down gracefully');
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });
    
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
};

// Replace the original app.listen call with this line:
startServer();

// Handle uncaught exceptions and unhandled promise rejections
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  
  // Don't exit on port already in use error - let the script handle it
  if (err.code === 'EADDRINUSE') {
    console.error(`⚠️ Port ${PORT} is already in use`);
    console.error('Please stop any other instances of the server or use a different port');
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't crash the application, but log the error
}); 