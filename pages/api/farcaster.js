// API route for direct Farcaster API calls
// Forwards to the all-in-one.js handler

const allInOne = require('../../api/all-in-one.js');

export default async function handler(req, res) {
  console.log('[Vercel] Farcaster API route called');
  return allInOne(req, res);
} 