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

    // Log for debugging (but sanitize sensitive data)
    console.log(`Received Zapper GraphQL request: 
      Query type: ${query.includes('nfts(') ? 'NFTs Query' : 
                   query.includes('farcasterProfile') ? 'Farcaster Profile Query' : 
                   'Other Query'}
      Variables: ${JSON.stringify(variables, (key, value) => {
        // Mask sensitive data like addresses
        if (key === 'addresses' && Array.isArray(value)) {
          return value.map(addr => addr.substring(0, 6) + '...' + addr.substring(addr.length - 4));
        }
        return value;
      })}`);

    // Generate cache key
    const cacheKey = `zapper_${Buffer.from(JSON.stringify({ query, variables })).toString('base64')}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      console.log('Cache hit for Zapper query');
      return res.status(200).json(cachedData);
    }

    // Forward to Zapper API with retry mechanism
    let attempts = 0;
    const maxAttempts = 3;
    let lastError = null;
    
    while (attempts < maxAttempts) {
      try {
        console.log(`Attempt ${attempts + 1} to call Zapper API`);
        
        const zapperResponse = await axios({
          url: 'https://public.zapper.xyz/graphql',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-zapper-api-key': apiKey,
            // Add additional headers that might help with reliability
            'User-Agent': 'gall3ry-app/1.0'
          },
          data: { query, variables },
          timeout: 15000 // Increased timeout
        });

        if (zapperResponse.data.errors) {
          console.error('GraphQL errors:', JSON.stringify(zapperResponse.data.errors));
          return res.status(400).json({
            error: 'GraphQL errors',
            errors: zapperResponse.data.errors
          });
        }

        // Cache successful response (with shorter TTL for large responses)
        const responseSize = JSON.stringify(zapperResponse.data).length;
        const cacheTTL = responseSize > 1000000 ? 60 : 300; // 1 minute for large responses, 5 minutes for smaller ones
        cache.set(cacheKey, zapperResponse.data, cacheTTL);
        
        console.log(`Zapper API request successful, response size: ${(responseSize / 1024).toFixed(2)} KB`);
        return res.status(200).json(zapperResponse.data);
      } catch (error) {
        attempts++;
        lastError = error;
        
        console.error(`Zapper API attempt ${attempts} failed:`, error.message);
        
        if (attempts < maxAttempts) {
          // Exponential backoff
          const backoffTime = 1000 * Math.pow(2, attempts - 1);
          console.log(`Retrying in ${backoffTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
      }
    }
    
    // If we get here, all attempts failed
    console.error('All Zapper API attempts failed:', lastError?.message || 'Unknown error');
    
    // Special handling for common error scenarios
    if (lastError?.response?.status === 429) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'The Zapper API rate limit has been reached. Please try again later.'
      });
    }
    
    if (lastError?.code === 'ECONNABORTED') {
      return res.status(504).json({
        error: 'Gateway timeout',
        message: 'The Zapper API request timed out. The service might be experiencing high load.'
      });
    }
    
    return res.status(502).json({
      error: 'API error',
      message: lastError?.message || 'Unknown error occurred when calling Zapper API'
    });
  } catch (error) {
    console.error('Zapper API proxy error:', error.message);
    return res.status(500).json({
      error: 'Server error',
      message: error.message
    });
  }
};

module.exports = handler; 