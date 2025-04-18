/**
 * Ultra-reliable media proxy for NFT images and videos with guaranteed responses
 * Optimized for Vercel deployment
 */

// API route for image proxying
// Forwards to the all-in-one.js handler for Vercel deployment

const allInOne = require('../../api/all-in-one.js');

export default async function handler(req, res) {
  console.log('[Vercel] Image proxy API route called for:', req.query.url);
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