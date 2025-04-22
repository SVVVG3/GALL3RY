import axios from 'axios';
import { localStorageCache } from "../utils/cache";

// Constants
const API_URL = process.env.REACT_APP_API_URL || '/api';
const CACHE_EXPIRATION_TIME = 30 * 60 * 1000; // 30 minutes

// In-memory cache for profiles
const profileCache = new Map();

// Helper function to cache items in local storage or memory
const cacheItem = async (key, data, expirationMinutes = 60) => {
  try {
    await localStorageCache.setItem(key, data, expirationMinutes);
  } catch (e) {
    console.warn('Failed to cache in localStorage, using memory cache:', e.message);
    profileCache.set(key, {
      timestamp: Date.now(),
      data
    });
  }
};

// Helper function to get cached items from local storage or memory
const getCachedItem = async (key) => {
  try {
    const data = await localStorageCache.getItem(key);
    if (data) {
      return data;
    }
  } catch (e) {
    console.warn('Failed to retrieve from localStorage, checking memory cache:', e.message);
    const cachedData = profileCache.get(key);
    if (cachedData && Date.now() - cachedData.timestamp < CACHE_EXPIRATION_TIME) {
      return cachedData.data;
    }
  }
  return null;
};

/**
 * Formats a Farcaster user profile from API response into a consistent structure
 * @param {Object} userData - User data from Neynar API
 * @returns {Object} - Formatted user profile
 */
const formatFarcasterProfile = (userData) => {
  if (!userData) return null;
  
  // Extract connected addresses
  let connectedAddresses = [];
  
  // Handle different API response formats
  if (userData.verified_addresses?.eth_addresses) {
    connectedAddresses = userData.verified_addresses.eth_addresses.map(addr => addr.toLowerCase());
  } else if (userData.eth_addresses) {
    connectedAddresses = userData.eth_addresses.map(addr => addr.toLowerCase());
  }
  
  // Format the profile to match the app's expected structure
  return {
    fid: userData.fid,
    username: userData.username,
    metadata: {
      displayName: userData.display_name,
      description: userData.profile?.bio?.text,
      imageUrl: userData.pfp_url,
      warpcast: `https://warpcast.com/${userData.username}`
    },
    custodyAddress: userData.custody_address ? userData.custody_address.toLowerCase() : null,
    connectedAddresses: connectedAddresses,
    followerCount: userData.follower_count,
    followingCount: userData.following_count
  };
};

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
   * Gets a Farcaster profile by username or FID
   * @param {Object} params - Query parameters
   * @param {string} [params.username] - Farcaster username (without @)
   * @param {number} [params.fid] - Farcaster ID
   * @returns {Promise<Object|null>} Farcaster profile or null if not found
   */
  getProfile: async ({ username, fid }) => {
    // Validate input - either username or fid must be provided
    if (!username && !fid) {
      console.error('Either username or fid is required');
      return null;
    }

    const queryParam = username ? username.replace('@', '').trim() : fid;
    const isNumericFid = !isNaN(Number(queryParam));
    const cacheKey = `farcaster_profile_${queryParam.toLowerCase()}`;
    
    try {
      // Check cache first
      const cachedProfile = await getCachedItem(cacheKey);
      if (cachedProfile) {
        console.log(`Retrieved Farcaster profile from cache for ${queryParam}`);
        return cachedProfile;
      }
      
      console.log(`Fetching Farcaster profile for ${isNumericFid ? 'FID' : 'username'}: ${queryParam}`);
      
      let userData = null;
      let response = null;

      // Try the proxy API first
      try {
        if (isNumericFid) {
          response = await axios.get(`${API_URL}/api/neynar?endpoint=user&fid=${queryParam}`, { timeout: 10000 });
        } else {
          response = await axios.get(`${API_URL}/api/neynar?endpoint=user&username=${queryParam}`, { timeout: 10000 });
        }
        
        if (response?.data?.result?.user) {
          userData = response.data.result.user;
        }
      } catch (proxyError) {
        console.warn(`Proxy API failed for ${queryParam}, falling back to direct Neynar API:`, proxyError.message);
      }

      // If proxy failed, try direct Neynar API
      if (!userData) {
        console.log(`Attempting direct Neynar API call for ${queryParam}`);
        const NEYNAR_API_KEY = process.env.REACT_APP_NEYNAR_API_KEY || "NEYNAR_API_DOCS";
        
        try {
          if (isNumericFid) {
            response = await axios.get(`https://api.neynar.com/v2/farcaster/user?fid=${queryParam}`, {
              headers: { api_key: NEYNAR_API_KEY },
              timeout: 10000
            });
            if (response?.data?.user) {
              userData = response.data.user;
            }
          } else {
            response = await axios.get(`https://api.neynar.com/v2/farcaster/user/search?q=${queryParam}`, {
              headers: { api_key: NEYNAR_API_KEY },
              timeout: 10000
            });
            
            // Find exact username match in search results
            if (response?.data?.users) {
              const exactMatch = response.data.users.find(
                u => u.username.toLowerCase() === queryParam.toLowerCase()
              );
              if (exactMatch) userData = exactMatch;
            }
          }
        } catch (directApiError) {
          console.error(`Direct Neynar API failed for ${queryParam}:`, directApiError.message);
          throw directApiError;
        }
      }

      if (!userData) {
        console.warn(`No user data found for ${queryParam}`);
        return null;
      }

      // Format and cache the profile
      const formattedProfile = formatFarcasterProfile(userData);
      if (formattedProfile) {
        await cacheItem(cacheKey, formattedProfile, 5); // Cache for 5 minutes
        return formattedProfile;
      }
      
      return null;
    } catch (error) {
      console.error(`Error fetching Farcaster profile for ${queryParam}:`, error.message);
      console.error(error.stack);
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
      
      console.log(`Fetching addresses for Farcaster FID: ${fid}`);
      
      // Try to get the profile first
      try {
        const profile = await farcasterService.getProfile({ fid });
        
        if (!profile) {
          console.warn(`No profile found for FID: ${fid}, returning empty address array`);
          return []; // Return empty array instead of throwing to prevent UI breaks
        }
        
        console.log(`Found profile for FID ${fid}:`, { 
          username: profile.username, 
          hasCustodyAddress: !!profile.custodyAddress,
          hasConnectedAddresses: Array.isArray(profile.connectedAddresses) && profile.connectedAddresses.length > 0,
          connectedAddressCount: profile.connectedAddresses?.length || 0
        });
        
        // Combine custody address and connected addresses, ensuring no duplicates
        const allAddresses = new Set();
        
        // Add custody address if available
        if (profile.custodyAddress) {
          const lowerAddress = profile.custodyAddress.toLowerCase();
          allAddresses.add(lowerAddress);
          console.log(`Added custody address: ${lowerAddress}`);
        }
        
        // Add all connected addresses
        if (profile.connectedAddresses && profile.connectedAddresses.length > 0) {
          profile.connectedAddresses.forEach(addr => {
            if (addr) {
              const lowerAddr = addr.toLowerCase();
              allAddresses.add(lowerAddr);
              console.log(`Added connected address: ${lowerAddr}`);
            }
          });
        }
        
        const addressArray = Array.from(allAddresses);
        console.log(`Found ${addressArray.length} unique addresses for Farcaster FID: ${fid}`);
        
        if (addressArray.length === 0) {
          console.warn(`No addresses found for FID ${fid} even though profile exists`);
        }
        
        return addressArray;
      } catch (profileError) {
        console.error('Profile fetch error:', profileError.message);
        
        // Try direct API call to Neynar as fallback
        try {
          console.log('Trying direct Neynar API call for addresses');
          const NEYNAR_API_KEY = process.env.REACT_APP_NEYNAR_API_KEY || 'NEYNAR_API_DOCS';
          
          // First get basic user info to get custody address
          const userResponse = await axios({
            method: 'get',
            url: `https://api.neynar.com/v2/farcaster/user?fid=${fid}`,
            headers: {
              'Accept': 'application/json',
              'api_key': NEYNAR_API_KEY
            },
            timeout: 8000
          });
          
          const addresses = new Set();
          
          if (userResponse.data?.result?.user?.custody_address) {
            addresses.add(userResponse.data.result.user.custody_address.toLowerCase());
            console.log(`Added custody address from direct API: ${userResponse.data.result.user.custody_address}`);
          }
          
          // Then get verified addresses
          const verifiedAddressesResponse = await axios({
            method: 'get',
            url: `https://api.neynar.com/v2/farcaster/user/verified-addresses?fid=${fid}`,
            headers: {
              'Accept': 'application/json',
              'api_key': NEYNAR_API_KEY
            },
            timeout: 8000
          });
          
          if (verifiedAddressesResponse.data?.verified_addresses) {
            verifiedAddressesResponse.data.verified_addresses.forEach(addrObj => {
              if (addrObj.addr) {
                addresses.add(addrObj.addr.toLowerCase());
                console.log(`Added verified address from direct API: ${addrObj.addr}`);
              }
            });
          } else if (verifiedAddressesResponse.data?.result?.verified_addresses) {
            verifiedAddressesResponse.data.result.verified_addresses.forEach(addrObj => {
              if (addrObj.addr) {
                addresses.add(addrObj.addr.toLowerCase());
                console.log(`Added verified address from direct API: ${addrObj.addr}`);
              }
            });
          }
          
          const addressArray = Array.from(addresses);
          console.log(`Found ${addressArray.length} addresses via direct Neynar API`);
          
          return addressArray;
        } catch (directApiError) {
          console.error('Direct API call failed:', directApiError.message);
          throw directApiError;
        }
      }
    } catch (error) {
      console.error(`Error fetching addresses for FID ${fid}:`, error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack?.substring(0, 200)
      });
      
      // Return empty array instead of throwing to prevent UI breaks
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
   * Gets all addresses connected to a Farcaster user
   * @param {Object} params - Query parameters
   * @param {string} [params.username] - Farcaster username (without @)
   * @param {number} [params.fid] - Farcaster ID
   * @returns {Promise<Array<string>>} Array of connected Ethereum addresses (lowercase)
   */
  getFarcasterAddresses: async ({ username, fid }) => {
    try {
      const cacheKey = `farcaster_addresses_${username ? username.toLowerCase() : `fid_${fid}`}`;
      
      // Check cache first
      const cachedAddresses = await getCachedItem(cacheKey);
      if (cachedAddresses) {
        console.log(`Retrieved Farcaster addresses from cache for ${username || fid}`);
        return cachedAddresses;
      }
      
      // Get the user profile to extract addresses
      const profile = await farcasterService.getProfile({ username, fid });
      
      if (!profile) {
        console.warn(`No profile found for ${username || fid}, cannot get addresses`);
        return [];
      }
      
      // Collect all addresses from the profile
      const addresses = [];
      
      // Add custody address if it exists
      if (profile.custodyAddress) {
        addresses.push(profile.custodyAddress.toLowerCase());
      }
      
      // Add all connected addresses
      if (profile.connectedAddresses && profile.connectedAddresses.length) {
        profile.connectedAddresses.forEach(address => {
          // Only add Ethereum addresses (skip Solana)
          if (address && address.startsWith('0x')) {
            addresses.push(address.toLowerCase());
          }
        });
      }
      
      // Remove duplicates
      const uniqueAddresses = [...new Set(addresses)];
      
      // Cache the addresses
      await cacheItem(cacheKey, uniqueAddresses, 5); // Cache for 5 minutes
      
      return uniqueAddresses;
    } catch (error) {
      console.error(`Error fetching addresses for ${username || fid}:`, error.message);
      return [];
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