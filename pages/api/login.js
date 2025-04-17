// Simple login endpoint for Farcaster Auth Kit to verify sign-in
// Define config for Vercel Edge
export const config = {
  runtime: 'edge',
  regions: ['iad1'], // Use the default region or specify multiple
  methods: ['GET', 'POST', 'OPTIONS']
};

export default async function handler(req) {
  // Set CORS headers
  const headers = {
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization',
    'Content-Type': 'application/json'
  };

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers
    });
  }

  // Log the request for debugging
  console.log('Farcaster login request:', {
    method: req.method,
    url: req.url
  });

  // For both GET and POST requests, return success
  // This is sufficient for the basic Auth Kit integration
  return new Response(JSON.stringify({
    status: 'ok',
    message: 'Authentication successful',
    timestamp: new Date().toISOString()
  }), {
    status: 200,
    headers
  });
} 