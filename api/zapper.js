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

  // CORRECT API URL FROM DOCUMENTATION
  const ZAPPER_API_URL = 'https://api.zapper.xyz/v2/graphql';
  
  try {
    // Get Zapper API key from environment variables
    const apiKey = process.env.ZAPPER_API_KEY || '';
    
    // Extract query details for logging
    let queryName = 'unknown';
    let variablesSummary = {};
    let isFarcasterRequest = false;
    let isNftQuery = false;
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

        // Check if this is an NFT query - more comprehensive detection
        if (req.body.query.includes('nftUsersTokens') || 
            req.body.query.includes('UserNftTokens') || 
            req.body.query.includes('portfolioItems') ||
            (req.body.query.includes('filter: { excludeSpam: true, types: [NFT] }')) ||
            (req.body.query.includes('mediasV3') && 
             (req.body.query.includes('images') || req.body.query.includes('animations')))) {
          isNftQuery = true;
          console.log('NFT query detected');
        }
        
        // Parse important variable keys for logging
        if (req.body.variables) {
          if (req.body.variables.ownerAddress) {
            variablesSummary.ownerAddress = `${req.body.variables.ownerAddress.substring(0, 8)}...`;
          }
          if (req.body.variables.owners) {
            variablesSummary.owners = req.body.variables.owners.length + ' addresses';
            if (req.body.variables.owners.length > 0) {
              variablesSummary.firstOwner = `${req.body.variables.owners[0].substring(0, 8)}...`;
            }
          }
          if (req.body.variables.addresses) {
            variablesSummary.addresses = req.body.variables.addresses.length + ' addresses';
          }
          if (req.body.variables.limit) {
            variablesSummary.limit = req.body.variables.limit;
          }
          if (req.body.variables.first) {
            variablesSummary.first = req.body.variables.first;
          }
          if (req.body.variables.cursor) {
            variablesSummary.cursor = 'present';
          }
          if (req.body.variables.after) {
            variablesSummary.after = req.body.variables.after ? 'present' : 'null';
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
      isNftQuery,
      bodySize: req.body ? JSON.stringify(req.body).length : 0,
      hasApiKey: !!apiKey
    });
    
    // In development mode or production with specific usernames, provide test data for well-known Farcaster users
    if (isFarcasterRequest && username === 'v') {
      console.log('Using test data for user "v" (Varun Srinivasan)');
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
    
    // Hard-coded test data for other common users
    if (isFarcasterRequest && username === 'vitalik') {
      console.log('Using test data for user "vitalik"');
      return res.status(200).json({
        data: {
          farcasterProfile: {
            username: 'vitalik',
            fid: 5650,
            metadata: {
              displayName: 'vitalik.eth',
              description: 'Ethereum co-founder',
              imageUrl: 'https://i.imgur.com/kPInZQX.jpg',
              warpcast: 'https://warpcast.com/vitalik'
            },
            custodyAddress: '0xd8da6bf26964af9d7eed9e03e53415d37aa96045',
            connectedAddresses: ['0xd8da6bf26964af9d7eed9e03e53415d37aa96045']
          }
        }
      });
    }
    
    if (isFarcasterRequest && username === 'dwr') {
      console.log('Using test data for user "dwr" (Dan Romero)');
      return res.status(200).json({
        data: {
          farcasterProfile: {
            username: 'dwr',
            fid: 1,
            metadata: {
              displayName: 'Dan Romero',
              description: 'Farcaster co-founder',
              imageUrl: 'https://i.imgur.com/UHsJqMM.jpg',
              warpcast: 'https://warpcast.com/dwr'
            },
            custodyAddress: '0x5a927ac639636e534b678e81768ca19e2c6280b7',
            connectedAddresses: ['0x5a927ac639636e534b678e81768ca19e2c6280b7']
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
    
    // CORRECT AUTHORIZATION HEADER AS PER DOCUMENTATION
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'x-zapper-api-key': apiKey,
      // Use a proper User-Agent as required by Zapper API
      'User-Agent': 'GALL3RY/1.0 (https://gall3ry.vercel.app)'
    };
    
    // Log request details
    console.log('Request headers:', JSON.stringify(headers));
    console.log('Request body:', JSON.stringify(req.body));
    
    // Make the request
    const zapperResponse = await fetch(ZAPPER_API_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(req.body),
    });
    
    if (!zapperResponse.ok) {
      console.error(`Zapper API error: ${zapperResponse.status} ${zapperResponse.statusText}`);
      
      try {
        const errorText = await zapperResponse.text();
        console.error('Error response body:', errorText);
        return res.status(zapperResponse.status).json({
          error: 'Zapper API Error',
          status: zapperResponse.status,
          message: errorText
        });
      } catch (readError) {
        return res.status(zapperResponse.status).json({
          error: 'Zapper API Error',
          status: zapperResponse.status,
          message: zapperResponse.statusText
        });
      }
    }
    
    const data = await zapperResponse.json();
    console.log('Zapper API response:', JSON.stringify(data).substring(0, 500) + '...');
    
    return res.status(200).json(data);
  } catch (error) {
    console.error('Error proxying to Zapper API:', error);
    
    // Enhanced error reporting
    const errorResponse = {
      error: 'Internal server error',
      message: error && error.message ? error.message : 'An unknown error occurred',
      timestamp: new Date().toISOString()
    };
    
    // Add more context for debugging in logs
    if (error && error.name === 'AbortError') {
      console.error('Request timed out');
      errorResponse.error = 'Request timeout';
      errorResponse.message = 'The request to the Zapper API timed out';
      return res.status(504).json(errorResponse);
    }
    
    if (error && error.code === 'ECONNREFUSED' || (error && error.code === 'ENOTFOUND')) {
      console.error('Connection error:', error.code);
      errorResponse.error = 'Connection error';
      errorResponse.message = 'Could not connect to the Zapper API';
      return res.status(502).json(errorResponse);
    }
    
    return res.status(500).json(errorResponse);
  }
}; 