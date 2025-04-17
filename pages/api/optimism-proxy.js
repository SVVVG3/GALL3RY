// Optimism RPC Proxy for Farcaster Auth Kit
// This endpoint forwards JSON-RPC requests to the Optimism RPC

// Define config for Vercel Edge
export const config = {
  runtime: 'edge',
  regions: ['iad1'], // Use the default region or specify multiple
  methods: ['GET', 'POST', 'OPTIONS']
};

export default async function handler(req, res) {
  // Get the request body as a string
  const body = await req.text();
  let jsonBody;
  
  try {
    jsonBody = JSON.parse(body);
  } catch (e) {
    jsonBody = null;
  }

  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  };

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers
    });
  }

  // Only allow POST and GET methods
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      }
    });
  }

  try {
    const OPTIMISM_RPC_URL = 'https://mainnet.optimism.io';
    
    // Log the request for debugging
    console.log('Proxying Optimism RPC request:', {
      method: req.method,
      body: jsonBody ? JSON.stringify(jsonBody).substring(0, 100) : 'No body'
    });

    // Forward the request to Optimism RPC
    const response = await fetch(OPTIMISM_RPC_URL, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body,
    });
    
    // Get the response body
    const responseBody = await response.text();
    
    // Return the response
    return new Response(responseBody, {
      status: response.status,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error proxying to Optimism RPC:', error.message);
    
    // Create error response
    return new Response(JSON.stringify({
      error: 'Error connecting to Optimism RPC',
      message: error.message
    }), {
      status: 502,
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      }
    });
  }
} 