import axios from 'axios';

// Constants
const NEYNAR_API_URL = 'https://api.neynar.com/v2/farcaster';
const NEYNAR_API_KEY = process.env.REACT_APP_NEYNAR_API_KEY;
const CACHE_EXPIRATION_TIME = 30 * 60 * 1000; // 30 minutes

// In-memory cache for profiles
const profileCache = new Map();

/**
 * Service for interacting with Farcaster data
 */
const farcasterService = {
  /**
   * Search for Farcaster users by username
   * 
   * @param {string} query - Username or search string
   * @param {number} limit - Maximum number of results (default: 5)
   * @returns {Promise<Array>} - Array of user profiles
   */
  searchUsers: async (query, limit = 5) => {
    try {
      // Check cache first
      const cacheKey = `search:${query}:${limit}`;
      const cachedResult = profileCache.get(cacheKey);
      
      if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_EXPIRATION_TIME) {
        console.log('Using cached Farcaster profile search result');
        return cachedResult.data;
      }
      
      // Make request to Neynar API
      const response = await axios.get(`${NEYNAR_API_URL}/user/search`, {
        headers: {
          'accept': 'application/json',
          'api_key': NEYNAR_API_KEY
        },
        params: {
          q: query,
          limit
        }
      });
      
      // Format the response to match the structure expected by the app
      const users = response.data.users?.map(user => ({
        fid: user.fid,
        username: user.username,
        displayName: user.display_name,
        imageUrl: user.pfp_url,
        bio: user.profile?.bio?.text,
        followerCount: user.follower_count,
        followingCount: user.following_count,
        // Neynar doesn't provide connected addresses in search results
        connectedAddresses: []
      })) || [];
      
      // Cache the result
      profileCache.set(cacheKey, {
        timestamp: Date.now(),
        data: users
      });
      
      return users;
    } catch (error) {
      console.error('Error searching Farcaster users:', error);
      return [];
    }
  },
  
  /**
   * Get a Farcaster user profile by username or FID
   * 
   * @param {Object} params - Parameters
   * @param {string} [params.username] - Farcaster username
   * @param {number} [params.fid] - Farcaster ID
   * @returns {Promise<Object|null>} - User profile or null if not found
   */
  getProfile: async ({ username, fid }) => {
    try {
      if (!username && !fid) {
        throw new Error('Either username or fid must be provided');
      }
      
      // Check cache first
      const cacheKey = username ? `username:${username}` : `fid:${fid}`;
      const cachedProfile = profileCache.get(cacheKey);
      
      if (cachedProfile && Date.now() - cachedProfile.timestamp < CACHE_EXPIRATION_TIME) {
        console.log('Using cached Farcaster profile');
        return cachedProfile.data;
      }
      
      // Determine the API endpoint based on input type
      let endpoint, params;
      
      if (username) {
        endpoint = `${NEYNAR_API_URL}/user/search`;
        params = { q: username, limit: 1 };
      } else {
        endpoint = `${NEYNAR_API_URL}/user`;
        params = { fid };
      }
      
      // Make request to Neynar API
      const response = await axios.get(endpoint, {
        headers: {
          'accept': 'application/json',
          'api_key': NEYNAR_API_KEY
        },
        params
      });
      
      // Extract the user data from the response
      let userData;
      
      if (username) {
        // For username search, get the first result if it matches exactly
        const users = response.data.users || [];
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
        return null;
      }
      
      // Get verified addresses for this user if possible
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
      
      // Format the profile to match the structure expected by the app
      const profile = {
        fid: userData.fid,
        username: userData.username,
        metadata: {
          displayName: userData.display_name,
          description: userData.profile?.bio?.text,
          imageUrl: userData.pfp_url,
          warpcast: `https://warpcast.com/${userData.username}`
        },
        custodyAddress: userData.custody_address,
        connectedAddresses: connectedAddresses,
        followerCount: userData.follower_count,
        followingCount: userData.following_count
      };
      
      // Cache the profile
      profileCache.set(cacheKey, {
        timestamp: Date.now(),
        data: profile
      });
      
      // Also cache by the alternative ID
      if (username && profile.fid) {
        profileCache.set(`fid:${profile.fid}`, {
          timestamp: Date.now(),
          data: profile
        });
      } else if (fid && profile.username) {
        profileCache.set(`username:${profile.username}`, {
          timestamp: Date.now(),
          data: profile
        });
      }
      
      return profile;
    } catch (error) {
      console.error('Error fetching Farcaster profile:', error);
      return null;
    }
  },
  
  /**
   * Clear the profile cache
   */
  clearCache: () => {
    profileCache.clear();
  }
};

export default farcasterService; 