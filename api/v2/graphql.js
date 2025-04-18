// Direct GraphQL endpoint to match the client's expectations
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
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

  try {
    console.log('Received direct request to /v2/graphql');
    
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
      headers['x-zapper-api-key'] = apiKey;
    }
    
    // Log request details
    console.log('Request body length:', JSON.stringify(req.body || {}).length);
    
    // Make request to Zapper API
    const response = await fetch('https://public.zapper.xyz/graphql', {
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
        errors: [{
          message: 'Invalid JSON response from API',
          extensions: {
            responsePreview: responseText.substring(0, 500) // First 500 chars for debugging
          }
        }]
      });
    }
    
    // Return response to client
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error proxying to Zapper API:', error);
    
    return res.status(500).json({
      errors: [{
        message: error.message || 'Internal server error',
        extensions: {
          details: error.response?.data || error.toString()
        }
      }]
    });
  }
}; 