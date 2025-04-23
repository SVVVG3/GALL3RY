/**
 * API proxy for Alchemy NFT API
 * 
 * This endpoint forwards requests to the Alchemy API
 * with proper authentication.
 */

import axios from 'axios';

// Map of network IDs to Alchemy endpoints
const NETWORK_ENDPOINTS = {
  'eth': 'eth-mainnet',
  'ethereum': 'eth-mainnet',
  'polygon': 'polygon-mainnet',
  'poly': 'polygon-mainnet',
  'arb': 'arb-mainnet',
  'arbitrum': 'arb-mainnet',
  'opt': 'opt-mainnet',
  'optimism': 'opt-mainnet',
  'base': 'base-mainnet'
};

// Get the Alchemy API key from environment
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

    // Get the network from URL path or default to ethereum
    const networkParam = req.query.network || 'eth';
    const networkEndpoint = NETWORK_ENDPOINTS[networkParam.toLowerCase()];
    
    if (!networkEndpoint) {
      return res.status(400).json({
        error: 'Invalid network',
        message: `Network ${networkParam} is not supported. Supported networks are: ${Object.keys(NETWORK_ENDPOINTS).join(', ')}`
      });
    }

    // Get the endpoint from URL path or query parameter
    const endpoint = req.query.endpoint;
    if (!endpoint) {
      return res.status(400).json({ 
        error: 'Missing endpoint parameter',
        message: 'The endpoint parameter is required' 
      });
    }

    // Get the query params and remove the endpoint and network params to avoid duplication
    const queryParams = new URLSearchParams(req.query);
    queryParams.delete('endpoint');
    queryParams.delete('network');

    // Build the full URL with the appropriate network
    const baseUrl = `https://${networkEndpoint}.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}`;
    const apiUrl = `${baseUrl}/${endpoint}?${queryParams.toString()}`;
    
    console.log(`Forwarding request to Alchemy API: ${endpoint} on network ${networkEndpoint}`);
    
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
      
      console.log(`Successful response from Alchemy API for ${networkEndpoint}`);
      return res.status(200).json(response.data);
    } catch (error) {
      console.error(`Error with Alchemy API on ${networkEndpoint}:`, error.message);
      if (error.response?.data) {
        console.error('Alchemy API error details:', error.response.data);
      }
      
      return res.status(error.response?.status || 502).json({ 
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