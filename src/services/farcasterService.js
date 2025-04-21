import axios from 'axios';

// Constants
const API_URL = process.env.REACT_APP_API_URL || '/api';
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
      
      console.log(`Making API request to ${API_URL}/neynar for user search with query: "${query}"`);
      
      // Use our proxy endpoint instead of calling Neynar directly
      const response = await axios.get(`${API_URL}/neynar`, {
        params: {
          endpoint: 'user/search',
          q: query,
          limit
        }
      });
      
      console.log('Raw API response:', response.data);
      
      // Handle different response formats
      let usersData = [];
      
      // Check if response is in format { users: [...] }
      if (response.data && response.data.users) {
        usersData = response.data.users;
        console.log('Found users in direct users array format');
      } 
      // Check if response is in format { result: { users: [...] } }
      else if (response.data && response.data.result && response.data.result.users) {
        usersData = response.data.result.users;
        console.log('Found users in result.users format');
      }
      // Check if array is wrapped in some other property
      else {
        // Try to find an array in the response that might contain users
        for (const key in response.data) {
          if (Array.isArray(response.data[key])) {
            if (response.data[key].length > 0 && response.data[key][0].fid) {
              usersData = response.data[key];
              console.log(`Found user array in response.data.${key}`);
              break;
            }
          } else if (typeof response.data[key] === 'object' && response.data[key] !== null) {
            // Check second level properties for arrays
            for (const subKey in response.data[key]) {
              if (Array.isArray(response.data[key][subKey])) {
                if (response.data[key][subKey].length > 0 && response.data[key][subKey][0].fid) {
                  usersData = response.data[key][subKey];
                  console.log(`Found user array in response.data.${key}.${subKey}`);
                  break;
                }
              }
            }
          }
        }
      }
      
      if (usersData.length === 0) {
        console.warn('No users found in API response:', response.data);
        return [];
      }
      
      console.log('Found users data:', usersData);
      
      // Format the response to match the structure expected by the app
      const users = usersData.map(user => ({
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
      
      console.log(`Processed ${users.length} user suggestions from API response`);
      
      // Cache the result
      profileCache.set(cacheKey, {
        timestamp: Date.now(),
        data: users
      });
      
      return users;
    } catch (error) {
      console.error('Error searching Farcaster users:', error);
      console.error('Error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
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
      
      // Determine the API parameters based on input type
      let endpoint, params;
      
      if (username) {
        endpoint = 'user/search';
        params = { q: username, limit: 1 };
      } else {
        endpoint = 'user';
        params = { fid };
      }
      
      // Make request through our proxy
      const response = await axios.get(`${API_URL}/neynar`, {
        params: {
          endpoint,
          ...params
        }
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
          const addressesResponse = await axios.get(`${API_URL}/neynar`, {
            params: {
              endpoint: 'user/verified-addresses',
              fid: userData.fid
            }
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
   * Fetch wallet addresses associated with a Farcaster FID
   * @param {number} fid - Farcaster FID 
   * @returns {Promise<string[]>} - Array of wallet addresses
   */
  fetchAddressesForFid: async (fid) => {
    try {
      if (!fid) {
        throw new Error('FID is required');
      }
      
      // Try to get the profile first
      const profile = await farcasterService.getProfile({ fid });
      
      if (!profile) {
        throw new Error(`No profile found for FID: ${fid}`);
      }
      
      // Combine custody address and connected addresses, ensuring no duplicates
      const allAddresses = new Set();
      
      // Add custody address if available
      if (profile.custodyAddress) {
        allAddresses.add(profile.custodyAddress.toLowerCase());
      }
      
      // Add all connected addresses
      if (profile.connectedAddresses && profile.connectedAddresses.length > 0) {
        profile.connectedAddresses.forEach(addr => {
          if (addr) allAddresses.add(addr.toLowerCase());
        });
      }
      
      console.log(`Found ${allAddresses.size} unique addresses for Farcaster FID: ${fid}`);
      
      return Array.from(allAddresses);
    } catch (error) {
      console.error(`Error fetching addresses for FID ${fid}:`, error);
      return [];
    }
  },
  
  /**
   * Get users that a Farcaster user follows
   * @param {number} fid - Farcaster FID of the user
   * @param {number} [limit=25] - Maximum number of results to return
   * @param {string} [cursor] - Pagination cursor for fetching next page
   * @returns {Promise<{users: Array, next: {cursor: string|null}}>} - Array of following users and pagination info
   */
  getUserFollowing: async (fid, limit = 25, cursor = null) => {
    try {
      if (!fid) {
        throw new Error('FID is required');
      }
      
      // Check cache first
      const cacheKey = `following:${fid}:${limit}:${cursor || 'initial'}`;
      const cachedResult = profileCache.get(cacheKey);
      
      if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_EXPIRATION_TIME) {
        console.log('Using cached following list');
        return cachedResult.data;
      }
      
      // Build params for the request
      const params = {
        endpoint: 'following',
        fid,
        limit,
      };
      
      // Add cursor if provided
      if (cursor) {
        params.cursor = cursor;
      }
      
      console.log(`Fetching following list for FID: ${fid}`);
      
      // Make request to Neynar through our proxy
      const response = await axios.get(`${API_URL}/neynar`, { params });
      
      // Format the response consistently
      let following = {
        users: [],
        next: { cursor: null }
      };
      
      // Parse response based on format returned from API
      if (response.data?.users) {
        following.users = response.data.users.map(user => ({
          fid: user.user.fid,
          username: user.user.username,
          displayName: user.user.display_name || user.user.username,
          imageUrl: user.user.pfp_url,
          bio: user.user.profile?.bio?.text,
          addresses: [
            user.user.custody_address,
            ...(user.user.verified_addresses?.eth_addresses || [])
          ].filter(Boolean).map(addr => addr.toLowerCase())
        }));
        
        // Get pagination cursor if available
        following.next.cursor = response.data.next?.cursor || null;
      } else if (response.data?.result?.users) {
        // Handle v2 API format
        following.users = response.data.result.users.map(user => ({
          fid: user.user.fid,
          username: user.user.username,
          displayName: user.user.display_name || user.user.username,
          imageUrl: user.user.pfp_url,
          bio: user.user.profile?.bio?.text,
          addresses: [
            user.user.custody_address,
            ...(user.user.verified_addresses?.eth_addresses || [])
          ].filter(Boolean).map(addr => addr.toLowerCase())
        }));
        
        // Get pagination cursor if available
        following.next.cursor = response.data.result.next?.cursor || null;
      }
      
      console.log(`Found ${following.users.length} following users for FID: ${fid}`);
      
      // Cache the result
      profileCache.set(cacheKey, {
        timestamp: Date.now(),
        data: following
      });
      
      return following;
    } catch (error) {
      console.error(`Error fetching following list for FID ${fid}:`, error);
      console.error('Error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      });
      
      return { users: [], next: { cursor: null } };
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

// Export individual functions for direct import
export const { fetchAddressesForFid, getUserFollowing, getProfile, searchUsers, clearCache } = farcasterService; 