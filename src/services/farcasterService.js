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

// Helper function to clear a specific cache item
const clearCacheItem = async (key) => {
  try {
    // Clear from localStorage
    await localStorageCache.removeItem(key);
    // Clear from memory cache
    profileCache.delete(key);
    console.log(`Cache cleared for key: ${key}`);
  } catch (e) {
    console.warn(`Failed to clear cache for key ${key}:`, e.message);
  }
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
      // Validate inputs
      if (!query || typeof query !== 'string') {
        console.error('Invalid query provided to searchUsers:', query);
        return [];
      }
      
      // Sanitize the query
      const sanitizedQuery = query.trim();
      if (sanitizedQuery.length === 0) {
        console.log('Empty query after trimming, returning empty results');
        return [];
      }
      
      // Check cache first
      const cacheKey = `search:${sanitizedQuery}:${limit}`;
      const cachedResult = profileCache.get(cacheKey);
      
      if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_EXPIRATION_TIME) {
        console.log(`Using cached Farcaster profile search result for "${sanitizedQuery}"`);
        return cachedResult.data;
      }
      
      console.log(`Making API request to ${API_URL}/neynar for user search with query: "${sanitizedQuery}"`);
      
      let response;
      // Try our proxy endpoint first
      try {
        response = await axios.get(`${API_URL}/neynar`, {
          params: {
            endpoint: 'user/search',
            q: sanitizedQuery,
            limit
          },
          timeout: 8000 // 8 second timeout
        });
      } catch (proxyError) {
        console.error('Proxy endpoint failed:', proxyError.message);
        
        // Fall back to direct Neynar API if proxy fails
        console.log('Falling back to direct Neynar API for search');
        const NEYNAR_API_KEY = process.env.REACT_APP_NEYNAR_API_KEY || "NEYNAR_API_DOCS";
        
        response = await axios.get(`https://api.neynar.com/v2/farcaster/user/search`, {
          params: { q: sanitizedQuery, limit },
          headers: { api_key: NEYNAR_API_KEY },
          timeout: 8000
        });
      }
      
      if (!response || !response.data) {
        console.error('Empty or invalid response from API');
        return [];
      }
      
      console.log('Raw API response received');
      
      // Handle different response formats
      let usersData = [];
      
      // Check if response is in format { users: [...] }
      if (response.data && Array.isArray(response.data.users)) {
        usersData = response.data.users;
        console.log('Found users in direct users array format');
      } 
      // Check if response is in format { result: { users: [...] } }
      else if (response.data?.result && Array.isArray(response.data.result.users)) {
        usersData = response.data.result.users;
        console.log('Found users in result.users format');
      }
      // If we're getting direct array response
      else if (Array.isArray(response.data)) {
        usersData = response.data;
        console.log('API returned direct array of users');
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
      
      if (!Array.isArray(usersData) || usersData.length === 0) {
        console.warn('No users found in API response or invalid format');
        return [];
      }
      
      console.log(`Found ${usersData.length} users in API response`);
      
      // Format the response to match the structure expected by the app
      const users = usersData.map(user => {
        // Validate user object
        if (!user || typeof user !== 'object') return null;
        
        return {
          // Required fields - use fallbacks if missing
          fid: user.fid || 0,
          username: user.username || '',
          
          // Optional fields with fallbacks
          displayName: user.display_name || user.displayName || user.username || '',
          imageUrl: user.pfp_url || user.pfpUrl || user.profile?.pfp?.url || '',
          bio: user.profile?.bio?.text || user.bio || '',
          followerCount: user.follower_count || user.followerCount || 0,
          followingCount: user.following_count || user.followingCount || 0,
          
          // Neynar doesn't provide connected addresses in search results
          connectedAddresses: []
        };
      }).filter(user => user !== null && user.fid && user.username); // Filter out invalid users
      
      console.log(`Processed ${users.length} valid user suggestions from API response`);
      
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
      
      // Force refresh for debugging - remove after fixing
      await clearCacheItem(cacheKey);
      console.log(`Forcing fresh data for FID ${fid} by clearing cache`);
      
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
          
          // Build the direct API URL as per the docs
          const neynarUrl = `https://api.neynar.com/v2/farcaster/following?fid=${fid}&limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`;
          console.log(`Direct API call to Neynar URL: ${neynarUrl}`);
          
          response = await axios.get(neynarUrl, {
            headers: { 
              'x-api-key': NEYNAR_API_KEY,
              'Accept': 'application/json'
            },
            timeout: 15000
          });
          
          console.log('Direct Neynar API responded with status:', response.status);
          // Log full response for debugging
          console.log('Full response from direct API:', response.data);
        } catch (directApiError) {
          console.error('❌ Direct Neynar API call failed:', directApiError.message);
          if (directApiError.response) {
            console.error('Error response data:', directApiError.response.data);
            console.error('Error response status:', directApiError.response.status);
          }
          throw directApiError;
        }
      }
      
      // Log full response for debugging
      console.log('Raw API response structure:', {
        status: response.status,
        hasData: !!response.data,
        dataKeys: response.data ? Object.keys(response.data) : [],
        hasUsers: response.data?.users ? true : false,
        usersCount: response.data?.users?.length || 0
      });
      
      // Format response according to Neynar API structure
      const formattedResponse = {
        users: [],
        next: {
          cursor: null
        }
      };
      
      if (response.data) {
        // Check for users array directly as per Neynar docs
        if (response.data.users && Array.isArray(response.data.users)) {
          console.log(`Found ${response.data.users.length} users in standard users format`);
          
          formattedResponse.users = response.data.users.map(item => {
            // Handle nested user object structure as in Neynar docs
            const user = item.user || item;
            
            return {
              fid: user.fid,
              username: user.username,
              displayName: user.display_name,
              imageUrl: user.pfp_url,
              bio: user.profile?.bio?.text || '',
              addresses: extractAddressesFromUserData(user)
            };
          });
          
          // Set pagination cursor if available
          if (response.data.next && response.data.next.cursor) {
            formattedResponse.next.cursor = response.data.next.cursor;
          }
        } else {
          console.warn('Could not find users array in response. Available keys:', 
            Object.keys(response.data));
          
          // Try to extract from different response formats if needed
          console.log('Full response data (first 1000 chars):', 
            JSON.stringify(response.data).substring(0, 1000));
        }
        
        console.log(`Extracted ${formattedResponse.users.length} following users for FID: ${fid}`);
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
      // Exit early if no username or fid provided
      if (!username && !fid) {
        console.error('getFarcasterAddresses: No username or fid provided');
        return null;
      }

      // Check if we have the addresses cached
      const cacheKey = username 
        ? `farcaster_addresses_${username.toLowerCase().replace('@', '')}` 
        : `farcaster_addresses_fid_${fid}`;
      
      const cachedAddresses = getCachedItem(cacheKey);
      if (cachedAddresses) {
        console.log(`Retrieved cached addresses for ${username || fid}`);
        return cachedAddresses;
      }
      
      console.log(`Fetching addresses for ${username || fid}`);
      
      // Get the profile first to get the FID if only username is provided
      let profile;
      try {
        profile = await getProfile({ username, fid });
        if (!profile) {
          console.error(`Profile not found for ${username || fid}`);
          return null;
        }
      } catch (error) {
        console.error(`Error fetching profile for ${username || fid}:`, error);
        return null;
      }

      // Use the FID from the profile
      const userFid = profile.fid;
      if (!userFid) {
        console.error(`No FID found in profile for ${username || fid}`);
        return null;
      }

      // Extract and validate the custody address from the profile
      let ethAddresses = [];
      
      if (profile.custody_address) {
        // Make sure the custody address is a valid string before using toLowerCase
        const custodyAddress = typeof profile.custody_address === 'string' 
          ? profile.custody_address.toLowerCase()
          : null;
        
        if (custodyAddress) {
          ethAddresses.push(custodyAddress);
        } else {
          console.warn('Invalid custody address format:', profile.custody_address);
        }
      }

      // Try to extract addresses from the verification data
      try {
        if (profile.verifications && Array.isArray(profile.verifications)) {
          // Filter and validate each verification address
          const verifiedAddresses = profile.verifications
            .filter(v => typeof v === 'string' && v.trim() !== '')
            .map(v => {
              // Normalize and validate each address
              try {
                return typeof v === 'string' ? v.toLowerCase() : null;
              } catch (err) {
                console.warn(`Invalid verification address: ${v}`);
                return null;
              }
            })
            .filter(Boolean); // Remove null/undefined entries
          
          // Add verified addresses to the list
          ethAddresses = [...ethAddresses, ...verifiedAddresses];
        }
      } catch (error) {
        console.error(`Error processing verification addresses for ${username || fid}:`, error);
      }

      // Try to extract addresses from connected data
      try {
        // Extract from user data if available
        if (profile.userData) {
          const extractedAddresses = extractAddressesFromUserData(profile.userData);
          if (extractedAddresses && Array.isArray(extractedAddresses)) {
            // Filter, validate and normalize each extracted address
            const validatedAddresses = extractedAddresses
              .filter(addr => addr && typeof addr === 'string' && addr.trim() !== '')
              .map(addr => {
                try {
                  return addr.toLowerCase();
                } catch (err) {
                  console.warn(`Invalid extracted address: ${addr}`);
                  return null;
                }
              })
              .filter(Boolean); // Remove null values
            
            ethAddresses = [...ethAddresses, ...validatedAddresses];
          }
        }
      } catch (error) {
        console.error(`Error extracting addresses from userData for ${username || fid}:`, error);
      }

      // Deduplicate addresses - ensure all are valid strings first
      const uniqueAddresses = [...new Set(ethAddresses.filter(
        addr => addr && typeof addr === 'string' && addr.startsWith('0x')
      ))];

      // Only get ENS info if we have at least one ETH address
      let result = { addresses: uniqueAddresses };
      
      if (uniqueAddresses.length > 0) {
        console.log(`Found ${uniqueAddresses.length} unique addresses for ${username || fid}`);
      } else {
        console.warn(`No valid addresses found for ${username || fid}`);
      }

      // Add user profile to the result
      result.profile = profile;

      // Cache the result
      cacheItem(cacheKey, result, 5 * 60 * 1000); // 5 minutes cache

      return result;
    } catch (error) {
      console.error('Error in getFarcasterAddresses:', error);
      return null;
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
      const { skipCache = false, maxPages = 100 } = options;
      
      // Check if we already have the complete list cached
      const cacheKey = `all-following-${fid}`;
      
      // Force refresh for debugging - remove after fixing
      await clearCacheItem(cacheKey);
      console.log(`Forcing fresh data for fetchAllFollowing for FID ${fid} by clearing cache`);
      
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
          console.log('Page result:', pageResult);
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
  },
  
  // Add to farcasterService object
  clearCacheItem: clearCacheItem
};

/**
 * Helper function to extract Ethereum addresses from Farcaster user data
 * Handles different API response formats from Neynar and other providers
 * 
 * @param {Object} userData - The user data object from Farcaster API
 * @returns {Array<string>} - Array of unique, lowercase Ethereum addresses
 */
const extractAddressesFromUserData = (userData) => {
  try {
    if (!userData) {
      console.log('userData is null or undefined in extractAddressesFromUserData');
      return [];
    }
    
    // Check various possible paths where addresses could be located
    let addresses = [];
    
    // Check verified_addresses.eth_addresses path (common in newer Neynar API)
    if (userData.verified_addresses?.eth_addresses) {
      try {
        // Filter out any non-string values before adding
        const validAddresses = Array.isArray(userData.verified_addresses.eth_addresses) 
          ? userData.verified_addresses.eth_addresses.filter(addr => typeof addr === 'string')
          : [];
        addresses = [...addresses, ...validAddresses];
        console.log(`Found ${validAddresses.length} addresses in verified_addresses.eth_addresses`);
      } catch (err) {
        console.error('Error processing verified_addresses.eth_addresses:', err);
      }
    }
    
    // Check other properties from Neynar API structure
    if (userData.verifications) {
      try {
        if (Array.isArray(userData.verifications)) {
          // Handle verifications array properly - may contain objects or strings
          const verificationAddresses = userData.verifications.map(v => {
            // If it's an object with 'address' property, use that
            if (typeof v === 'object' && v !== null && v.address) {
              return v.address;
            } 
            // If it's an object with 'addr' property, use that
            else if (typeof v === 'object' && v !== null && v.addr) {
              return v.addr;
            }
            // If it's a string, assume it's an address
            else if (typeof v === 'string') {
              return v;
            }
            // Skip anything else
            return null;
          }).filter(a => a !== null && typeof a === 'string'); // Only keep string values
          
          addresses = [...addresses, ...verificationAddresses];
          console.log(`Found ${verificationAddresses.length} addresses in verifications array`);
        } else {
          console.log('verifications property exists but is not an array:', typeof userData.verifications);
        }
      } catch (err) {
        console.error('Error processing verifications:', err);
      }
    }
    
    // Check custody_address (often present in Neynar API)
    if (userData.custody_address && typeof userData.custody_address === 'string') {
      try {
        addresses.push(userData.custody_address);
        console.log(`Added custody address: ${userData.custody_address}`);
      } catch (err) {
        console.error('Error processing custody_address:', err);
      }
    }
    
    // Check direct eth_addresses array
    if (userData.eth_addresses) {
      try {
        // Filter for strings only
        const validEthAddresses = Array.isArray(userData.eth_addresses)
          ? userData.eth_addresses.filter(addr => typeof addr === 'string')
          : [];
        addresses = [...addresses, ...validEthAddresses];
        console.log(`Found ${validEthAddresses.length} addresses in eth_addresses`);
      } catch (err) {
        console.error('Error processing eth_addresses:', err);
      }
    }
    
    // Check addresses array directly
    if (userData.addresses) {
      try {
        if (Array.isArray(userData.addresses)) {
          // Handle addresses array properly - may contain objects or strings
          const addressesArray = userData.addresses.map(a => {
            // If it's an object with 'address' property, use that
            if (typeof a === 'object' && a !== null && a.address) {
              return a.address;
            } 
            // If it's an object with 'addr' property, use that
            else if (typeof a === 'object' && a !== null && a.addr) {
              return a.addr;
            }
            // If it's a string, assume it's an address
            else if (typeof a === 'string') {
              return a;
            }
            // Skip anything else
            return null;
          }).filter(a => a !== null && typeof a === 'string'); // Only keep string values
          
          addresses = [...addresses, ...addressesArray];
          console.log(`Found ${addressesArray.length} addresses in addresses array`);
        } else {
          console.log('addresses property exists but is not an array:', typeof userData.addresses);
        }
      } catch (err) {
        console.error('Error processing addresses array:', err);
      }
    }
    
    // Remove duplicates and standardize to lowercase
    if (addresses.length > 0) {
      console.log(`Found total of ${addresses.length} addresses before deduplication`);
      
      // Validation: Only keep addresses that look like Ethereum addresses
      const validEthAddresses = addresses
        .filter(addr => typeof addr === 'string')
        .filter(addr => addr.match(/^(0x)?[0-9a-f]{40}$/i));
      
      // Safely convert to lowercase - only process strings
      const uniqueAddresses = [...new Set(
        validEthAddresses.map(addr => {
          // Add 0x prefix if missing
          if (!addr.startsWith('0x')) {
            return '0x' + addr.toLowerCase();
          }
          return addr.toLowerCase();
        })
      )];
      
      console.log(`Returning ${uniqueAddresses.length} unique valid Ethereum addresses`);
      return uniqueAddresses;
    }
    
    console.log('No addresses found for user');
    return [];
  } catch (err) {
    console.error('Error extracting addresses from user data:', err);
    console.error('Error details:', {
      message: err.message,
      stack: err.stack,
      userData: userData ? 'userData exists' : 'userData is null or undefined'
    });
    return [];
  }
};

export default farcasterService;

// Export individual functions for direct import
export const { fetchAddressesForFid, searchUsers, clearCache } = farcasterService;

// Also export the fetchAllFollowing function
export const fetchAllFollowing = farcasterService.fetchAllFollowing;