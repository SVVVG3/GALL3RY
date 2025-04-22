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
   * Gets users that a Farcaster user follows
   * @param {number} fid - Farcaster ID to fetch following for
   * @param {number} [limit=100] - Number of results to return
   * @param {string} [cursor] - Pagination cursor
   * @param {boolean} [fetchAll=false] - Whether to fetch all following across multiple pages
   * @returns {Promise<{users: Array, next: {cursor: string|null}}>} - Following users and pagination cursor
   */
  getUserFollowing: async (fid, limit = 100, cursor = null, fetchAll = false) => {
    try {
      // If fetchAll is true, delegate to fetchAllFollowing helper
      if (fetchAll) {
        console.log(`Fetching all following for FID ${fid}`);
        return await fetchAllFollowing(fid, limit);
      }
      
      const cacheKey = `following:${fid}:${limit}${cursor ? `:${cursor}` : ''}`;
      
      // Check for cached result
      const cachedResult = await getCachedItem(cacheKey);
      if (cachedResult) {
        console.log(`Retrieved following from cache for FID ${fid}`);
        return cachedResult;
      }
      
      console.log(`Fetching following for FID ${fid}, limit: ${limit}${cursor ? ', with cursor' : ''}`);
      
      let response;
      
      // First try with the proxy API
      try {
        // Request to following endpoint via proxy
        console.log(`Making API request to ${API_URL}/neynar with params:`, {
          endpoint: 'following',
          fid,
          limit,
          cursor: cursor || undefined
        });
        
        response = await axios.get(`${API_URL}/neynar`, {
          params: {
            endpoint: 'following',
            fid,
            limit,
            cursor
          },
          headers: {
            'api-key': process.env.REACT_APP_NEYNAR_API_KEY || 'NEYNAR_API_DOCS'
          },
          timeout: 10000
        });
        
        console.log('Proxy API responded with status:', response.status);
      } catch (proxyError) {
        console.warn(`❌ Proxy API failed for following of FID ${fid}:`, proxyError.message);
        
        // Try direct Neynar API as a fallback
        try {
          console.log('Attempting direct Neynar API call for following');
          const NEYNAR_API_KEY = process.env.REACT_APP_NEYNAR_API_KEY || 'NEYNAR_API_DOCS';
          
          // Build the direct API URL
          const neynarUrl = `https://api.neynar.com/v2/farcaster/following?fid=${fid}&limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`;
          console.log(`Direct API call to Neynar URL: ${neynarUrl}`);
          
          response = await axios.get(neynarUrl, {
            headers: { 
              'api_key': NEYNAR_API_KEY,
              'Accept': 'application/json'
            },
            timeout: 10000
          });
          
          console.log('Direct Neynar API responded with status:', response.status);
        } catch (directApiError) {
          console.error('❌ Direct Neynar API call failed:', directApiError.message);
          throw directApiError;
        }
      }
      
      // Log full response for debugging
      console.log('Raw API response from following endpoint:', {
        status: response.status,
        hasData: !!response.data,
        dataKeys: response.data ? Object.keys(response.data) : [],
        hasResultUsers: response.data?.result?.users ? true : false,
        usersCount: response.data?.result?.users?.length || 0
      });
      
      // Format response 
      const formattedResponse = {
        users: [],
        next: {
          cursor: null
        }
      };
      
      if (response.data) {
        // Check different response formats
        let usersList = [];
        
        if (response.data.result?.users && Array.isArray(response.data.result.users)) {
          usersList = response.data.result.users;
          console.log(`Found ${usersList.length} users in standard result.users format`);
        } else if (response.data.users && Array.isArray(response.data.users)) {
          usersList = response.data.users;
          console.log(`Found ${usersList.length} users in direct users format`);
        } else if (Array.isArray(response.data.result)) {
          usersList = response.data.result;
          console.log(`Found ${usersList.length} users in result array format`);
        } else {
          console.warn('Could not find users array in response. Available keys:', 
            Object.keys(response.data.result || response.data));
          
          // One more attempt to recursively find a users array
          const findUsersArray = (obj) => {
            if (!obj || typeof obj !== 'object') return null;
            
            // Check if this object has a 'users' property that is an array
            if (obj.users && Array.isArray(obj.users)) {
              return obj.users;
            }
            
            // Check all properties
            for (const key in obj) {
              if (obj[key] && typeof obj[key] === 'object') {
                const result = findUsersArray(obj[key]);
                if (result) return result;
              }
            }
            
            return null;
          };
          
          const foundUsers = findUsersArray(response.data);
          if (foundUsers) {
            usersList = foundUsers;
            console.log(`Found ${usersList.length} users by recursive search`);
          }
        }
        
        if (usersList.length > 0) {
          formattedResponse.users = usersList.map(user => {
            // Handle different user object formats
            const userData = user.user || user;
            
            return {
              fid: userData.fid,
              username: userData.username,
              displayName: userData.display_name,
              imageUrl: userData.pfp_url,
              bio: userData.profile?.bio || '',
              addresses: extractAddressesFromUserData(userData)
            };
          });
        }
        
        // Set pagination cursor if available
        if (response.data.result?.next?.cursor) {
          formattedResponse.next.cursor = response.data.result.next.cursor;
        } else if (response.data.next?.cursor) {
          formattedResponse.next.cursor = response.data.next.cursor;
        }
        
        console.log(`Found ${formattedResponse.users.length} following users for FID: ${fid}`);
      } else {
        console.warn('Invalid response format from API. Expected result.users array.');
        console.log('Response structure:', JSON.stringify(response.data, null, 2).substring(0, 500) + '...');
      }
      
      // Cache the result
      await cacheItem(cacheKey, formattedResponse, 5); // Cache for 5 minutes
      
      return formattedResponse;
    } catch (error) {
      console.error(`Error fetching following for FID ${fid}:`, error);
      
      // Log more detailed error information
      if (error.response) {
        console.error('Error response:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        });
      } else if (error.request) {
        console.error('No response received:', error.request);
      } else {
        console.error('Error message:', error.message);
      }
      
      // Return empty result with error
      return {
        users: [],
        next: { cursor: null },
        error: error.message
      };
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
  },
  
  getCast: async (fid) => {
    // Implementation of getCast method
  },
  
  getMentionSuggestions: async (query) => {
    // Implementation of getMentionSuggestions method
  },
  
  formatUserProfile: (userData) => {
    // Implementation of formatUserProfile method
  },
  
  fetchAllFollowing: async (fid, options = {}) => {
    try {
      const { skipCache = false, maxPages = 10 } = options;
      
      // Check if we already have the complete list cached
      const cacheKey = `all-following-${fid}`;
      if (!skipCache) {
        const cached = await getCachedItem(cacheKey);
        if (cached) {
          console.log(`✅ Using cached complete following list for FID ${fid}`);
          return {
            users: cached.users || [],
            success: true,
            fromCache: true,
            timestamp: cached.timestamp
          };
        }
      }
      
      console.log(`🔍 Fetching all following for FID ${fid} with pagination`);
      
      let allUsers = [];
      let hasMore = true;
      let cursor = null;
      let pageCount = 0;
      const pageSize = 100; // Maximum allowed by the API
      
      // Fetch all pages of followed users
      while (hasMore && pageCount < maxPages) {
        pageCount++;
        console.log(`📃 Fetching page ${pageCount} of following for FID ${fid}${cursor ? ' with cursor' : ''}`);
        
        const pageResult = await farcasterService.getUserFollowing(fid, pageSize, cursor);
        
        if (!pageResult || !Array.isArray(pageResult.users)) {
          console.error(`❌ Error fetching page ${pageCount} for FID ${fid}:`, pageResult?.error || 'No users array in response');
          break;
        }
        
        // Add users from this page to our collection
        allUsers = [...allUsers, ...pageResult.users];
        
        // Update cursor and check if we should continue
        cursor = pageResult.next?.cursor;
        hasMore = !!cursor && pageResult.users.length > 0;
        
        console.log(`✅ Added ${pageResult.users.length} users from page ${pageCount}, total: ${allUsers.length}`);
        
        // If we didn't get a full page, we're probably at the end
        if (pageResult.users.length < pageSize) {
          hasMore = false;
        }
      }
      
      // Create the result object
      const result = {
        users: allUsers,
        success: true,
        totalCount: allUsers.length,
        pagesRetrieved: pageCount,
        maxPagesReached: pageCount >= maxPages,
        timestamp: new Date().toISOString()
      };
      
      // Cache the result for future requests (valid for 15 minutes)
      await cacheItem(cacheKey, result, 15 * 60 * 1000);
      
      console.log(`✅ Completed fetching all following for FID ${fid}: ${allUsers.length} users across ${pageCount} pages`);
      
      return result;
    } catch (error) {
      console.error(`❌ Error in fetchAllFollowing for FID ${fid}:`, error.message);
      return {
        users: [],
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
};

/**
 * Helper function to extract addresses from user data
 * Handles different API response formats
 */
const extractAddressesFromUserData = (userData) => {
  try {
    // Check various possible paths where addresses could be located
    let addresses = [];
    
    // Check verified_addresses.eth_addresses path (common in newer API)
    if (userData.verified_addresses?.eth_addresses) {
      addresses = [...addresses, ...userData.verified_addresses.eth_addresses];
      console.log(`Found ${addresses.length} addresses in verified_addresses.eth_addresses`);
    }
    
    // Check direct eth_addresses array
    if (Array.isArray(userData.eth_addresses)) {
      addresses = [...addresses, ...userData.eth_addresses];
      console.log(`Found ${addresses.length} addresses in eth_addresses`);
    }
    
    // Check addresses array directly
    if (Array.isArray(userData.addresses)) {
      addresses = [...addresses, ...userData.addresses];
      console.log(`Found ${addresses.length} addresses in addresses array`);
    }
    
    // Check custody_address
    if (userData.custody_address) {
      addresses.push(userData.custody_address);
      console.log('Added custody address');
    }
    
    // Remove duplicates and standardize to lowercase
    if (addresses.length > 0) {
      return [...new Set(addresses.map(addr => addr.toLowerCase()))];
    }
    
    return [];
  } catch (err) {
    console.error('Error extracting addresses from user data:', err);
    return [];
  }
};

export default farcasterService;

// Export individual functions for direct import
export const { fetchAddressesForFid, searchUsers, clearCache } = farcasterService;

// Also export the fetchAllFollowing function
export const fetchAllFollowing = farcasterService.fetchAllFollowing;