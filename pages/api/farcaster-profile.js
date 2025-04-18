/**
 * API proxy for Farcaster profile API
 * 
 * This endpoint fetches profile information from Neynar API
 * with proper authentication.
 */

import axios from 'axios';

// Constants
const NEYNAR_API_URL = 'https://api.neynar.com/v2/farcaster/user/bulk-by-username';
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY || process.env.REACT_APP_NEYNAR_API_KEY;

export default async function handler(req, res) {
  // CORS headers for cross-origin requests
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // Handle OPTIONS requests (pre-flight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed', message: 'Only GET requests are allowed' });
  }

  try {
    if (!NEYNAR_API_KEY) {
      return res.status(500).json({ 
        error: 'Neynar API key not configured', 
        message: 'The Neynar API key is missing in the server configuration'
      });
    }

    // Get username from query parameters
    const usernames = req.query.usernames;
    if (!usernames) {
      return res.status(400).json({ 
        error: 'Missing usernames parameter',
        message: 'The usernames parameter is required' 
      });
    }

    console.log(`Fetching Farcaster profiles for: ${usernames}`);
    
    try {
      // Make the API request to Neynar
      const response = await axios({
        method: 'GET',
        url: NEYNAR_API_URL,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'GALL3RY/1.0 (+https://gall3ry.vercel.app)',
          'api_key': NEYNAR_API_KEY
        },
        params: {
          usernames: usernames
        },
        timeout: 15000 // Extended timeout to 15 seconds
      });
      
      console.log(`Successful response from Neynar API`);
      return res.status(200).json(response.data);
    } catch (error) {
      console.error(`Error with Neynar API:`, error.message);
      
      // Return a more informative error response
      return res.status(502).json({ 
        error: 'Failed to fetch from Neynar API',
        message: error.message,
        details: error.response?.data || null
      });
    }
  } catch (error) {
    console.error('Error in Farcaster profile API:', error);
    
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
} 