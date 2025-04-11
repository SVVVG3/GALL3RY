const axios = require('axios');
const { corsHeaders, cache } = require('./_utils');

/**
 * Proxy API handler for Zapper API GraphQL requests
 * This helps solve CORS issues and protect API keys
 */
const handler = async (req, res) => {
  // Set CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Get the Zapper API key
    const apiKey = process.env.ZAPPER_API_KEY;
    if (!apiKey) {
      console.error('Zapper API key is missing');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const requestBody = req.body || {};
    const { query, variables } = requestBody;

    if (!query) {
      return res.status(400).json({ error: 'Missing GraphQL query' });
    }
    
    // Validate Farcaster profile searches based on Zapper API schema
    if (query.includes('farcasterProfile')) {
      console.log('Processing Farcaster profile search:', variables);
      
      // For the search bar, we only handle username searches
      if (variables.username) {
        // Reject empty or very short usernames (minimum 2 characters)
        if (!variables.username || variables.username.length < 2) {
          console.log(`Rejected short Farcaster username search: "${variables.username}"`);
          return res.status(400).json({ 
            errors: [{ 
              message: 'Username search must be at least 2 characters long',
              extensions: { code: 'BAD_USER_INPUT' } 
            }]
          });
        }
        
        // Reject ENS-like inputs in username search
        if (variables.username.includes('.eth')) {
          console.log(`Rejected ENS-like username: "${variables.username}"`);
          return res.status(400).json({ 
            errors: [{ 
              message: 'Cannot search for ENS names as Farcaster usernames. Use only Farcaster usernames in search.',
              extensions: { code: 'BAD_USER_INPUT' } 
            }]
          });
        }
      }
    }

    // Generate cache key
    const cacheKey = `zapper_${Buffer.from(JSON.stringify({ query, variables })).toString('base64')}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      console.log('Cache hit for Zapper query');
      return res.status(200).json(cachedData);
    }

    console.log(`Forwarding request to Zapper API with query: ${query.substring(0, 100)}...`);

    // Forward to Zapper API
    const zapperResponse = await axios({
      url: 'https://public.zapper.xyz/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-zapper-api-key': apiKey
      },
      data: { query, variables },
      timeout: 10000
    });

    if (zapperResponse.data.errors) {
      console.error('GraphQL errors from Zapper API:', zapperResponse.data.errors);
      return res.status(400).json(zapperResponse.data);
    }

    // Cache successful response
    cache.set(cacheKey, zapperResponse.data, 300);
    return res.status(200).json(zapperResponse.data);
  } catch (error) {
    console.error('Zapper API error:', error.message);
    return res.status(500).json({
      error: 'API error',
      message: error.message
    });
  }
};

module.exports = handler; 