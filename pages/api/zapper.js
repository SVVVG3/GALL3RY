/**
 * API proxy for Zapper GraphQL API
 * 
 * This endpoint forwards GraphQL requests to the Zapper API
 * with proper authentication headers. It tries multiple Zapper
 * endpoints to increase reliability.
 */

import axios from 'axios';

// Constants
const ZAPPER_API_ENDPOINTS = [
  'https://api.zapper.fi/v2/graphql',
  'https://public.zapper.xyz/graphql',
  'https://api.zapper.xyz/v2/graphql'
];

const ZAPPER_API_KEY = process.env.ZAPPER_API_KEY || process.env.REACT_APP_ZAPPER_API_KEY || 'zapper-gallery';

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
    
    // Farcaster profile check - just for logging, we'll try all Zapper endpoints
    const isFarcasterRequest = query.includes('farcasterProfile');
    if (isFarcasterRequest) {
      console.log(`Farcaster profile request for ${variables?.username || variables?.fid || 'unknown user'}`);
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
              'X-API-KEY': ZAPPER_API_KEY,
              'User-Agent': 'GALL3RY/1.0 (+https://gall3ry.vercel.app)'
            },
            timeout: 10000 // 10 second timeout
          }
        );
        
        // Check for GraphQL errors and data existence
        if (response.data?.errors && !response.data?.data) {
          console.warn(`GraphQL errors from ${endpoint}:`, JSON.stringify(response.data.errors));
          
          // Store error but continue trying other endpoints
          lastError = new Error(response.data.errors[0]?.message || 'Unknown GraphQL error');
          lastError.response = { data: response.data };
          continue;
        }
        
        // For Farcaster profile requests, verify we got a profile
        if (isFarcasterRequest && !response.data?.data?.farcasterProfile) {
          console.warn(`Endpoint ${endpoint} did not return a Farcaster profile`);
          continue;
        }
        
        // If successful response, return it
        console.log(`Successful response from ${endpoint}`);
        return res.status(200).json(response.data);
      } catch (error) {
        console.error(`Error with Zapper endpoint ${endpoint}:`, error.message);
        lastError = error;
        // Continue to next endpoint
      }
    }
    
    // If we get here, all endpoints failed
    console.error('All Zapper API endpoints failed');
    
    if (lastError?.response?.data?.errors) {
      return res.status(500).json({ 
        errors: lastError.response.data.errors
      });
    }
    
    return res.status(lastError?.response?.status || 502).json({ 
      errors: [{
        message: `All Zapper API endpoints failed: ${lastError?.message || 'Unknown error'}`,
        extensions: {
          details: lastError?.response?.data
        }
      }]
    });
  } catch (error) {
    console.error('Error in Zapper API proxy:', error);
    
    return res.status(500).json({ 
      errors: [{
        message: error.message || 'Internal server error',
        extensions: {
          details: error.response?.data || error.toString()
        }
      }]
    });
  }
} 