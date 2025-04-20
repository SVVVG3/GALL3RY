const { corsHeaders } = require('./_utils');
const zapperHandler = require('./zapper');

/**
 * This file handles the deprecated Neynar API requests and redirects them to use the Zapper API
 * It exists to maintain backward compatibility while the app transitions to Zapper only
 * 
 * This handler is designed to work with both Express and Vercel serverless functions
 */
const handler = async (req, res) => {
  // Set CORS headers for all responses
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  // Handle OPTIONS request (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Extract endpoint and query parameters
  const { endpoint, q } = req.query;
  
  console.log(`DEPRECATED: Received request to /api/neynar with endpoint=${endpoint}, q=${q}`);
  console.log('This endpoint is deprecated. Please use /api/zapper with GraphQL directly.');
  
  // For search endpoints, convert to Zapper GraphQL query
  if (endpoint === 'search' && q) {
    // Create a synthetic request to pass to the Zapper handler
    const modifiedReq = {
      ...req,
      method: 'POST',
      body: {
        query: `
          query FarcasterProfile($username: String) {
            farcasterProfile(username: $username) {
              username
              fid
              metadata {
                displayName
                description
                imageUrl
              }
              custodyAddress
              connectedAddresses
            }
          }
        `,
        variables: { username: q }
      }
    };
    
    // Pass the modified request to the Zapper handler
    return zapperHandler(modifiedReq, res);
  }
  
  // For other endpoints, return a deprecation notice
  return res.status(410).json({
    error: 'API Endpoint Deprecated',
    message: 'The Neynar API endpoint is deprecated. Please use the Zapper GraphQL API at /api/zapper instead.',
    documentation: 'See https://protocol.zapper.xyz/agents.txt for Zapper API documentation'
  });
};

module.exports = handler; 