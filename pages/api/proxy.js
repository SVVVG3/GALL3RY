/**
 * Legacy proxy endpoint for backward compatibility
 * Redirects to the image-proxy endpoint for improved image handling
 */

// Forwards to the all-in-one.js handler
const allInOne = require('../../api/all-in-one.js');

export default async function handler(req, res) {
  console.log('[Legacy Proxy] Redirecting to image-proxy for:', req.query.url);
  
  // Reuse the same handler as image-proxy
  return allInOne(req, res);
}

// Preserve important Vercel configuration
export const config = {
  api: {
    bodyParser: false,
    responseLimit: '30mb',
    externalResolver: true,
  },
}; 