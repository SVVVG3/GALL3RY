// Simple Zapper API proxy
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

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

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ZAPPER_API_URL = 'https://api.zapper.xyz/v2/graphql';
  
  try {
    console.log('Proxy request to Zapper API');
    
    // Get Zapper API key from environment variables
    const apiKey = process.env.ZAPPER_API_KEY || '';
    
    if (!apiKey) {
      console.warn('⚠️ No ZAPPER_API_KEY found in environment variables!');
    } else {
      console.log('✅ Using ZAPPER_API_KEY from environment');
    }
    
    // Prepare headers with API key
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    // Add API key if available
    if (apiKey) {
      headers['Authorization'] = `Basic ${apiKey}`;
    }
    
    // Log more details about the request for debugging
    let queryType = 'Unknown';
    let userInput = 'Unknown';
    let isFarcasterRequest = false;
    
    try {
      console.log('Request body length:', JSON.stringify(req.body).length);
      
      if (req.body?.query) {
        // Determine query type and extract important variables for debugging
        if (req.body.query.includes('farcasterProfile')) {
          queryType = 'FARCASTER_PROFILE';
          isFarcasterRequest = true;
          
          // Extract username or FID from variables
          if (req.body.variables) {
            if (req.body.variables.username) {
              userInput = `username:${req.body.variables.username}`;
            } else if (req.body.variables.fid) {
              userInput = `fid:${req.body.variables.fid}`;
            }
          }
        } else if (req.body.query.includes('nfts(')) {
          queryType = 'NFT_QUERY';
        } else if (req.body.query.includes('portfolioV2')) {
          queryType = 'PORTFOLIO_V2';
        }
        
        console.log(`Query type: ${queryType}, Input: ${userInput}`);
        
        // For Farcaster requests, log full variables for debugging
        if (isFarcasterRequest) {
          console.log('Farcaster request variables:', JSON.stringify(req.body.variables));
        }
      }
    } catch (e) {
      console.error('Error parsing request details:', e);
    }
    
    // Make request to Zapper API with a timeout
    console.log(`Making request to Zapper API: ${ZAPPER_API_URL}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    const response = await fetch(ZAPPER_API_URL, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(req.body),
      signal: controller.signal
    }).catch(err => {
      console.error(`Fetch error: ${err.message}`);
      throw err;
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
        console.log(`Farcaster profile not found for ${userInput}`);
        return res.status(404).json({
          error: 'Farcaster profile not found',
          message: `Could not find a Farcaster profile for ${userInput}`
        });
      }
    }
    
    // Special handling for Farcaster requests with empty data
    if (isFarcasterRequest && (!data.data || !data.data.farcasterProfile)) {
      console.log(`Farcaster profile data missing for ${userInput}`);
      
      // Before returning error, check if we're using an ENS name and try extracting without .eth
      if (userInput.includes('.eth')) {
        console.log('ENS name detected, adding helper message');
        return res.status(404).json({
          error: 'Farcaster profile not found',
          message: `Could not find a Farcaster profile for ${userInput}. Try searching without the .eth suffix.`
        });
      }
      
      return res.status(404).json({
        error: 'Farcaster profile not found',
        message: `Could not find a Farcaster profile for ${userInput}`
      });
    }
    
    // Return response to client
    return res.status(200).json(data);
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