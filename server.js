// Load environment variables from .env file
require('dotenv').config();

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

// Proxy endpoint for CORS-protected images
apiRouter.get('/image-proxy', async (req, res) => {
  const { url } = req.query;
  
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }
  
  try {
    let proxyUrl = url;
    
    // Special handling for IPFS URLs
    if (url.includes('ipfs') || url.includes('ipfs:')) {
      console.log('Detected potential IPFS URL in proxy request:', url);
      
      // Handle api.zora.co renderer URLs that include ipfs content
      if (url.includes('api.zora.co') && url.includes('ipfs')) {
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
          const match = url.match(pattern);
          if (match && match[1]) {
            ipfsHash = match[1];
            console.log(`Extracted IPFS hash ${ipfsHash} from Zora URL`);
            break;
          }
        }
        
        // If we found a hash, use a more reliable IPFS gateway
        if (ipfsHash) {
          // Try multiple gateways in order of reliability
          const gateways = [
            `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`,
            `https://ipfs.io/ipfs/${ipfsHash}`,
            `https://gateway.pinata.cloud/ipfs/${ipfsHash}`
          ];
          
          // Use the first gateway in the list
          proxyUrl = gateways[0];
          console.log(`Using alternative IPFS gateway: ${proxyUrl}`);
        }
      }
      // Direct IPFS URLs without gateway
      else if (url.startsWith('ipfs://')) {
        const ipfsHash = url.replace('ipfs://', '');
        proxyUrl = `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`;
        console.log(`Converted direct IPFS URL to gateway URL: ${proxyUrl}`);
      }
    }
    
    // Attempt to proxy the image
    const response = await axios({
      method: 'get',
      url: proxyUrl,
      responseType: 'stream',
      timeout: 5000,
      headers: {
        'Referer': 'https://gall3ry.vercel.app/',
        'User-Agent': 'Mozilla/5.0 (compatible; GALL3RY/1.0)'
      }
    });
    
    // Forward content type
    if (response.headers['content-type']) {
      res.setHeader('Content-Type', response.headers['content-type']);
    }
    
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Set cache headers
    res.setHeader('Cache-Control', 'public, max-age=86400');
    
    // Pipe the image data to the response
    response.data.pipe(res);
  } catch (error) {
    console.error(`Error proxying image ${url}:`, error.message);
    return res.status(404).sendFile(path.join(__dirname, 'public', 'assets', 'placeholder-nft.svg'));
  }
});

// Image proxy endpoint to handle CORS issues with NFT images
app.get('/api/image-proxy', async (req, res) => {
  const imageUrl = req.query.url;
  
  if (!imageUrl) {
    return res.status(400).send('Missing url parameter');
  }
  
  try {
    // Fetch the image with proper headers
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://gall3ry.xyz/'
      },
      timeout: 5000, // 5 second timeout to avoid hanging
      validateStatus: false // Accept any response
    });
    
    // Determine content type based on response headers or URL extension
    let contentType = response.headers['content-type'];
    
    if (!contentType) {
      // Try to guess content type from URL
      if (imageUrl.match(/\.(jpg|jpeg)$/i)) contentType = 'image/jpeg';
      else if (imageUrl.match(/\.png$/i)) contentType = 'image/png';
      else if (imageUrl.match(/\.gif$/i)) contentType = 'image/gif';
      else if (imageUrl.match(/\.svg$/i)) contentType = 'image/svg+xml';
      else if (imageUrl.match(/\.webp$/i)) contentType = 'image/webp';
      else if (imageUrl.match(/\.mp4$/i)) contentType = 'video/mp4';
      else if (imageUrl.match(/\.webm$/i)) contentType = 'video/webm';
      else contentType = 'application/octet-stream';
    }
    
    // Set appropriate cache headers
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    res.setHeader('Content-Type', contentType);
    
    // If response was not successful, return placeholder
    if (response.status >= 400) {
      const placeholder = fs.readFileSync(path.join(__dirname, 'public', 'assets', 'placeholder-nft.svg'));
      res.setHeader('Content-Type', 'image/svg+xml');
      return res.send(placeholder);
    }
    
    return res.send(response.data);
  } catch (error) {
    console.error('Image proxy error:', error.message);
    
    // Return placeholder image on error
    try {
      const placeholder = fs.readFileSync(path.join(__dirname, 'public', 'assets', 'placeholder-nft.svg'));
      res.setHeader('Content-Type', 'image/svg+xml');
      return res.send(placeholder);
    } catch (readError) {
      return res.status(500).send('Error loading image and placeholder');
    }
  }
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

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API base URL: http://localhost:${PORT}/api`);
});

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

// Debugging environment variables
console.log('Environment variables loaded:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- Has ALCHEMY_API_KEY:', !!process.env.ALCHEMY_API_KEY); 