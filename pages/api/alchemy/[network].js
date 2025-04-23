/**
 * Network-specific API proxy for Alchemy NFT API
 * 
 * This endpoint forwards requests to the Alchemy API
 * with proper authentication for specific networks.
 * Path: /api/alchemy/[network]
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
  'base': 'base-mainnet',
  // Add more networks as needed
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

    // Get the network from the URL path parameter
    const networkParam = req.query.network;
    if (!networkParam) {
      return res.status(400).json({ 
        error: 'Missing network parameter',
        message: 'The network parameter is required' 
      });
    }

    // Validate the network parameter and get the endpoint
    const networkEndpoint = NETWORK_ENDPOINTS[networkParam.toLowerCase()];
    if (!networkEndpoint) {
      return res.status(400).json({ 
        error: 'Invalid network parameter',
        message: `The network "${networkParam}" is not supported` 
      });
    }

    // Ensure we have an endpoint to call
    const endpoint = req.query.endpoint || 'getNFTsForOwner'; // Default to NFT ownership endpoint
    
    // Get the query params and remove the network param to avoid duplication
    const queryParams = new URLSearchParams(req.query);
    queryParams.delete('network');
    queryParams.delete('endpoint');

    // Build the full URL with the appropriate network
    const alchemyBaseUrl = `https://${networkEndpoint}.g.alchemy.com/nft/v3/`;
    const apiUrl = `${alchemyBaseUrl}${ALCHEMY_API_KEY}/${endpoint}?${queryParams.toString()}`;
    
    console.log(`Forwarding request to Alchemy API: ${endpoint} on network ${networkParam}`);
    
    try {
      // Forward the request to Alchemy
      const response = await axios({
        method: req.method,
        url: apiUrl,
        data: req.method !== 'GET' ? req.body : undefined,
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'GALL3RY/1.0 (+https://gall3ry.vercel.app)'
        },
        timeout: 15000 // Extended timeout to 15 seconds
      });
      
      console.log(`Successful response from Alchemy API for ${networkParam}`);
      return res.status(200).json(response.data);
    } catch (error) {
      console.error(`Error with Alchemy API on ${networkParam}:`, error.message);
      
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