/**
 * API route for fetching Farcaster profiles
 * 
 * This endpoint uses the Zapper API to retrieve Farcaster profile data.
 */

import axios from 'axios';

// Constants
const ZAPPER_API_ENDPOINTS = [
  'https://api.zapper.fi/v2/graphql',
  'https://public.zapper.xyz/graphql',
  'https://api.zapper.xyz/v2/graphql'
];

const ZAPPER_API_KEY = process.env.ZAPPER_API_KEY || process.env.REACT_APP_ZAPPER_API_KEY || 'zapper-gallery';

// In-memory cache with 15-minute expiration
const cache = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }
  
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
  
  try {
    // Extract query parameters
    const { username, fid } = req.query;
    
    if (!username && !fid) {
      return res.status(400).json({ 
        success: false, 
        message: 'Either username or fid parameter is required' 
      });
    }
    
    // Generate cache key
    const cacheKey = username ? `username:${username}` : `fid:${fid}`;
    
    // Check cache first
    if (cache.has(cacheKey)) {
      const cachedData = cache.get(cacheKey);
      if (Date.now() - cachedData.timestamp < CACHE_TTL) {
        console.log(`Using cached profile for ${username || fid}`);
        return res.status(200).json(cachedData.data);
      } else {
        // Remove expired cache entry
        cache.delete(cacheKey);
      }
    }
    
    // Build the GraphQL query based on provided parameters
    const query = `
      query GetFarcasterProfile(${fid ? '$fid: Int' : '$username: String'}) {
        farcasterProfile(${fid ? 'fid: $fid' : 'username: $username'}) {
          username
          fid
          metadata {
            displayName
            description
            imageUrl
            warpcast
          }
          custodyAddress
          connectedAddresses
          followerCount
          followingCount
        }
      }
    `;

    // Prepare variables
    const variables = fid ? { fid: parseInt(fid, 10) } : { username };
    
    // Try each Zapper API endpoint until one succeeds
    let lastError = null;
    
    for (const endpoint of ZAPPER_API_ENDPOINTS) {
      try {
        console.log(`Trying Zapper endpoint ${endpoint} for Farcaster profile...`);
        
        // Make request to Zapper API
        const response = await axios({
          method: 'post',
          url: endpoint,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-API-KEY': ZAPPER_API_KEY,
            'User-Agent': 'GALL3RY/1.0 (+https://gall3ry.vercel.app)'
          },
          data: {
            query,
            variables
          },
          timeout: 10000 // 10 second timeout
        });
        
        // Check for GraphQL errors
        if (response.data?.errors) {
          console.warn('GraphQL errors from Zapper:', JSON.stringify(response.data.errors));
          
          // Store error but continue trying other endpoints
          lastError = new Error(response.data.errors[0]?.message || 'Unknown GraphQL error');
          lastError.response = { data: response.data.errors };
          continue;
        }
        
        // Extract profile data
        const profileData = response.data?.data?.farcasterProfile;
        
        if (!profileData) {
          console.warn(`No profile data returned from ${endpoint}`);
          continue;
        }
        
        console.log(`Successfully found profile for ${username || fid} via ${endpoint}`);
        
        // Cache the profile
        cache.set(cacheKey, {
          timestamp: Date.now(),
          data: profileData
        });
        
        // Return the profile data
        return res.status(200).json(profileData);
      } catch (error) {
        console.error(`Error with Zapper endpoint ${endpoint}:`, error.message);
        lastError = error;
        // Continue to the next endpoint
      }
    }
    
    // If we get here, all endpoints failed
    console.error('All Zapper endpoints failed for Farcaster profile');
    
    if (lastError?.response?.data?.errors) {
      return res.status(400).json({
        error: 'GraphQL Error',
        message: lastError.message,
        details: lastError.response.data.errors
      });
    }
    
    return res.status(lastError?.response?.status || 500).json({
      error: 'Error fetching Farcaster profile',
      message: lastError?.message || 'Failed to fetch profile from all Zapper endpoints',
      details: lastError?.response?.data
    });
  } catch (error) {
    console.error('Unexpected error in Farcaster profile API:', error.message);
    
    return res.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
      details: error.stack
    });
  }
} 