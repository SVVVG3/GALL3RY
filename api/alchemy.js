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
    // Get Alchemy API key from environment variables with better fallbacks
    // For Vercel, these need to be configured in the Vercel dashboard
    const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || 
                           process.env.REACT_APP_ALCHEMY_API_KEY || 
                           process.env.REACT_APP_ALCHEMY_ETH_API_KEY ||
                           "2ZaODCGR5YEA0cACkf0iqLs3ohiwTUwC"; // Hardcoded fallback for testing
    
    // Check if we have a valid API key
    if (!ALCHEMY_API_KEY) {
      console.error('No Alchemy API key found in environment variables');
      return res.status(500).json({
        error: 'Configuration error',
        message: 'Alchemy API key is missing. Please check your environment variables in Vercel.'
      });
    }
    
    // Log key (first few chars only) for debugging
    console.log(`Using Alchemy API Key: ${ALCHEMY_API_KEY ? (ALCHEMY_API_KEY.substring(0, 5) + "...") : "none"}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'unknown'}`);
    console.log(`Request query params:`, req.query);
    
    // Get query parameters
    const { chain = 'eth', endpoint = 'getNFTsForOwner', ...params } = req.query;
    
    // Validate required parameters
    if (endpoint === 'getNFTsForOwner' && !params.owner) {
      return res.status(400).json({ 
        error: 'Missing required parameter', 
        message: 'The "owner" parameter is required' 
      });
    }
    
    // Map chain names to base URLs - Using v2 NFT API endpoints as per documentation
    const chainBaseUrls = {
      eth: 'https://eth-mainnet.g.alchemy.com/nft/v2',
      base: 'https://base-mainnet.g.alchemy.com/nft/v2',
      polygon: 'https://polygon-mainnet.g.alchemy.com/nft/v2',
      arbitrum: 'https://arb-mainnet.g.alchemy.com/nft/v2',
      optimism: 'https://opt-mainnet.g.alchemy.com/nft/v2',
    };
    
    // Get the base URL for the requested chain
    const baseUrl = chainBaseUrls[chain];
    if (!baseUrl) {
      return res.status(400).json({ 
        error: 'Invalid chain', 
        message: `Chain "${chain}" is not supported` 
      });
    }
    
    // Build the Alchemy API URL according to documentation
    let alchemyUrl = `${baseUrl}/${ALCHEMY_API_KEY}/${endpoint}`;
    
    // Add query parameters
    const queryString = Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');
    
    if (queryString) {
      alchemyUrl += `?${queryString}`;
    }
    
    console.log(`Proxying request to Alchemy API: ${alchemyUrl.replace(ALCHEMY_API_KEY, '[REDACTED]')}`);
    
    // Make the request to Alchemy API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    try {
      const response = await fetch(alchemyUrl, {
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // Check for non-successful status codes
      if (!response.ok) {
        console.error(`Alchemy API returned status ${response.status}`);
        const errorData = await response.json().catch(() => ({}));
        return res.status(response.status).json({
          error: 'Alchemy API error',
          message: errorData.message || `API returned status ${response.status}`,
          details: errorData
        });
      }
      
      // Get the response data
      const data = await response.json();
      
      // Check for error response
      if (data.error) {
        console.error('Alchemy API error:', data.error);
        return res.status(response.status || 500).json(data);
      }
      
      // Return the data
      return res.status(200).json(data);
    } catch (fetchError) {
      if (fetchError.name === 'AbortError') {
        console.error('Alchemy API request timed out');
        return res.status(504).json({
          error: 'Gateway Timeout',
          message: 'Request to Alchemy API timed out'
        });
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('Error proxying to Alchemy API:', error);
    
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'An unknown error occurred',
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
}; 