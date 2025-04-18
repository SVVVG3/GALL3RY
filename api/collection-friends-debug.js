// Debug version of the collection-friends API
// This provides more detailed error information for troubleshooting

const collectionFriendsHandler = require('./collection-friends.js');

// Main handler function
module.exports = async function debugHandler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
  
  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  console.log(`[DEBUG] Collection-friends-debug endpoint called with parameters:`, req.query);
  
  try {
    // Validate parameters
    const { contractAddress, fid } = req.query;
    
    if (!contractAddress) {
      return res.status(400).json({ 
        error: 'Missing parameter', 
        message: 'contractAddress is required',
        debug: true 
      });
    }
    
    if (!fid) {
      return res.status(400).json({ 
        error: 'Missing parameter', 
        message: 'fid (Farcaster ID) is required',
        debug: true
      });
    }
    
    // Add diagnostic information
    console.log(`[DEBUG] API keys:`, {
      hasNeynarKey: !!process.env.NEYNAR_API_KEY,
      hasAlchemyKey: !!process.env.ALCHEMY_API_KEY,
      hasReactAppNeynarKey: !!process.env.REACT_APP_NEYNAR_API_KEY,
      hasReactAppAlchemyKey: !!process.env.REACT_APP_ALCHEMY_API_KEY
    });
    
    // Try using the standard collection friends handler
    return await collectionFriendsHandler(req, res);
    
  } catch (error) {
    console.error(`[DEBUG] Collection-friends-debug error:`, error);
    
    // Return detailed error information
    return res.status(500).json({
      error: 'Error in collection-friends-debug endpoint',
      message: error.message,
      stack: error.stack,
      name: error.name,
      debug: true,
      query: req.query,
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasNeynarKey: !!process.env.NEYNAR_API_KEY,
        hasAlchemyKey: !!process.env.ALCHEMY_API_KEY
      }
    });
  }
}; 