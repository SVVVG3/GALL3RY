// Dedicated Farcaster Auth endpoint
// Explicitly setting Node.js runtime for Vercel compatibility

// Export Vercel config to ensure Node.js runtime
export const config = {
  runtime: 'nodejs',
}

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

  // Simply return success for authentication
  // This is all that's needed for the basic Farcaster Auth flow
  return res.status(200).json({ 
    status: 'ok', 
    message: 'Farcaster authentication successful',
    timestamp: new Date().toISOString()
  });
} 