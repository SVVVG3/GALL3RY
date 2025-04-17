// Optimism RPC Proxy for Farcaster Auth Kit
// This endpoint forwards JSON-RPC requests to Alchemy's Optimism RPC
const axios = require('axios');

// Use a simple export function - no middleware, just a basic handler
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

  // We need the body for JSON-RPC requests
  if (!req.body) {
    return res.status(400).json({ error: 'Request body is required' });
  }

  try {
    // Use Alchemy's public Optimism RPC instead of the direct one
    const ALCHEMY_OPTIMISM_RPC_URL = 'https://opt-mainnet.g.alchemy.com/v2/demo';
    
    // Make the request to Alchemy
    const response = await axios({
      method: 'POST',
      url: ALCHEMY_OPTIMISM_RPC_URL,
      data: req.body,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000
    });
    
    // Return the response data
    return res.status(200).json(response.data);
  } catch (error) {
    console.error('Optimism RPC error:', error.message);
    
    // Include error details in response
    return res.status(502).json({
      error: 'Error connecting to Optimism RPC',
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
  }
} 