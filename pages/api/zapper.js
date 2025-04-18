/**
 * API proxy for Zapper GraphQL API
 * 
 * This endpoint forwards requests to the Zapper GraphQL API
 * with proper authentication.
 */

import axios from 'axios';

// Constants
const ZAPPER_API_URL = 'https://api.zapper.xyz/v2/graphql';
const ZAPPER_API_KEY = process.env.ZAPPER_API_KEY || process.env.REACT_APP_ZAPPER_API_KEY || 'zapper-gallery';

export default async function handler(req, res) {
  // CORS headers for cross-origin requests
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // Handle OPTIONS requests (pre-flight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed', message: 'Only POST requests are allowed' });
  }

  try {
    if (!ZAPPER_API_KEY) {
      return res.status(500).json({ 
        error: 'Zapper API key not configured', 
        message: 'The Zapper API key is missing in the server configuration'
      });
    }

    // Get the GraphQL query and variables from the request body
    const { query, variables } = req.body;
    
    if (!query) {
      return res.status(400).json({ 
        error: 'Missing GraphQL query',
        message: 'A valid GraphQL query is required in the request body' 
      });
    }

    console.log(`Forwarding GraphQL request to Zapper API`);
    
    try {
      // Make the API request to Zapper
      const response = await axios({
        method: 'POST',
        url: ZAPPER_API_URL,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'GALL3RY/1.0 (+https://gall3ry.vercel.app)',
          'x-zapper-api-key': ZAPPER_API_KEY
        },
        data: {
          query,
          variables
        },
        timeout: 15000 // Extended timeout to 15 seconds
      });
      
      // Check for GraphQL errors and forward them appropriately
      if (response.data?.errors) {
        console.warn('GraphQL errors from Zapper:', JSON.stringify(response.data.errors));
        return res.status(200).json(response.data); // GraphQL errors are still valid responses
      }
      
      console.log(`Successful response from Zapper API`);
      return res.status(200).json(response.data);
    } catch (error) {
      console.error(`Error with Zapper API:`, error.message);
      
      // Return a more informative error response
      return res.status(502).json({ 
        error: 'Failed to fetch from Zapper API',
        message: error.message,
        details: error.response?.data || null
      });
    }
  } catch (error) {
    console.error('Error in Zapper API proxy:', error);
    
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
} 