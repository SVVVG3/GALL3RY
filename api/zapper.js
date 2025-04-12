// Simple Zapper API proxy
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

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
    
    console.log('Request body length:', JSON.stringify(req.body).length);
    
    // Extract the query type for logging
    let queryType = 'Unknown';
    try {
      if (req.body?.query) {
        if (req.body.query.includes('nftUsersTokens')) {
          queryType = 'NFT_USERS_TOKENS';
        } else if (req.body.query.includes('farcasterUserProfile')) {
          queryType = 'FARCASTER_PROFILE';
        }
      }
      console.log(`Query type: ${queryType}`);
    } catch (e) {
      console.error('Error parsing query type:', e);
    }
    
    // Make request to Zapper API
    const response = await fetch(ZAPPER_API_URL, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(req.body)
    });
    
    console.log(`Zapper API response status: ${response.status}`);
    
    // Get response data
    const responseText = await response.text();
    
    // Try to parse as JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (e) {
      console.error('Failed to parse response as JSON:', e);
      return res.status(500).json({
        error: 'Invalid JSON response from API',
        responsePreview: responseText.substring(0, 500) // First 500 chars for debugging
      });
    }
    
    // Check for GraphQL errors
    if (data.errors) {
      console.error('GraphQL errors:', data.errors);
    }
    
    // Return response to client
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error proxying to Zapper API:', error);
    
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'An unknown error occurred'
    });
  }
}; 