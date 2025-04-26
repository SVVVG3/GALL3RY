// Dedicated collection-friends API handler for Vercel
// This file handles the collection-friends endpoint directly

const axios = require('axios');

// Simple memory cache to avoid redundant API calls
const CACHE = {
  friends: {},
  getKey: (contractAddress, fid) => `${contractAddress}:${fid}`,
  set: (key, data, ttl = 600000) => { // 10 minute TTL
    CACHE.friends[key] = {
      data,
      expiry: Date.now() + ttl
    };
  },
  get: (key) => {
    const cached = CACHE.friends[key];
    if (cached && cached.expiry > Date.now()) {
      console.log(`Cache hit for friends:${key}`);
      return cached.data;
    }
    return null;
  }
};

// Set CORS headers
const setCorsHeaders = (res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');
};

// Main handler function
module.exports = async function handler(req, res) {
  // Enable CORS
  setCorsHeaders(res);
  
  // Handle OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Record start time
  const startTime = Date.now();
  
  try {
    // Get parameters from request
    const { 
      contractAddress, 
      fid, 
      network = 'eth',
      limit = 50
    } = req.query;
    
    console.log(`[CollectionFriends Direct] Request for contract=${contractAddress}, fid=${fid}, network=${network}, limit=${limit}`);
    
    // Validate required parameters
    if (!contractAddress) {
      return res.status(400).json({ 
        error: 'Missing parameter', 
        message: 'contractAddress is required' 
      });
    }
    
    if (!fid) {
      return res.status(400).json({ 
        error: 'Missing parameter', 
        message: 'fid (Farcaster ID) is required' 
      });
    }
    
    // Check cache
    const cacheKey = CACHE.getKey(contractAddress, fid);
    const cachedData = CACHE.get(cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }
    
    // Get API keys
    const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY || process.env.REACT_APP_NEYNAR_API_KEY || 'NEYNAR_API_DOCS';
    const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || process.env.REACT_APP_ALCHEMY_API_KEY;
    
    if (!ALCHEMY_API_KEY) {
      console.error('[CollectionFriends Direct] Missing Alchemy API key');
      return res.status(500).json({ 
        error: 'Server configuration error', 
        message: 'Missing Alchemy API key' 
      });
    }
    
    // STEP 1: Get following list from Neynar
    console.log(`[CollectionFriends Direct] Fetching following list for FID: ${fid}`);
    console.log(`[CollectionFriends Direct] Using Neynar API key: ${NEYNAR_API_KEY.substring(0, 4)}...`);

    // Validate FID is a numeric value
    if (isNaN(parseInt(fid, 10))) {
      console.error('[CollectionFriends Direct] Invalid FID format. Must be a numeric value.');
      return res.status(400).json({
        error: 'Invalid parameter format',
        message: 'FID must be a numeric value'
      });
    }

    let followingList = [];
    let followingCursor = null;
    let hasMoreFollowing = true;

    try {
      // First try the v2 endpoint
      const neynarV2Url = `https://api.neynar.com/v2/farcaster/following?viewerFid=${fid}&limit=100${followingCursor ? `&cursor=${followingCursor}` : ''}`;
      
      console.log(`[CollectionFriends Direct] Making Neynar API call to: ${neynarV2Url}`);
      
      const followingResponse = await axios.get(neynarV2Url, {
        headers: {
          'Accept': 'application/json',
          'api_key': NEYNAR_API_KEY
        },
        timeout: 10000 // 10 second timeout
      });
      
      if (followingResponse.data?.result?.users) {
        followingList = [...followingList, ...followingResponse.data.result.users];
        
        if (followingResponse.data.result.next?.cursor) {
          followingCursor = followingResponse.data.result.next.cursor;
        }
        
        console.log(`[CollectionFriends Direct] Successfully fetched ${followingResponse.data.result.users.length} following users from Neynar`);
      } else {
        console.log('[CollectionFriends Direct] No users found in Neynar response or unexpected response format');
        console.log('Response data:', JSON.stringify(followingResponse.data).substring(0, 200) + '...');
      }
    } catch (error) {
      console.error('[CollectionFriends Direct] Neynar API error:', error);
      
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.error('Neynar error response data:', error.response.data);
        console.error('Neynar error response status:', error.response.status);
        console.error('Neynar error response headers:', error.response.headers);
        
        // Try fallback to v1 API if the error is about v2 being deprecated
        if (error.response.status === 400 || error.response.status === 404) {
          try {
            console.log('[CollectionFriends Direct] Attempting fallback to Neynar v1 API...');
            const neynarV1Url = `https://api.neynar.com/v1/farcaster/following?fid=${fid}&limit=100`;
            
            const v1Response = await axios.get(neynarV1Url, {
              headers: {
                'Accept': 'application/json',
                'api_key': NEYNAR_API_KEY
              },
              timeout: 10000
            });
            
            if (v1Response.data?.result?.users) {
              followingList = [...followingList, ...v1Response.data.result.users];
              console.log(`[CollectionFriends Direct] Successfully fetched ${v1Response.data.result.users.length} following users from Neynar v1 API`);
            }
          } catch (v1Error) {
            console.error('[CollectionFriends Direct] Neynar v1 API fallback also failed:', v1Error.message);
          }
        }
        
        // If we still have no following list, try a mock list for debugging
        if (followingList.length === 0) {
          console.log('[CollectionFriends Direct] Using mock data for debugging');
          return res.status(500).json({
            error: 'Neynar API error',
            message: error.response?.data?.message || error.message || 'Failed to fetch following list',
            neynarStatus: error.response?.status,
            responseData: error.response?.data,
            apiKey: NEYNAR_API_KEY.substring(0, 4) + '...' + NEYNAR_API_KEY.slice(-4),
            debug: true
          });
        }
      } else if (error.request) {
        // The request was made but no response was received
        console.error('Neynar error request:', error.request);
        return res.status(500).json({
          error: 'Neynar API network error',
          message: 'No response received from Neynar API',
          debug: true
        });
      } else {
        // Something happened in setting up the request that triggered an Error
        console.error('Neynar error:', error.message);
        return res.status(500).json({
          error: 'Neynar API client error',
          message: error.message,
          debug: true
        });
      }
    }

    console.log(`[CollectionFriends Direct] Found ${followingList.length} following users`);

    // Only proceed if we have some following users
    if (followingList.length === 0) {
      console.log('[CollectionFriends Direct] No following users found, returning empty result');
      const emptyResult = {
        contractAddress,
        friends: [],
        totalFriends: 0,
        error: 'No following users found'
      };
      
      return res.status(200).json(emptyResult);
    }
    
    // Extract addresses
    let uniqueFollowingAddresses = [];
    
    followingList.forEach(user => {
      if (user.custody_address) {
        uniqueFollowingAddresses.push(user.custody_address.toLowerCase());
      }
      
      if (user.verified_addresses?.eth_addresses) {
        user.verified_addresses.eth_addresses.forEach(address => {
          uniqueFollowingAddresses.push(address.toLowerCase());
        });
      }
    });
    
    // Remove duplicates
    uniqueFollowingAddresses = [...new Set(uniqueFollowingAddresses)];
    console.log(`[CollectionFriends Direct] Found ${uniqueFollowingAddresses.length} unique wallet addresses`);
    
    // STEP 2: Get contract owners from Alchemy
    const chainUrlMap = {
      'eth': 'eth-mainnet',
      'ethereum': 'eth-mainnet',
      'polygon': 'polygon-mainnet',
      'arbitrum': 'arb-mainnet',
      'optimism': 'opt-mainnet',
      'base': 'base-mainnet',
      'zora': 'zora-mainnet'
    };
    
    const chainUrl = chainUrlMap[network.toLowerCase()] || 'eth-mainnet';
    const alchemyUrl = `https://${chainUrl}.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}/getOwnersForContract`;
    
    console.log(`[CollectionFriends Direct] Fetching owners for contract: ${contractAddress} on ${chainUrl}`);
    
    let allOwners = [];
    let ownersCursor = null;
    let hasMoreOwners = true;
    
    while (hasMoreOwners) {
      try {
        // According to Alchemy docs, contractAddress should be normalized
        const normalizedContractAddress = contractAddress.toLowerCase();
        
        console.log(`[CollectionFriends Direct] Making Alchemy API request to ${alchemyUrl} with params:`, {
          contractAddress: normalizedContractAddress,
          withTokenBalances: true,
          pageKey: ownersCursor || undefined
        });
        
        const ownersResponse = await axios.get(alchemyUrl, {
          params: {
            contractAddress: normalizedContractAddress,
            withTokenBalances: true,
            pageKey: ownersCursor || undefined
          },
          headers: {
            'Accept': 'application/json'
          },
          timeout: 30000 // 30 seconds timeout
        });
        
        console.log(`[CollectionFriends Direct] Alchemy API response status: ${ownersResponse.status}`);
        console.log(`[CollectionFriends Direct] Response data structure:`, {
          hasData: !!ownersResponse.data,
          dataKeys: ownersResponse.data ? Object.keys(ownersResponse.data) : [],
          ownersCount: ownersResponse.data?.owners?.length || 0
        });
        
        if (ownersResponse.data?.owners) {
          // Extract just the owner addresses from the response
          const ownerAddresses = ownersResponse.data.owners.map(owner => {
            // Handle both formats that Alchemy might return
            if (typeof owner === 'string') {
              return owner.toLowerCase();
            } else if (owner.ownerAddress) {
              return owner.ownerAddress.toLowerCase();
            }
            return null;
          }).filter(address => !!address);
          
          allOwners = [...allOwners, ...ownerAddresses];
          
          if (ownersResponse.data.pageKey) {
            ownersCursor = ownersResponse.data.pageKey;
          } else {
            hasMoreOwners = false;
          }
        } else {
          hasMoreOwners = false;
        }
      } catch (error) {
        console.error('[CollectionFriends Direct] Alchemy API error:', error.message);
        console.error('[CollectionFriends Direct] Error details:', {
          status: error.response?.status,
          data: error.response?.data,
          url: alchemyUrl,
          network: network,
          contractAddress: contractAddress
        });
        
        // Try fallback to Alchemy direct NFT API if we got an error
        try {
          console.log('[CollectionFriends Direct] Attempting fallback to Alchemy NFT API');
          const fallbackUrl = `https://${chainUrl}.g.alchemy.com/v2/${ALCHEMY_API_KEY}`;
          
          const fallbackResponse = await axios.post(fallbackUrl, {
            jsonrpc: '2.0',
            id: 1,
            method: 'alchemy_getOwnersForToken',
            params: [contractAddress, null]
          }, {
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            timeout: 30000
          });
          
          if (fallbackResponse.data?.result?.owners) {
            allOwners = [...allOwners, ...fallbackResponse.data.result.owners.map(addr => addr.toLowerCase())];
            console.log(`[CollectionFriends Direct] Fallback successful, found ${fallbackResponse.data.result.owners.length} owners`);
          }
          
          // We're done with the fallback, don't try to paginate
          hasMoreOwners = false;
        } catch (fallbackError) {
          console.error('[CollectionFriends Direct] Fallback also failed:', fallbackError.message);
          return res.status(500).json({ 
            error: 'Alchemy API error', 
            message: error.message || 'Failed to fetch contract owners',
            network: network,
            contractAddress: contractAddress
          });
        }
      }
    }
    
    console.log(`[CollectionFriends Direct] Found ${allOwners.length} owners of this collection`);
    
    // Find intersection
    const friendOwners = uniqueFollowingAddresses.filter(address => 
      allOwners.some(owner => owner.toLowerCase() === address.toLowerCase())
    );
    
    console.log(`[CollectionFriends Direct] Found ${friendOwners.length} friends who own NFTs from this collection`);
    
    // Return empty result if no matches
    if (friendOwners.length === 0) {
      const emptyResult = {
        contractAddress,
        friends: [],
        totalFriends: 0
      };
      
      CACHE.set(cacheKey, emptyResult);
      return res.status(200).json(emptyResult);
    }
    
    // Get profiles for each matching address
    const friendsWithProfiles = [];
    
    // Match addresses to followingList entries
    for (const address of friendOwners) {
      const matchingFollower = followingList.find(user => {
        if (user.custody_address && user.custody_address.toLowerCase() === address.toLowerCase()) {
          return true;
        }
        
        if (user.verified_addresses?.eth_addresses) {
          return user.verified_addresses.eth_addresses.some(
            addr => addr.toLowerCase() === address.toLowerCase()
          );
        }
        
        return false;
      });
      
      if (matchingFollower) {
        friendsWithProfiles.push({
          fid: matchingFollower.fid,
          username: matchingFollower.username,
          displayName: matchingFollower.display_name || matchingFollower.username,
          pfpUrl: matchingFollower.pfp_url,
          address
        });
      }
    }
    
    // Paginate results
    const paginatedResults = friendsWithProfiles.slice(0, parseInt(limit, 10));
    
    const result = {
      contractAddress,
      friends: paginatedResults,
      totalFriends: friendsWithProfiles.length,
      hasMore: friendsWithProfiles.length > parseInt(limit, 10)
    };
    
    // Cache result
    CACHE.set(cacheKey, result);
    
    // Log performance metrics
    const duration = Date.now() - startTime;
    console.log(`[CollectionFriends Direct] Request completed in ${duration}ms`);
    
    return res.status(200).json(result);
    
  } catch (error) {
    console.error('[CollectionFriends Direct] Unexpected error:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message || 'An unknown error occurred',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}; 