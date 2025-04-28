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

    // Build the full URL with the appropriate network
    const baseUrl = `https://${networkEndpoint}.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}`;
    
    // Create a new URLSearchParams object for the query
    const queryParams = new URLSearchParams();
    
    // Copy all query parameters except endpoint, network, excludeFilters and spamConfidenceLevel
    Object.keys(req.query).forEach(key => {
      if (key !== 'endpoint' && key !== 'network' && key !== 'excludeFilters[]' && key !== 'spamConfidenceLevel') {
        queryParams.append(key, req.query[key]);
      }
    });
    
    // Set spam confidence level based on the network
    // HIGH for Ethereum, MEDIUM for all other chains
    const isEthMainnet = networkParam.toLowerCase() === 'eth' || networkParam.toLowerCase() === 'ethereum';
    const spamConfidenceLevel = isEthMainnet ? 'HIGH' : 'MEDIUM';
    
    // Handle excludeFilters - add both SPAM and AIRDROPS for better filtering
    const filters = [];
    
    // Get filters from query if available
    if (req.query['excludeFilters[]']) {
      const requestedFilters = Array.isArray(req.query['excludeFilters[]']) 
        ? req.query['excludeFilters[]'] 
        : [req.query['excludeFilters[]']];
      
      requestedFilters.forEach(filter => {
        if (filter && !filters.includes(filter.toUpperCase())) {
          filters.push(filter.toUpperCase());
        }
      });
    }
    
    // Make sure SPAM and AIRDROPS are included in filters
    if (!filters.includes('SPAM')) filters.push('SPAM');
    if (!filters.includes('AIRDROPS')) filters.push('AIRDROPS');
    
    // IMPORTANT: Alchemy API requires SPAM filter to be present when using spamConfidenceLevel
    // Add excludeFilters as comma-separated values - NOTE: Format changed to match Alchemy API requirements
    if (filters.length > 0) {
      // IMPORTANT CHANGE: Alchemy expects 'excludeFilters=SPAM,AIRDROPS' not 'excludeFilters[]'
      queryParams.set('excludeFilters', filters.join(','));
      console.log(`[API:Alchemy] Using excludeFilters: ${filters.join(',')}`);
    }
    
    // IMPORTANT: Add spamConfidenceLevel AFTER excludeFilters is set
    // spamConfidenceLevel requires excludeFilters to contain SPAM
    if (filters.includes('SPAM')) {
      // IMPORTANT: Make sure spamConfidenceLevel is explicitly added to the query parameters
      queryParams.append('spamConfidenceLevel', spamConfidenceLevel);
      console.log(`[API:Alchemy] Using spamConfidenceLevel: ${spamConfidenceLevel} for network ${networkParam}`);
    } else {
      console.warn(`[API:Alchemy] Cannot set spamConfidenceLevel because SPAM filter is not included`);
    }
    
    const apiUrl = `${baseUrl}/${endpoint}?${queryParams.toString()}`;
    
    // Log detailed URL for debugging purposes
    console.log(`[API:Alchemy] Forwarding request to Alchemy API: ${endpoint} on network ${networkEndpoint}`);
    console.log(`[API:Alchemy] Full URL parameters: ${queryParams.toString()}`);
    console.log(`[API:Alchemy] Final Alchemy URL: ${apiUrl}`);
    
    // Check if the spamConfidenceLevel is in the final URL
    if (!apiUrl.includes('spamConfidenceLevel=')) {
      console.warn(`[API:Alchemy] WARNING: spamConfidenceLevel parameter is missing in the URL!`);
    }
    
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
      
      console.log(`[API:Alchemy] Successful response from Alchemy API for ${networkEndpoint}`);
      
      // Add logging to track how many NFTs were filtered by spam/airdrops
      if (endpoint === 'getNFTsForOwner' && response.data && response.data.ownedNfts) {
        console.log(`[API:Alchemy] Received ${response.data.ownedNfts.length} NFTs after filtering with spamConfidenceLevel=${spamConfidenceLevel} and excludeFilters=${filters.join(',')}`);
        
        // Print the API key tier to check if it supports spam filtering
        console.log(`[API:Alchemy] API key begins with ${ALCHEMY_API_KEY ? ALCHEMY_API_KEY.substring(0, 4) + '...' : 'undefined'}`);
        
        // Debug: Check if API supports spam filtering by checking if there's a filteredOut property
        if (response.data.hasOwnProperty('filteredOutNfts') || response.data.hasOwnProperty('spamFiltered')) {
          console.log(`[API:Alchemy] Alchemy API provided filtered NFT info: filteredOutNfts=${response.data.filteredOutNfts ? response.data.filteredOutNfts.length : 'none'}, spamFiltered=${response.data.spamFiltered || 'none'}`);
        } else {
          console.log(`[API:Alchemy] WARNING: No filtering information found in Alchemy response. Make sure your API key tier supports spam filtering.`);
        }
        
        // Add metadata about filtering for client-side debugging
        response.data._diagnostic = {
          chain: networkParam,
          endpoint: endpoint,
          timestamp: new Date().toISOString(),
          filtering: {
            spamConfidenceLevel,
            excludeFilters: filters
          }
        };
      }
      
      return res.status(200).json(response.data);
    } catch (error) {
      console.error(`[API:Alchemy] Error with Alchemy API on ${networkEndpoint}:`, error.message);
      if (error.response?.data) {
        console.error('[API:Alchemy] Alchemy API error details:', error.response.data);
      }
      
      return res.status(error.response?.status || 502).json({ 
        error: 'Failed to fetch from Alchemy API',
        message: error.message,
        details: error.response?.data || null
      });
    }
  } catch (error) {
    console.error('[API:Alchemy] Error in Alchemy API proxy:', error);
    
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message
    });
  }
}