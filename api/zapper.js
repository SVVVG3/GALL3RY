const axios = require('axios');
const { corsHeaders, cache } = require('./_utils');

/**
 * Proxy API handler for Zapper API GraphQL requests
 * This helps solve CORS issues and protect API keys
 */
const handler = async (req, res) => {
  // Set CORS headers for all responses
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Handle OPTIONS requests (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get API key from environment variables
    const apiKey = process.env.ZAPPER_API_KEY;
    if (!apiKey) {
      console.error('[ZAPPER] Missing API key');
      return res.status(500).json({ 
        error: 'Configuration error',
        message: 'Zapper API key is missing'
      });
    }

    // Parse request body
    const requestBody = req.body || {};
    const { query, variables } = requestBody;

    if (!query) {
      return res.status(400).json({ 
        error: 'Invalid request',
        message: 'GraphQL query is required' 
      });
    }

    // Log query type for debugging
    const queryType = query.includes('farcasterProfile') ? 'PROFILE' 
      : query.includes('nfts(') ? 'NFTS' 
      : 'OTHER';
    
    console.log(`[ZAPPER] Processing ${queryType} query`);

    // Simple cache check
    const cacheKey = `zapper_${Buffer.from(JSON.stringify({ query, variables })).toString('base64')}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      console.log('[ZAPPER] Cache hit');
      return res.status(200).json(cachedData);
    }

    console.log(`[ZAPPER] Making request to Zapper API`);
    
    // Make the request to Zapper API
    try {
      const zapperResponse = await axios({
        url: 'https://public.zapper.xyz/graphql',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-zapper-api-key': apiKey,
          'Accept': 'application/json'
        },
        data: { query, variables },
        timeout: 10000
      });

      // Handle successful response
      console.log(`[ZAPPER] Request successful`);
      
      // Check for GraphQL errors
      if (zapperResponse.data.errors) {
        const errorMessages = zapperResponse.data.errors.map(e => e.message).join('; ');
        console.error(`[ZAPPER] GraphQL errors: ${errorMessages}`);
        
        return res.status(400).json({
          error: 'GraphQL errors',
          message: errorMessages,
          details: zapperResponse.data.errors
        });
      }
      
      // Cache the response
      const ttl = 300; // 5 minutes
      cache.set(cacheKey, zapperResponse.data, ttl);
      
      // Return the data
      return res.status(200).json(zapperResponse.data);
      
    } catch (apiError) {
      console.error(`[ZAPPER] API request failed: ${apiError.message}`);
      
      // Enhanced error handling with response inspection
      if (apiError.response) {
        const statusCode = apiError.response.status;
        const responseData = apiError.response.data;
        
        console.error(`[ZAPPER] Status: ${statusCode}, Data:`, responseData);
        
        return res.status(statusCode).json({
          error: 'Zapper API error',
          status: statusCode,
          message: apiError.message,
          details: responseData
        });
      }
      
      if (apiError.code === 'ECONNABORTED') {
        return res.status(504).json({
          error: 'Timeout',
          message: 'Zapper API request timed out'
        });
      }
      
      return res.status(502).json({
        error: 'API error',
        message: apiError.message
      });
    }
  } catch (error) {
    console.error(`[ZAPPER] Server error: ${error.message}`);
    return res.status(500).json({
      error: 'Server error',
      message: error.message
    });
  }
};

module.exports = handler; 