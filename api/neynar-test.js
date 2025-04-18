// Test endpoint for Neynar API
// This helps diagnose issues with the Neynar API configuration

const axios = require('axios');

// CORS headers helper
const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
};

// Handler function
module.exports = async function handler(req, res) {
  // Set CORS headers
  setCorsHeaders(res);
  
  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  console.log('[Neynar Test] Starting API test');
  
  // Get the Neynar API key
  const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY || process.env.REACT_APP_NEYNAR_API_KEY || 'NEYNAR_API_DOCS';
  
  // Optional FID parameter for specific user testing
  const { fid = '2' } = req.query; // Default to Vitalik's FID if none provided
  
  // Prepare the response object
  const responseData = {
    timestamp: new Date().toISOString(),
    environment: {
      hasNeynarKey: !!process.env.NEYNAR_API_KEY,
      hasReactAppNeynarKey: !!process.env.REACT_APP_NEYNAR_API_KEY,
      keyFirstChars: NEYNAR_API_KEY.substring(0, 4),
      keyLength: NEYNAR_API_KEY.length
    },
    v1: {
      tested: false,
      success: false,
      error: null,
      data: null
    },
    v2: {
      tested: false,
      success: false,
      error: null,
      data: null
    }
  };
  
  // Test v1 API
  try {
    console.log('[Neynar Test] Testing v1 API...');
    responseData.v1.tested = true;
    
    const v1Response = await axios.get(`https://api.neynar.com/v1/farcaster/user?fid=${fid}`, {
      headers: {
        'Accept': 'application/json',
        'api_key': NEYNAR_API_KEY
      },
      timeout: 5000
    });
    
    responseData.v1.success = true;
    responseData.v1.status = v1Response.status;
    responseData.v1.data = {
      username: v1Response.data?.result?.user?.username,
      displayName: v1Response.data?.result?.user?.displayName,
      hasFid: !!v1Response.data?.result?.user?.fid
    };
    
    console.log('[Neynar Test] V1 API test successful');
  } catch (error) {
    console.error('[Neynar Test] V1 API test failed:', error.message);
    responseData.v1.success = false;
    responseData.v1.error = {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    };
  }
  
  // Test v2 API
  try {
    console.log('[Neynar Test] Testing v2 API...');
    responseData.v2.tested = true;
    
    const v2Response = await axios.get(`https://api.neynar.com/v2/farcaster/user/bulk?fids=${fid}`, {
      headers: {
        'Accept': 'application/json',
        'api_key': NEYNAR_API_KEY
      },
      timeout: 5000
    });
    
    responseData.v2.success = true;
    responseData.v2.status = v2Response.status;
    responseData.v2.data = {
      users: v2Response.data?.users?.length,
      username: v2Response.data?.users?.[0]?.username,
      displayName: v2Response.data?.users?.[0]?.display_name,
      hasFid: !!v2Response.data?.users?.[0]?.fid
    };
    
    console.log('[Neynar Test] V2 API test successful');
  } catch (error) {
    console.error('[Neynar Test] V2 API test failed:', error.message);
    responseData.v2.success = false;
    responseData.v2.error = {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    };
  }
  
  // Determine if any test was successful
  const anySuccess = responseData.v1.success || responseData.v2.success;
  
  // Return the response
  return res.status(anySuccess ? 200 : 500).json({
    success: anySuccess,
    message: anySuccess ? 'At least one API version is working' : 'All API tests failed',
    results: responseData
  });
}; 