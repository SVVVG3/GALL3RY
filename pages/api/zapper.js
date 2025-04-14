/**
 * API proxy for Zapper GraphQL API
 * 
 * This endpoint forwards GraphQL requests to the Zapper API
 * with proper authentication headers.
 */

import axios from 'axios';

// Constants
const ZAPPER_API_ENDPOINTS = [
  'https://api.zapper.xyz/v2/graphql',
  'https://api.zapper.fi/v2/graphql',
  'https://public.zapper.xyz/graphql'
];

const ZAPPER_API_KEY = process.env.ZAPPER_API_KEY || process.env.REACT_APP_ZAPPER_API_KEY || 'zapper-gallery';

export default async function handler(req, res) {
  // Only allow POST for GraphQL
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    // Extract the GraphQL query and variables
    const { query, variables } = req.body;
    
    if (!query) {
      return res.status(400).json({ success: false, message: 'GraphQL query is required' });
    }
    
    // Try each Zapper endpoint
    let lastError = null;
    for (const endpoint of ZAPPER_API_ENDPOINTS) {
      try {
        console.log(`Trying Zapper endpoint: ${endpoint}`);
        
        // Make request to Zapper API
        const response = await axios.post(endpoint, 
          { query, variables },
          { 
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'X-API-KEY': ZAPPER_API_KEY
            }
          }
        );
        
        // If Zapper gives a successful response, return it
        return res.status(200).json(response.data);
      } catch (error) {
        console.error(`Error with Zapper endpoint ${endpoint}:`, error.message);
        lastError = error;
      }
    }
    
    // If all endpoints failed, check if this was a Farcaster profile request
    // and try the fallback endpoint
    if (query.includes('farcasterProfile') && variables && (variables.username || variables.fid)) {
      console.log('Farcaster profile request detected, trying fallback endpoint');
      
      // Redirect to our farcaster-profile endpoint
      const param = variables.username ? `username=${variables.username}` : `fid=${variables.fid}`;
      const fallbackUrl = `/api/farcaster-profile?${param}`;
      
      try {
        const fallbackResponse = await axios.get(`${req.headers.host}${fallbackUrl}`);
        
        // Format the response to match GraphQL
        return res.status(200).json({
          data: {
            farcasterProfile: fallbackResponse.data
          }
        });
      } catch (fallbackError) {
        console.error('Fallback endpoint also failed:', fallbackError.message);
      }
    }
    
    // If we get here, all endpoints failed
    return res.status(502).json({ 
      success: false, 
      message: 'All Zapper API endpoints failed',
      error: lastError?.response?.data || lastError?.message || 'Unknown error'
    });
  } catch (error) {
    console.error('Error in Zapper API proxy:', error);
    
    return res.status(500).json({ 
      success: false, 
      message: error.message || 'Internal server error',
      error: error.response?.data || error.toString()
    });
  }
} 