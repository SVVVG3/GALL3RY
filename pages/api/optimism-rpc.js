// Dedicated Optimism RPC endpoint for Farcaster Auth
const axios = require('axios');

// Export Vercel config to ensure Node.js runtime
export const config = {
  runtime: 'nodejs',
}

export default async function handler(req, res) {
  // Set CORS headers for browser requests
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only process POST requests (JSON-RPC standard)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Only POST is supported for JSON-RPC.' });
  }

  try {
    // Get Alchemy API key from environment variables or use demo key as fallback
    const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || 'demo';
    
    // Build the RPC URL using the API key
    const rpcUrl = `https://opt-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
    
    // Forward the JSON-RPC request to Alchemy
    const response = await axios({
      method: 'POST',
      url: rpcUrl,
      data: req.body,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 10000
    });
    
    // Return the JSON-RPC response
    return res.status(200).json(response.data);
  } catch (error) {
    console.error('Optimism RPC error:', error.message);
    
    // Return a proper JSON-RPC error response
    return res.status(502).json({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: 'Internal JSON-RPC error',
        data: {
          originalError: error.message,
          status: error.response?.status
        }
      },
      id: req.body?.id || null
    });
  }
} 