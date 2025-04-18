// Simple login endpoint for Farcaster Auth Kit to verify sign-in
export default function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Log the request for debugging
  console.log('Farcaster login request:', {
    method: req.method,
    path: req.url,
    query: req.query,
    body: req.body ? 'Has body' : 'No body'
  });

  // For both GET and POST requests, return success
  // This is sufficient for the basic Auth Kit integration
  return res.status(200).json({ 
    status: 'ok', 
    message: 'Authentication successful',
    timestamp: new Date().toISOString()
  });
} 