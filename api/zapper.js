const axios = require('axios');
const { corsHeaders, cache } = require('./_utils');

/**
 * Proxy API handler for Zapper API GraphQL requests
 * This helps solve CORS issues when calling the Zapper API directly from the frontend
 * 
 * This handler is designed to work with both Express and Vercel serverless functions
 */
const handler = async (req, res) => {
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
    console.error('Zapper API key is missing from environment variables');
    return res.status(500).json({ error: 'Zapper API key is missing from environment variables' });
  }

  console.log(`Using Zapper API key: ${apiKey.substring(0, 8)}...`);

  try {
    // Extract the GraphQL query and variables from the request body
    // Handle both direct body (Express) and body property (Vercel)
    const requestBody = req.body || {};
    const { query, variables } = requestBody;

    if (!query) {
      console.error('Missing GraphQL query in request body');
      return res.status(400).json({ error: 'Missing GraphQL query in request body' });
    }

    // Log query information
    console.log(`Received GraphQL query: ${query.substring(0, 100)}...`);
    console.log(`Variables: ${JSON.stringify(variables, null, 2)}`);

    // Generate a cache key based on the query and variables
    const cacheKey = `zapper_${Buffer.from(JSON.stringify({ query, variables })).toString('base64')}`;

    // Check cache first
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      console.log(`Cache hit for Zapper GraphQL query`);
      return res.status(200).json(cachedData);
    }

    // Forward the request to Zapper's GraphQL API
    console.log('Making request to Zapper API: https://public.zapper.xyz/graphql');
    const response = await axios({
      url: 'https://public.zapper.xyz/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-zapper-api-key': apiKey
      },
      data: {
        query,
        variables
      },
      timeout: 15000 // 15 second timeout
    });

    // Check for errors in response
    if (response.data?.errors) {
      console.error('GraphQL response contains errors:', JSON.stringify(response.data.errors, null, 2));
      return res.status(422).json({
        error: 'GraphQL errors in response',
        data: response.data
      });
    }

    console.log(`Received successful response from Zapper API`);
    
    // Basic validation of response structure
    if (!response.data || !response.data.data) {
      console.warn('Unexpected response structure from Zapper:', JSON.stringify(response.data, null, 2).substring(0, 500));
    } else {
      // Log keys in the data object to help debugging
      console.log('Response data keys:', Object.keys(response.data.data));
      
      // Check for NFT data if it's an NFT query
      if (query.includes('nftUsersTokens')) {
        if (response.data.data.nftUsersTokens) {
          const edges = response.data.data.nftUsersTokens.edges || [];
          console.log(`NFT query returned ${edges.length} NFTs`);
        } else {
          console.warn('NFT query did not return nftUsersTokens field');
        }
      }
    }

    // Cache the successful response (TTL: 5 minutes)
    cache.set(cacheKey, response.data, 300);

    // Return the data from Zapper
    return res.status(200).json(response.data);
  } catch (error) {
    console.error('Error proxying to Zapper API:', error.message);
    
    // Add detailed error logging
    if (error.response) {
      console.error('Error response status:', error.response.status);
      console.error('Error response headers:', error.response.headers);
      console.error('Error response data:', 
        typeof error.response.data === 'string' 
          ? error.response.data.substring(0, 500) 
          : JSON.stringify(error.response.data, null, 2).substring(0, 500)
      );
    } else if (error.request) {
      console.error('No response received from request:', error.request._currentUrl);
      console.error('Request timeout:', error.request._currentRequestTimeout);
    }
    
    // Return error details
    return res.status(error.response?.status || 500).json({
      error: 'Error proxying to Zapper API',
      message: error.message,
      details: error.response?.data || {}
    });
  }
};

module.exports = handler; 