// Alchemy API proxy with improved error handling
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Export the function for Vercel serverless deployment
module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow GET requests for Alchemy NFT API
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get Alchemy API key from environment variables or use our default
    const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || "-DhGb2lvitCWrrAmLnF5TZLl-N6l8Lak";
    
    // Get query parameters
    const { chain = 'eth', endpoint = 'getNFTsForOwner', ...params } = req.query;
    
    // Validate required parameters
    if (endpoint === 'getNFTsForOwner' && !params.owner) {
      return res.status(400).json({ 
        error: 'Missing required parameter', 
        message: 'The "owner" parameter is required' 
      });
    }
    
    // Map chain names to base URLs
    const chainBaseUrls = {
      eth: 'https://eth-mainnet.g.alchemy.com',
      base: 'https://base-mainnet.g.alchemy.com',
      polygon: 'https://polygon-mainnet.g.alchemy.com',
      arbitrum: 'https://arb-mainnet.g.alchemy.com',
      optimism: 'https://opt-mainnet.g.alchemy.com',
    };
    
    // Get the base URL for the requested chain
    const baseUrl = chainBaseUrls[chain];
    if (!baseUrl) {
      return res.status(400).json({ 
        error: 'Invalid chain', 
        message: `Chain "${chain}" is not supported` 
      });
    }
    
    // Build the Alchemy API URL
    let alchemyUrl = `${baseUrl}/nft/v3/${ALCHEMY_API_KEY}/${endpoint}`;
    
    // Add query parameters
    const queryString = Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
    
    if (queryString) {
      alchemyUrl += `?${queryString}`;
    }
    
    console.log(`Proxying request to Alchemy API: ${alchemyUrl.replace(ALCHEMY_API_KEY, '[REDACTED]')}`);
    
    // Make the request to Alchemy API
    const response = await fetch(alchemyUrl, {
      headers: {
        'Accept': 'application/json',
        // Don't set User-Agent header in browser environment
        // 'User-Agent': 'GALL3RY/1.0 (https://gall3ry.vercel.app)'
      }
    });
    
    // Get the response data
    const data = await response.json();
    
    // Check for error response
    if (data.error) {
      console.error('Alchemy API error:', data.error);
      return res.status(response.status || 500).json(data);
    }
    
    // Return the data
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error proxying to Alchemy API:', error);
    
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'An unknown error occurred'
    });
  }
}; 