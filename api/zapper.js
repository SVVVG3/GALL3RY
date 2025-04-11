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
    let { query, variables } = requestBody;

    if (!query) {
      return res.status(400).json({ 
        error: 'Invalid request',
        message: 'GraphQL query is required' 
      });
    }

    // Log query type for debugging
    const queryType = query.includes('farcasterProfile') ? 'PROFILE' 
      : query.includes('portfolioV2') ? 'PORTFOLIO'
      : query.includes('nfts(') ? 'NFTS_QUERY_NEW' 
      : query.includes('nftUsersTokens') ? 'NFTS_QUERY_OLD' 
      : 'OTHER';
    
    // Enhanced logging for debugging
    console.log(`[ZAPPER] Processing ${queryType} query:`, {
      queryPreview: query.substring(0, 100) + '...',
      variablesKeys: Object.keys(variables || {}),
      addresses: variables?.addresses ? `${variables.addresses.length} addresses` : 'none',
      collectionId: variables?.collectionIds ? variables.collectionIds : 'none',
      collectionAddress: variables?.collectionAddress || 'none'
    });

    // Simple cache check with a more specific key for detailed variables
    const cacheKey = `zapper_${Buffer.from(JSON.stringify({ 
      query, 
      type: queryType,
      vars: JSON.stringify(variables).substring(0, 100) 
    })).toString('base64')}`;
    
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      console.log('[ZAPPER] Cache hit');
      return res.status(200).json(cachedData);
    }

    // For debugging: log the full request being sent to Zapper
    console.log('[ZAPPER] Full request to Zapper API:', {
      query: query.substring(0, 500) + (query.length > 500 ? '...' : ''),
      variables: JSON.stringify(variables).substring(0, 500) + 
                (JSON.stringify(variables).length > 500 ? '...' : '')
    });
    
    // Make the request to Zapper API with better error handling
    try {
      const zapperResponse = await axios({
        url: 'https://public.zapper.xyz/graphql',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-zapper-api-key': apiKey,
          'Accept': 'application/json',
          'User-Agent': 'gall3ry/2.1'
        },
        data: { query, variables },
        timeout: 15000
      });

      // Handle successful response
      console.log(`[ZAPPER] Request successful, status: ${zapperResponse.status}`);
      
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
      
      // Cache the response with a shorter TTL for large responses
      const responseSize = JSON.stringify(zapperResponse.data).length;
      const ttl = responseSize > 1000000 ? 60 : 300; // 1 minute for large responses, 5 minutes for smaller ones
      cache.set(cacheKey, zapperResponse.data, ttl);
      
      return res.status(200).json(zapperResponse.data);
    } catch (error) {
      // Handle request errors with detailed information
      console.error('[ZAPPER] Zapper API request failed:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      
      // Return a detailed error response
      return res.status(error.response?.status || 500).json({
        error: 'Zapper API error',
        status: error.response?.status || 500,
        message: error.message,
        details: error.response?.data || {}
      });
    }
  } catch (error) {
    // Handle overall handler errors
    console.error('[ZAPPER] Handler error:', error);
    return res.status(500).json({
      error: 'Server error',
      message: error.message
    });
  }
};

module.exports = handler; 