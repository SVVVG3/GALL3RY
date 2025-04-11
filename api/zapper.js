const axios = require('axios');
const { corsHeaders, cache } = require('./_utils');

/**
 * Proxy API handler for Zapper API GraphQL requests
 * This helps solve CORS issues when calling the Zapper API directly from the frontend
 * 
 * This handler is designed to work with both Express and Vercel serverless functions
 */
const handler = async (req, res) => {
  // Set CORS headers for all responses - crucial for mobile browsers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Handle OPTIONS request (preflight) - important for mobile browsers
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Only accept POST requests for GraphQL
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Get the Zapper API key from environment variables
    const apiKey = process.env.REACT_APP_ZAPPER_API_KEY || process.env.ZAPPER_API_KEY;
    if (!apiKey) {
      console.error('Zapper API key is missing from environment variables');
      return res.status(500).json({ error: 'Server configuration error: API key missing' });
    }

    // Extract the GraphQL query and variables from the request body
    // Handle both direct body (Express) and body property (Vercel)
    const requestBody = req.body || {};
    const { query, variables } = requestBody;

    if (!query) {
      console.error('Missing GraphQL query in request body');
      return res.status(400).json({ error: 'Missing GraphQL query in request body' });
    }

    // Validate query structure
    if (!query.includes('query') && !query.includes('mutation')) {
      console.error('Invalid GraphQL query structure');
      return res.status(400).json({ error: 'Invalid GraphQL query structure' });
    }

    // Validate variables if present
    if (variables) {
      if (variables.addresses && !Array.isArray(variables.addresses)) {
        console.error('Invalid addresses format in variables');
        return res.status(400).json({ error: 'Addresses must be an array' });
      }
    }

    // Log query information (abbreviated to avoid excessive logs)
    console.log('Proxying GraphQL request to Zapper API');
    
    // Generate a cache key based on the query and variables
    const cacheKey = `zapper_${Buffer.from(JSON.stringify({ query, variables })).toString('base64')}`;

    // Check cache first
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      console.log(`Cache hit for Zapper GraphQL query`);
      // Set content type header for mobile browsers
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json(cachedData);
    }

    // Forward the request to Zapper's GraphQL API with retries
    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const zapperResponse = await axios({
          url: 'https://public.zapper.xyz/graphql',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-zapper-api-key': apiKey,
            'Accept': 'application/json'
          },
          data: {
            query,
            variables
          },
          timeout: 20000 // 20 second timeout
        });

        // Check for GraphQL errors in the response
        if (zapperResponse.data.errors) {
          console.error('GraphQL errors:', zapperResponse.data.errors);
          return res.status(400).json({
            error: 'GraphQL query error',
            errors: zapperResponse.data.errors
          });
        }

        // Cache the successful response (TTL: 5 minutes)
        cache.set(cacheKey, zapperResponse.data, 300);
        
        // Set content type header for mobile browsers
        res.setHeader('Content-Type', 'application/json');
        return res.status(200).json(zapperResponse.data);
      } catch (zError) {
        lastError = zError;
        console.error(`Attempt ${attempt} failed:`, zError.message);
        
        if (attempt < maxRetries) {
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          continue;
        }
      }
    }

    // If we get here, all retries failed
    console.error('All retry attempts failed:', lastError.message);
    
    if (lastError.response) {
      return res.status(lastError.response.status).json({
        error: 'Zapper API error',
        message: lastError.message,
        details: lastError.response.data
      });
    } else {
      return res.status(500).json({
        error: 'Zapper API connection error',
        message: lastError.message
      });
    }
  } catch (error) {
    console.error('Error in Zapper API handler:', error.message);
    
    // Format response for client
    const errorResponse = {
      error: 'API handler error',
      message: error.message
    };
    
    // Set content type header for mobile browsers
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).json(errorResponse);
  }
};

module.exports = handler; 