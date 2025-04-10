const axios = require('axios');
const { corsHeaders, cache, CACHE_KEYS } = require('./_utils');

/**
 * Proxy API handler for Neynar API requests
 * This helps solve CORS issues when calling the Neynar API directly from the frontend
 */
module.exports = async (req, res) => {
  // Set CORS headers for all responses
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, api_key');

  // Handle OPTIONS request (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only accept GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get the Neynar API key from environment variables
  const apiKey = process.env.REACT_APP_NEYNAR_API_KEY || process.env.NEYNAR_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Neynar API key is missing from environment variables' });
  }

  try {
    // Parse the search parameters
    const { endpoint, q, fid, username } = req.query;

    if (!endpoint) {
      return res.status(400).json({ error: 'Missing endpoint parameter' });
    }

    // Build the correct Neynar API URL based on the requested endpoint
    let url;
    let cacheKey;

    switch (endpoint) {
      case 'search':
        if (!q) {
          return res.status(400).json({ error: 'Missing q parameter for search endpoint' });
        }
        url = `https://api.neynar.com/v2/farcaster/user/search?q=${encodeURIComponent(q)}&limit=1`;
        cacheKey = CACHE_KEYS.FARCASTER_PROFILE(q);
        break;
      
      case 'user':
        if (!fid) {
          return res.status(400).json({ error: 'Missing fid parameter for user endpoint' });
        }
        url = `https://api.neynar.com/v2/farcaster/user?fid=${fid}`;
        cacheKey = CACHE_KEYS.FARCASTER_PROFILE(fid);
        break;
      
      case 'addresses':
        if (!fid) {
          return res.status(400).json({ error: 'Missing fid parameter for addresses endpoint' });
        }
        url = `https://api.neynar.com/v2/farcaster/user/addresses?fid=${fid}`;
        cacheKey = `farcaster_addresses_${fid}`;
        break;
      
      default:
        return res.status(400).json({ error: 'Invalid endpoint specified' });
    }

    // Check cache first
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      console.log(`Cache hit for ${cacheKey}`);
      return res.status(200).json(cachedData);
    }

    // Make the request to Neynar API
    console.log(`Proxying request to Neynar API: ${url}`);
    const response = await axios.get(url, {
      headers: {
        'accept': 'application/json',
        'api_key': apiKey
      },
      timeout: 5000 // 5 second timeout
    });

    // Cache the successful response (TTL: 10 minutes)
    cache.set(cacheKey, response.data, 600);
    
    // Return the data from Neynar
    return res.status(200).json(response.data);
  } catch (error) {
    console.error('Error proxying to Neynar API:', error.message);
    
    // Return error details
    return res.status(error.response?.status || 500).json({
      error: 'Error proxying to Neynar API',
      message: error.message,
      details: error.response?.data || {}
    });
  }
}; 