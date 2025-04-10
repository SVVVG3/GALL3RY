const axios = require('axios');
const { corsHeaders, cache } = require('./_utils');

/**
 * Proxy API handler for Zapper API GraphQL requests
 * This helps solve CORS issues when calling the Zapper API directly from the frontend
 */
module.exports = async (req, res) => {
  // Set CORS headers for all responses
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Handle OPTIONS request (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only accept POST requests for GraphQL
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get the Zapper API key from environment variables
  const apiKey = process.env.REACT_APP_ZAPPER_API_KEY || process.env.ZAPPER_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Zapper API key is missing from environment variables' });
  }

  try {
    // Extract the GraphQL query and variables from the request body
    const { query, variables } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Missing GraphQL query in request body' });
    }

    // Generate a cache key based on the query and variables
    const cacheKey = `zapper_${Buffer.from(JSON.stringify({ query, variables })).toString('base64')}`;

    // Check cache first
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      console.log(`Cache hit for Zapper GraphQL query`);
      return res.status(200).json(cachedData);
    }

    // Forward the request to Zapper's GraphQL API
    console.log('Proxying GraphQL request to Zapper API');
    const response = await axios({
      url: 'https://api.zapper.xyz/v2/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey
      },
      data: {
        query,
        variables
      },
      timeout: 10000 // 10 second timeout
    });

    // Cache the successful response (TTL: 5 minutes)
    cache.set(cacheKey, response.data, 300);

    // Return the data from Zapper
    return res.status(200).json(response.data);
  } catch (error) {
    console.error('Error proxying to Zapper API:', error.message);
    
    // Return error details
    return res.status(error.response?.status || 500).json({
      error: 'Error proxying to Zapper API',
      message: error.message,
      details: error.response?.data || {}
    });
  }
}; 