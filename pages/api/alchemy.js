/**
 * API proxy for Alchemy NFT API
 * 
 * This endpoint forwards requests to the Alchemy API
 * with proper authentication.
 */

import axios from 'axios';

// Constants
const ALCHEMY_BASE_URL = 'https://eth-mainnet.g.alchemy.com/nft/v3/';
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || process.env.REACT_APP_ALCHEMY_API_KEY;

export default async function handler(req, res) {
  // CORS headers for cross-origin requests
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // Handle OPTIONS requests (pre-flight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (!ALCHEMY_API_KEY) {
      return res.status(500).json({ 
        error: 'Alchemy API key not configured', 
        message: 'The Alchemy API key is missing in the server configuration'
      });
    }

    // Get the endpoint path from the query param
    const endpoint = req.query.endpoint;
    if (!endpoint) {
      return res.status(400).json({ 
        error: 'Missing endpoint parameter',
        message: 'The endpoint parameter is required' 
      });
    }

    // Get the query params and remove the endpoint param to avoid duplication
    const queryParams = new URLSearchParams(req.query);
    queryParams.delete('endpoint');

    // Build the full URL
    const apiUrl = `${ALCHEMY_BASE_URL}${ALCHEMY_API_KEY}/${endpoint}?${queryParams.toString()}`;
    
    console.log(`Forwarding request to Alchemy API: ${endpoint}`);
    
    try {
      // Forward the request to Alchemy
      const response = await axios({
        method: req.method,
        url: apiUrl,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'GALL3RY/1.0 (+https://gall3ry.vercel.app)'
        },
        timeout: 15000 // Extended timeout to 15 seconds
      });
      
      console.log(`Successful response from Alchemy API`);
      return res.status(200).json(response.data);
    } catch (error) {
      console.error(`Error with Alchemy API:`, error.message);
      
      return res.status(502).json({ 
        error: 'Failed to fetch from Alchemy API',
        message: error.message,
        details: error.response?.data || null
      });
    }
  } catch (error) {
    console.error('Error in Alchemy API proxy:', error);
    
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
}