const axios = require('axios');

/**
 * Alchemy API proxy endpoint for Vercel serverless functions
 * Handles NFT API requests to Alchemy while keeping API keys secure
 */
module.exports = async (req, res) => {
  // Set proper CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Handle OPTIONS preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Validate allowed methods
  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({
      error: 'Method not allowed. Use GET or POST.',
    });
  }

  try {
    // Get the Alchemy API key from environment variables
    const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;

    if (!ALCHEMY_API_KEY) {
      console.error('Missing ALCHEMY_API_KEY in environment variables');
      return res.status(500).json({
        error: 'Server configuration error: Missing API key',
      });
    }

    // Get which chain to use, defaulting to Ethereum
    const chain = req.query.chain || 
                  (req.body && req.body.chain) || 
                  'eth';
    
    // Build the correct base URL for the selected chain
    const baseUrl = `https://${chain}-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}`;

    // Get which Alchemy endpoint to call
    const endpoint = req.query.endpoint || 
                    (req.body && req.body.endpoint) || 
                    'getNFTsForOwner';

    // Remove our internal parameters before forwarding to Alchemy
    const params = { ...req.query };
    delete params.endpoint;
    delete params.chain;
    
    // Log the request for debugging
    console.log(`Alchemy API request: [${chain}] ${endpoint}`);
    console.log('Request params:', params);

    let response;

    // Handle different endpoints and request methods
    if (req.method === 'GET') {
      const url = `${baseUrl}/${endpoint}`;
      console.log(`Making GET request to: ${url}`);
      response = await axios.get(url, { params });
    } else if (req.method === 'POST') {
      // For batch requests and other POST endpoints
      const url = `${baseUrl}/${endpoint}`;
      
      // Prepare body, removing our custom parameters
      const body = { ...req.body };
      delete body.endpoint;
      delete body.chain;

      console.log(`Making POST request to: ${url}`);
      response = await axios.post(url, body);
    }

    // Forward the response back to the client
    return res.status(response.status).json(response.data);
  } catch (error) {
    console.error('Alchemy API error:', error.message);
    
    // Try to get detailed error from Alchemy if available
    const status = error.response?.status || 500;
    const errorData = error.response?.data || { error: error.message };
    
    return res.status(status).json(errorData);
  }
}; 