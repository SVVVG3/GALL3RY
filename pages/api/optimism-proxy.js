// Optimism RPC Proxy for Farcaster Auth Kit
// This endpoint forwards JSON-RPC requests to the Optimism RPC
const axios = require('axios');

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST and GET methods
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const OPTIMISM_RPC_URL = 'https://mainnet.optimism.io';
    
    // Log the request for debugging
    console.log('Proxying Optimism RPC request:', {
      method: req.method,
      body: req.body ? (typeof req.body === 'object' ? JSON.stringify(req.body).substring(0, 100) : 'Raw body') : 'No body'
    });

    // Forward the request to Optimism RPC
    const response = await axios({
      method: req.method,
      url: OPTIMISM_RPC_URL,
      data: req.body,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000 // 10 second timeout
    });
    
    // Return the response data
    return res.status(response.status || 200).json(response.data);
  } catch (error) {
    console.error('Error proxying to Optimism RPC:', error.message);
    
    // Try to extract more error details
    let errorDetails = { message: error.message };
    if (error.response) {
      errorDetails.status = error.response.status;
      errorDetails.data = error.response.data;
    }
    
    console.error('Error details:', errorDetails);
    
    // Return an error response
    return res.status(error.response?.status || 502).json({
      error: 'Error connecting to Optimism RPC',
      details: errorDetails
    });
  }
} 