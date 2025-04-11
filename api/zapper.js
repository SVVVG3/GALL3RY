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
    let { query, variables } = requestBody;

    if (!query) {
      return res.status(400).json({ error: 'Missing GraphQL query' });
    }

    // Debug log for query analysis
    const originalQuery = query;
    const queryType = 
      query.includes('farcasterProfile') ? 'FARCASTER_PROFILE' :
      query.includes('nfts(') ? 'NFTS_QUERY_NEW' :
      query.includes('nftUsersTokens') ? 'NFTS_QUERY_OLD' : 
      'UNKNOWN_QUERY';

    console.log(`[ZAPPER PROXY] Request type: ${queryType}`);
    console.log(`[ZAPPER PROXY] Variables: ${JSON.stringify(variables, (key, value) => {
      // Mask sensitive data like addresses
      if (key === 'addresses' || key === 'owners' || key === 'ownerAddresses') {
        if (Array.isArray(value)) {
          return value.map(addr => typeof addr === 'string' ? 
            addr.substring(0, 6) + '...' + addr.substring(addr.length - 4) : 
            'invalid-address');
        }
      }
      return value;
    })}`);

    // Fix for outdated queries - update to latest schema
    if (queryType === 'NFTS_QUERY_OLD') {
      // The old nftUsersTokens query is no longer supported
      // Transform it to use the new nfts query format
      console.log('[ZAPPER PROXY] Transforming deprecated nftUsersTokens query to new nfts query format');
      
      // Extract owner addresses from variables
      const ownerAddresses = variables.owners || [];
      const limit = variables.first || 50;
      
      // Create new query compatible with current schema
      query = `
        query NFTs($addresses: [String!]!, $limit: Int) {
          nfts(
            ownerAddresses: $addresses,
            limit: $limit
          ) {
            items {
              id
              tokenId
              name
              collection {
                id
                name
                floorPrice {
                  value
                  symbol
                }
                imageUrl
              }
              token {
                id
                tokenId
                name
                symbol
                contractAddress
                networkId
              }
              estimatedValue {
                value
                token {
                  symbol
                }
              }
              imageUrl
              metadata {
                name
                description
                image
              }
            }
          }
        }
      `;
      
      // Update variables to match new query
      variables = {
        addresses: ownerAddresses,
        limit: limit
      };
      
      console.log('[ZAPPER PROXY] Query transformed');
    }

    // Generate cache key based on the final query and variables
    const cacheKey = `zapper_${Buffer.from(JSON.stringify({ query, variables })).toString('base64')}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      console.log('[ZAPPER PROXY] Cache hit');
      return res.status(200).json(cachedData);
    }

    // Forward to Zapper API with retry mechanism
    let attempts = 0;
    const maxAttempts = 3;
    let lastError = null;
    
    while (attempts < maxAttempts) {
      try {
        console.log(`[ZAPPER PROXY] Attempt ${attempts + 1} to call Zapper API`);
        
        // Set up request
        const zapperResponse = await axios({
          url: 'https://public.zapper.xyz/graphql',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-zapper-api-key': apiKey,
            'User-Agent': 'gall3ry/2.0',
            'Accept': 'application/json'
          },
          data: { query, variables },
          timeout: 15000 // Increased timeout
        });

        // If there are GraphQL errors, log them and return
        if (zapperResponse.data.errors) {
          console.error('[ZAPPER PROXY] GraphQL errors:', JSON.stringify(zapperResponse.data.errors));
          
          // Try to provide more helpful error messages
          const errorMessages = zapperResponse.data.errors.map(err => {
            if (err.message.includes('nftUsersTokens')) {
              return "The nftUsersTokens query is deprecated. Please update to use the nfts query.";
            }
            return err.message;
          });
          
          return res.status(400).json({
            error: 'GraphQL errors',
            errors: zapperResponse.data.errors,
            helpfulMessage: errorMessages.join(' '),
            originalQuery: queryType
          });
        }

        // Check if the response data has expected structure
        if (queryType === 'NFTS_QUERY_NEW' && !zapperResponse.data.data?.nfts?.items) {
          console.warn('[ZAPPER PROXY] Unexpected response structure:', JSON.stringify(zapperResponse.data).substring(0, 200) + '...');
        }
        
        if (queryType === 'FARCASTER_PROFILE' && !zapperResponse.data.data?.farcasterProfile) {
          console.warn('[ZAPPER PROXY] Farcaster profile response missing expected data');
        }

        // Cache successful response (with shorter TTL for large responses)
        const responseSize = JSON.stringify(zapperResponse.data).length;
        const cacheTTL = responseSize > 1000000 ? 60 : 300; // 1 minute for large responses, 5 minutes for smaller ones
        cache.set(cacheKey, zapperResponse.data, cacheTTL);
        
        console.log(`[ZAPPER PROXY] API request successful, response size: ${(responseSize / 1024).toFixed(2)} KB`);
        return res.status(200).json(zapperResponse.data);
      } catch (error) {
        attempts++;
        lastError = error;
        
        console.error(`[ZAPPER PROXY] Attempt ${attempts} failed:`, error.message);
        
        if (attempts < maxAttempts) {
          // Exponential backoff
          const backoffTime = 1000 * Math.pow(2, attempts - 1);
          console.log(`[ZAPPER PROXY] Retrying in ${backoffTime}ms...`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
      }
    }
    
    // If we get here, all attempts failed
    console.error('[ZAPPER PROXY] All API attempts failed:', lastError?.message || 'Unknown error');
    console.error('[ZAPPER PROXY] Original query type:', queryType);
    
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
        message: 'The request timed out. The service might be experiencing high load.'
      });
    }
    
    return res.status(502).json({
      error: 'API error',
      message: lastError?.message || 'Unknown error occurred when calling Zapper API',
      originalQueryType: queryType
    });
  } catch (error) {
    console.error('[ZAPPER PROXY] Server error:', error.message);
    return res.status(500).json({
      error: 'Server error',
      message: error.message
    });
  }
};

module.exports = handler; 