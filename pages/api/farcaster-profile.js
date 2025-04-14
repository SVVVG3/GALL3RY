/**
 * API route for fetching Farcaster profiles
 * 
 * This endpoint acts as a proxy to the Neynar API, but preserves the format that
 * our frontend expects from the original Zapper API.
 */

import axios from 'axios';

// Constants
const NEYNAR_API_URL = 'https://api.neynar.com/v2/farcaster';
const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY || process.env.REACT_APP_NEYNAR_API_KEY;

// In-memory cache with 15-minute expiration
const cache = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }
  
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
    
    // If no NEYNAR_API_KEY is provided, return a helpful error
    if (!NEYNAR_API_KEY) {
      return res.status(500).json({ 
        success: false, 
        message: 'Missing Neynar API key. Please add NEYNAR_API_KEY to your environment variables.' 
      });
    }
    
    console.log(`Requesting Farcaster profile for ${username ? `username: ${username}` : `fid: ${fid}`}`);
    
    // Determine the API endpoint based on input type
    let neynarEndpoint, params;
    
    if (username) {
      // For username search, use the search endpoint
      neynarEndpoint = `${NEYNAR_API_URL}/user/search`;
      params = { q: username, limit: 1 };
    } else {
      // For FID lookup, use the user endpoint
      neynarEndpoint = `${NEYNAR_API_URL}/user`;
      params = { fid };
    }
    
    // Make request to Neynar API
    const response = await axios.get(neynarEndpoint, {
      headers: {
        'accept': 'application/json',
        'api_key': NEYNAR_API_KEY
      },
      params
    });
    
    // For username search, extract the matching user
    let userData;
    
    if (username) {
      const users = response.data.users || [];
      // Try to find exact match first
      userData = users.find(u => u.username.toLowerCase() === username.toLowerCase());
      
      // If no exact match, use the first result
      if (!userData && users.length > 0) {
        userData = users[0];
      }
    } else {
      // For FID lookup, use the direct response
      userData = response.data.user;
    }
    
    if (!userData) {
      return res.status(404).json({ 
        success: false, 
        message: `Farcaster profile not found for ${username ? `username: ${username}` : `fid: ${fid}`}` 
      });
    }
    
    // Get verified addresses for this user
    let connectedAddresses = [];
    try {
      if (userData.fid) {
        const addressesResponse = await axios.get(`${NEYNAR_API_URL}/user/verified-addresses`, {
          headers: {
            'accept': 'application/json',
            'api_key': NEYNAR_API_KEY
          },
          params: { fid: userData.fid }
        });
        
        connectedAddresses = addressesResponse.data.verified_addresses?.map(a => a.addr.toLowerCase()) || [];
      }
    } catch (addressError) {
      console.warn('Could not fetch verified addresses:', addressError.message);
    }
    
    // Transform the Neynar response to match the Zapper API format
    // that our frontend expects
    const formattedProfile = {
      username: userData.username,
      fid: userData.fid,
      metadata: {
        displayName: userData.display_name,
        description: userData.profile?.bio?.text,
        imageUrl: userData.pfp_url || userData.profile?.pfp?.url,
        warpcast: `https://warpcast.com/${userData.username}`
      },
      custodyAddress: userData.custody_address,
      connectedAddresses: connectedAddresses,
      followerCount: userData.follower_count,
      followingCount: userData.following_count
    };
    
    // Cache the profile
    cache.set(cacheKey, {
      timestamp: Date.now(),
      data: formattedProfile
    });
    
    // Return the formatted profile
    return res.status(200).json(formattedProfile);
  } catch (error) {
    console.error('Error fetching Farcaster profile:', error);
    
    return res.status(500).json({ 
      success: false, 
      message: error.message || 'Failed to fetch Farcaster profile',
      error: error.response?.data || error.toString()
    });
  }
} 