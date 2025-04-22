/**
 * API proxy for Neynar API
 * 
 * This endpoint forwards requests to various Neynar API endpoints
 * with proper authentication.
 */

import axios from 'axios';

// Constants
const NEYNAR_API_BASE_URL = 'https://api.neynar.com/v2/farcaster';
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

    // Get endpoint from query parameters
    const { endpoint, ...params } = req.query;
    
    if (!endpoint) {
      return res.status(400).json({ 
        error: 'Missing endpoint parameter',
        message: 'The endpoint parameter is required' 
      });
    }

    // Build the appropriate Neynar API URL
    let apiUrl = '';
    
    switch (endpoint) {
      case 'user/search':
        apiUrl = `${NEYNAR_API_BASE_URL}/user/search`;
        break;
      case 'user':
        if (params.fid) {
          apiUrl = `${NEYNAR_API_BASE_URL}/user?fid=${params.fid}`;
        } else if (params.username) {
          apiUrl = `${NEYNAR_API_BASE_URL}/user/search?q=${encodeURIComponent(params.username)}&limit=1`;
        } else {
          return res.status(400).json({
            error: 'Missing user identifier',
            message: 'Either fid or username is required for the user endpoint'
          });
        }
        break;
      default:
        apiUrl = `${NEYNAR_API_BASE_URL}/${endpoint}`;
    }

    console.log(`Forwarding request to Neynar API: ${apiUrl}`);
    
    try {
      // Prepare query parameters excluding 'endpoint'
      const queryParams = { ...params };
      if (endpoint === 'user' && params.username) {
        // Handle user lookup by username differently - using search endpoint
        delete queryParams.username;
      }
      
      // Make the API request to Neynar
      const response = await axios({
        method: 'GET',
        url: apiUrl,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'GALL3RY/1.0 (+https://gall3ry.vercel.app)',
          'api_key': NEYNAR_API_KEY
        },
        params: Object.keys(queryParams).length > 0 ? queryParams : undefined,
        timeout: 15000 // Extended timeout to 15 seconds
      });
      
      console.log(`Successful response from Neynar API`);
      
      // For username search, if we requested a user by username, extract the first matching user
      if (endpoint === 'user' && params.username && response.data?.result?.users) {
        const users = response.data.result.users;
        if (users.length > 0) {
          // Find exact username match, or take the first
          const exactMatch = users.find(u => 
            u.username.toLowerCase() === params.username.toLowerCase()
          );
          
          const user = exactMatch || users[0];
          
          return res.status(200).json({
            result: {
              user: user
            }
          });
        } else {
          return res.status(404).json({
            error: 'User not found',
            message: `No user found with username ${params.username}`
          });
        }
      }
      
      return res.status(200).json(response.data);
    } catch (error) {
      console.error(`Error with Neynar API:`, error.message);
      
      // Return a more informative error response
      return res.status(502).json({ 
        error: 'Neynar API error',
        message: error.message,
        details: error.response?.data || null
      });
    }
  } catch (error) {
    console.error('Error in Neynar API proxy:', error);
    
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
} 