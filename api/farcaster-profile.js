const axios = require('axios');

// FARCASTER PROFILE API - Dedicated endpoint for Farcaster profile data
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

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({
      errors: [{
        message: 'Method not allowed. Use GET request.',
        extensions: { error: 'Method Not Allowed' }
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
    console.log('Farcaster Profile API - Available environment variables:', safeEnvVars);
    
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

    // Get username or FID from query parameters
    const { username, fid } = req.query;
    
    if (!username && !fid) {
      return res.status(400).json({
        errors: [{
          message: 'Either username or fid parameter is required',
          extensions: {
            error: 'Invalid Request'
          }
        }]
      });
    }

    console.log(`Farcaster profile request via dedicated endpoint for: ${username || fid}`);
    
    // Build the GraphQL query based on what was provided
    const query = `
      query GetFarcasterProfile(${fid ? '$fid: Int' : '$username: String'}) {
        farcasterProfile(${fid ? 'fid: $fid' : 'username: $username'}) {
          username
          fid
          metadata {
            displayName
            description
            imageUrl
            warpcast
          }
          custodyAddress
          connectedAddresses
        }
      }
    `;

    // Build variables based on what was provided
    const variables = fid ? { fid: parseInt(fid, 10) } : { username };

    // Set up headers with API key and proper User-Agent
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'x-zapper-api-key': apiKey,
      'User-Agent': 'Mozilla/5.0 GALL3RY/1.0 (+https://gall3ry.vercel.app)'
    };
    
    // Print API key for debugging (first 4 chars)
    if (apiKey) {
      console.log(`Using API key: ${apiKey.substring(0, 4)}...`);
    }
    
    // Log headers (redact API key)
    const safeHeaders = {...headers};
    safeHeaders['x-zapper-api-key'] = `${safeHeaders['x-zapper-api-key'].substring(0, 4)}...`;
    console.log('Request headers:', safeHeaders);

    console.log(`Sending request to ${ZAPPER_API_URL} with variables:`, variables);
    
    // Make the GraphQL request to Zapper
    const response = await axios({
      method: 'post',
      url: ZAPPER_API_URL,
      headers: headers,
      data: {
        query,
        variables
      },
      timeout: 10000 // 10 second timeout
    });
    
    // Log successful response for debugging
    console.log(`Received response with status ${response.status}`);
    
    // Check for GraphQL errors
    if (response.data?.errors) {
      console.log('GraphQL errors received:', JSON.stringify(response.data.errors));
      return res.status(400).json({
        errors: [{
          message: response.data.errors[0]?.message || 'Unknown GraphQL error',
          extensions: {
            details: response.data.errors
          }
        }]
      });
    }
    
    // Return the profile data
    if (response.data?.data?.farcasterProfile) {
      console.log('Profile found:', JSON.stringify(response.data.data.farcasterProfile, null, 2));
      return res.status(200).json(response.data.data.farcasterProfile);
    } else {
      console.log('No profile found in response:', JSON.stringify(response.data));
      
      // Try alternate source if Zapper fails - Neynar API
      if (username && !fid) {
        try {
          console.log('Trying Neynar API as fallback...');
          const neynarResponse = await fetchFromNeynar(username);
          if (neynarResponse) {
            // Convert to our format
            const profile = {
              username: neynarResponse.username,
              fid: neynarResponse.fid,
              metadata: {
                displayName: neynarResponse.display_name,
                imageUrl: neynarResponse.pfp_url,
                description: neynarResponse.profile?.bio?.text
              },
              custodyAddress: neynarResponse.custody_address,
              connectedAddresses: neynarResponse.connected_addresses || []
            };
            
            console.log('Profile found via Neynar fallback');
            return res.status(200).json(profile);
          }
        } catch (neynarError) {
          console.log('Neynar fallback failed:', neynarError.message);
        }
      }
      
      return res.status(404).json({
        errors: [{
          message: `No Farcaster profile found for ${username || fid}`,
          extensions: {
            error: 'Profile Not Found'
          }
        }]
      });
    }
    
  } catch (error) {
    console.error('Error fetching Farcaster profile:', error.message);
    
    // Log the full error for debugging
    if (error.response) {
      console.error('Error response data:', JSON.stringify(error.response.data));
      console.error('Error response status:', error.response.status);
      console.error('Error response headers:', JSON.stringify(error.response.headers));
    }
    
    // Try connectivity test
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
    return res.status(error.response?.status || 500).json({
      errors: [{
        message: error.message || 'Error fetching Farcaster profile',
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