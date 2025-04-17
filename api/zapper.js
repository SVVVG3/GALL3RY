const axios = require('axios');

// ZAPPER API - Used only for Farcaster profile data and connected wallets
module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // Handle OPTIONS requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({
      errors: [{
        message: 'Method not allowed. Use POST requests for this endpoint.',
        extensions: { error: 'Method Not Allowed' }
      }]
    });
  }

  // Check if this is a Farcaster profile request
  let isFarcasterRequest = false;
  let username = null;
  let fid = null;
  
  if (req.body?.query && req.body.query.includes('farcasterProfile')) {
    isFarcasterRequest = true;
    
    if (req.body.variables) {
      username = req.body.variables.username;
      fid = req.body.variables.fid;
    }
    
    console.log(`Farcaster profile request for username: ${username}, fid: ${fid}`);
  } else {
    // If not a Farcaster request, don't process it through Zapper
    console.warn('Non-Farcaster request attempted on Zapper endpoint');
    return res.status(400).json({
      errors: [{
        message: 'The Zapper endpoint is only for Farcaster profile requests',
        extensions: {
          error: 'Invalid request'
        }
      }]
    });
  }

  // Zapper GraphQL API URL
  const ZAPPER_API_URL = 'https://public.zapper.xyz/graphql';
  
  try {
    // Get Zapper API key from environment variables with more detailed debugging
    const apiKey = process.env.ZAPPER_API_KEY || '';
    
    // Debug environment variables (safe keys only)
    const safeEnvVars = {};
    for (const key in process.env) {
      if (key.includes('API_KEY')) {
        safeEnvVars[key] = `${process.env[key].substring(0, 4)}...`;
      } else if (!key.includes('SECRET') && !key.includes('TOKEN')) {
        safeEnvVars[key] = process.env[key];
      }
    }
    console.log('Available environment variables:', safeEnvVars);
    
    if (!apiKey) {
      console.warn('⚠️ CRITICAL: No ZAPPER_API_KEY found in environment variables!');
      return res.status(500).json({
        errors: [{
          message: 'Zapper API key is missing. Please check server configuration.',
          extensions: {
            error: 'API Configuration Error',
            availableEnvVars: Object.keys(process.env).filter(k => !k.includes('SECRET'))
          }
        }]
      });
    }
    
    // Print API key for debugging (first 4 chars)
    console.log(`Using Zapper API key: ${apiKey.substring(0, 4)}...`);
    
    // Set up headers with API key and proper User-Agent
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'x-zapper-api-key': apiKey,
      'User-Agent': 'Mozilla/5.0 GALL3RY/1.0 (+https://gall3ry.vercel.app)'
    };
    
    // Log full headers (redact API key)
    const safeHeaders = {...headers};
    safeHeaders['x-zapper-api-key'] = `${safeHeaders['x-zapper-api-key'].substring(0, 4)}...`;
    console.log('Request headers:', safeHeaders);
    
    // Try Neynar API as a fallback if username is provided
    if (username && !fid) {
      try {
        console.log(`Attempting to use Neynar API as fallback for username: ${username}`);
        const neynarResponse = await fetchFromNeynar(username);
        if (neynarResponse) {
          // Convert to Zapper API format
          const farcasterProfile = {
            fid: neynarResponse.fid,
            username: neynarResponse.username,
            metadata: {
              displayName: neynarResponse.display_name,
              imageUrl: neynarResponse.pfp_url
            },
            custodyAddress: neynarResponse.custody_address,
            connectedAddresses: neynarResponse.connected_addresses || []
          };
          
          return res.status(200).json({
            data: {
              farcasterProfile
            }
          });
        }
      } catch (neynarError) {
        console.log('Neynar fallback failed:', neynarError.message);
      }
    }
    
    // Forward the request to Zapper
    console.log(`Sending GraphQL request to ${ZAPPER_API_URL}`);
    const response = await axios({
      method: 'post',
      url: ZAPPER_API_URL,
      headers: headers,
      data: req.body,
      timeout: 15000 // 15 second timeout for slow API responses
    });
    
    // Log response headers and status
    console.log(`Zapper API response status: ${response.status}`);
    console.log('Zapper API response headers:', response.headers);
    
    // Return the response from Zapper
    return res.status(response.status).json(response.data);
    
  } catch (error) {
    console.error('Error proxying to Zapper:', error.message);
    
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
      console.error('Response data:', JSON.stringify(error.response.data));
    }
    
    // Try a fetch to protocol.zapper.xyz agents.txt to test connectivity
    try {
      console.log('Testing connectivity to protocol.zapper.xyz...');
      const testResponse = await axios.get('https://protocol.zapper.xyz/agents.txt', {
        timeout: 5000,
        headers: {
          'User-Agent': 'Mozilla/5.0 GALL3RY/1.0 (+https://gall3ry.vercel.app)'
        }
      });
      console.log('Connectivity test succeeded with status:', testResponse.status);
    } catch (testError) {
      console.error('Connectivity test failed:', testError.message);
    }
    
    // Return an appropriate error response
    return res.status(error.response?.status || 502).json({
      errors: [{
        message: error.message || 'Error from Zapper API',
        extensions: {
          details: error.response?.data,
          statusCode: error.response?.status
        }
      }]
    });
  }
};

// Fallback to fetch Farcaster profile from Neynar
async function fetchFromNeynar(username) {
  try {
    // Neynar doesn't need API key for user lookup
    console.log(`Fetching user from Neynar: ${username}`);
    const response = await axios({
      method: 'get',
      url: `https://api.neynar.com/v2/farcaster/user/search?q=${encodeURIComponent(username)}&limit=1`,
      headers: {
        'accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 GALL3RY/1.0 (+https://gall3ry.vercel.app)'
      },
      timeout: 5000
    });
    
    if (response.data && response.data.users && response.data.users.length > 0) {
      const exactMatch = response.data.users.find(
        user => user.username.toLowerCase() === username.toLowerCase()
      );
      
      return exactMatch || response.data.users[0];
    }
    
    return null;
  } catch (error) {
    console.error('Neynar API error:', error.message);
    return null;
  }
} 