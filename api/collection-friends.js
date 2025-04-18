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
    let followingList = [];
    let followingCursor = null;
    let hasMoreFollowing = true;
    
    while (hasMoreFollowing) {
      try {
        const neynarUrl = `https://api.neynar.com/v2/farcaster/following?viewerFid=${fid}&limit=100${followingCursor ? `&cursor=${followingCursor}` : ''}`;
        
        const followingResponse = await axios.get(neynarUrl, {
          headers: {
            'Accept': 'application/json',
            'api_key': NEYNAR_API_KEY
          }
        });
        
        if (followingResponse.data?.result?.users) {
          followingList = [...followingList, ...followingResponse.data.result.users];
          
          if (followingResponse.data.result.next?.cursor) {
            followingCursor = followingResponse.data.result.next.cursor;
          } else {
            hasMoreFollowing = false;
          }
        } else {
          hasMoreFollowing = false;
        }
      } catch (error) {
        console.error('[CollectionFriends Direct] Neynar API error:', error.message);
        return res.status(500).json({ 
          error: 'Neynar API error', 
          message: error.message || 'Failed to fetch following list'
        });
      }
    }
    
    console.log(`[CollectionFriends Direct] Found ${followingList.length} following users`);
    
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
        const ownersResponse = await axios.get(alchemyUrl, {
          params: {
            contractAddress,
            withTokenBalances: true,
            pageKey: ownersCursor
          }
        });
        
        if (ownersResponse.data?.owners) {
          allOwners = [...allOwners, ...ownersResponse.data.owners];
          
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
        return res.status(500).json({ 
          error: 'Alchemy API error', 
          message: error.message || 'Failed to fetch contract owners'
        });
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