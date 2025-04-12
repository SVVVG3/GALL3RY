// Simple Zapper API proxy with improved error handling
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Export function for Vercel serverless deployment
module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST requests for GraphQL
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ZAPPER_API_URL = 'https://api.zapper.xyz/v2/graphql';
  
  try {
    // Get Zapper API key from environment variables
    const apiKey = process.env.ZAPPER_API_KEY || '';
    
    // Extract query details for logging
    let queryName = 'unknown';
    let variablesSummary = {};
    let isFarcasterRequest = false;
    let username = null;
    let fid = null;
    
    try {
      if (req.body?.query) {
        // Try to extract the operation name from the query string
        const match = req.body.query.match(/query\s+([a-zA-Z0-9_]+)/);
        if (match && match[1]) {
          queryName = match[1];
        }
        
        // Check if this is a Farcaster profile request
        if (req.body.query.includes('farcasterProfile')) {
          isFarcasterRequest = true;
          
          if (req.body.variables) {
            username = req.body.variables.username;
            fid = req.body.variables.fid;
          }
          
          console.log(`Farcaster profile request for username: ${username}, fid: ${fid}`);
        }
        
        // Parse important variable keys for logging
        if (req.body.variables) {
          if (req.body.variables.ownerAddress) {
            variablesSummary.ownerAddress = `${req.body.variables.ownerAddress.substring(0, 8)}...`;
          }
          if (req.body.variables.addresses) {
            variablesSummary.addresses = req.body.variables.addresses.length + ' addresses';
          }
          if (req.body.variables.limit) {
            variablesSummary.limit = req.body.variables.limit;
          }
          if (req.body.variables.cursor) {
            variablesSummary.cursor = 'present';
          }
          if (req.body.variables.username) {
            variablesSummary.username = req.body.variables.username;
          }
          if (req.body.variables.fid) {
            variablesSummary.fid = req.body.variables.fid;
          }
        }
      }
    } catch (parseError) {
      console.error('Error parsing GraphQL query details:', parseError);
    }
    
    // Log detailed request info for debugging
    console.log('Proxying request to Zapper API:', {
      method: 'POST',
      url: ZAPPER_API_URL,
      queryName,
      variables: variablesSummary,
      bodySize: req.body ? JSON.stringify(req.body).length : 0,
      hasApiKey: !!apiKey
    });
    
    // In development, provide test data for known Farcaster users to aid debugging
    if (process.env.NODE_ENV !== 'production' && isFarcasterRequest && username === 'v') {
      console.log('Using test data for user "v" in development mode');
      return res.status(200).json({
        data: {
          farcasterProfile: {
            username: 'v',
            fid: 2,
            metadata: {
              displayName: 'Varun Srinivasan',
              description: 'Farcaster co-founder',
              imageUrl: 'https://i.imgur.com/UlMXxCQ.jpg',
              warpcast: 'https://warpcast.com/v'
            },
            custodyAddress: '0x91031dcfdea024b4d51e775486111d2b2a715871',
            connectedAddresses: ['0x91031dcfdea024b4d51e775486111d2b2a715871']
          }
        }
      });
    }
    
    if (!apiKey) {
      console.warn('⚠️ No ZAPPER_API_KEY found in environment variables!');
      return res.status(500).json({
        error: 'API Configuration Error',
        message: 'Zapper API key is missing. Please check server configuration.'
      });
    } else {
      console.log('✅ Using ZAPPER_API_KEY from environment');
    }
    
    // Parse API key format
    let formattedKey = apiKey;
    // If the key doesn't look like it's base64 encoded (no colons, not starting with 'Basic ')
    if (!apiKey.includes(':') && !apiKey.startsWith('Basic ')) {
      // Check if it's a JWT token-like structure (contains periods)
      if (apiKey.includes('.')) {
        // Leave JWT tokens as-is
        formattedKey = apiKey;
      } else {
        // Convert to base64 if it's plain text
        try {
          formattedKey = Buffer.from(apiKey).toString('base64');
        } catch (e) {
          console.error('Error encoding API key:', e);
          formattedKey = apiKey;  // Fallback to original key
        }
      }
    }
    
    // Prepare headers with correct authorization format for Zapper API
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    // Try multiple header formats to increase chances of success
    if (apiKey) {
      // Format 1: Base64 encoded with Basic prefix (standard basic auth)
      headers['Authorization'] = apiKey.startsWith('Basic ') ? apiKey : `Basic ${formattedKey}`;
      
      // Format 2: Raw API key as X headers (some APIs use this)
      headers['X-API-Key'] = apiKey;
      
      // Format 3: Zapper-specific format (if documented)
      headers['X-Zapper-API-Key'] = apiKey;
      
      console.log('Added authorization headers in multiple formats for compatibility');
      
      // Log a masked version of the key for debugging
      const masked = apiKey.substring(0, 3) + '...' + apiKey.substring(apiKey.length - 3);
      console.log(`API key (masked): ${masked}, format: ${apiKey.startsWith('Basic ') ? 'Basic auth' : 'Raw'}`);
    }
    
    // Make request to Zapper API with a timeout
    console.log(`Making request to Zapper API: ${ZAPPER_API_URL}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    try {
      // For debugging purposes, log the exact request we're making
      const requestBody = JSON.stringify(req.body);
      console.log(`Request body: ${requestBody.substring(0, 500)}${requestBody.length > 500 ? '...' : ''}`);
      
      const response = await fetch(ZAPPER_API_URL, {
        method: 'POST',
        headers: headers,
        body: requestBody,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      console.log(`Zapper API response status: ${response.status}`);
      
      // Get response data
      const responseText = await response.text();
      
      // For debugging, log a sample of the response
      console.log(`Response preview: ${responseText.substring(0, 100)}...`);
      
      // Try to parse as JSON
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse response as JSON:', e);
        // Log more of the response for debugging purposes
        console.error(`Response (first 500 chars): ${responseText.substring(0, 500)}`);
        
        return res.status(500).json({
          error: 'Invalid JSON response from API',
          responsePreview: responseText.substring(0, 500) // First 500 chars for debugging
        });
      }
      
      // Check for GraphQL errors
      if (data.errors) {
        console.error('GraphQL errors:', data.errors);
        
        // Special handling for Farcaster "not found" errors to make them more user-friendly
        if (isFarcasterRequest && data.errors.some(err => 
            err.message && (
              err.message.includes('not found') || 
              err.message.includes('No profile found')
            )
          )) {
          console.log(`Farcaster profile not found for ${username || fid}`);
          return res.status(404).json({
            error: 'Farcaster profile not found',
            message: `Could not find a Farcaster profile for ${username || fid}`
          });
        }
        
        // Forward GraphQL errors to client
        return res.status(400).json({
          errors: data.errors,
          message: data.errors[0]?.message || 'GraphQL error'
        });
      }
      
      // Special handling for Farcaster requests with empty data
      if (isFarcasterRequest && (!data.data || !data.data.farcasterProfile)) {
        console.log(`Farcaster profile data missing for ${username || fid}`);
        
        // Before returning error, check if we're using an ENS name
        if (username && username.includes('.eth')) {
          console.log('ENS name detected, adding helper message');
          return res.status(404).json({
            error: 'Farcaster profile not found',
            message: `Could not find a Farcaster profile for ${username}. Try searching without the .eth suffix.`
          });
        }
        
        return res.status(404).json({
          error: 'Farcaster profile not found',
          message: `Could not find a Farcaster profile for ${username || fid}`
        });
      }
      
      // Return response to client
      return res.status(200).json(data);
    } catch (fetchError) {
      console.error('Fetch error:', fetchError);
      
      if (fetchError.name === 'AbortError') {
        return res.status(504).json({
          error: 'Request timeout',
          message: 'The request to the Zapper API timed out'
        });
      }
      
      throw fetchError; // Re-throw for the outer catch block
    }
  } catch (error) {
    console.error('Error proxying to Zapper API:', error);
    
    // Enhanced error reporting
    const errorResponse = {
      error: 'Internal server error',
      message: error.message || 'An unknown error occurred',
      timestamp: new Date().toISOString()
    };
    
    // Add more context for debugging in logs
    if (error.name === 'AbortError') {
      console.error('Request timed out');
      errorResponse.error = 'Request timeout';
      errorResponse.message = 'The request to the Zapper API timed out';
      return res.status(504).json(errorResponse);
    }
    
    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      console.error('Connection error:', error.code);
      errorResponse.error = 'Connection error';
      errorResponse.message = 'Could not connect to the Zapper API';
      return res.status(502).json(errorResponse);
    }
    
    return res.status(500).json(errorResponse);
  }
}; 