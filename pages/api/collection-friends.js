/**
 * Collection Friends API Endpoint
 * 
 * This endpoint finds which Farcaster users you follow that also hold NFTs from a specific collection
 * It makes three API calls:
 * 1. Neynar API: Get list of users the current user follows
 * 2. Alchemy API: Get all wallet addresses that hold NFTs from specified contract
 * 3. Zapper API: Match wallet addresses to Farcaster profiles
 */

import axios from 'axios';

// Alchemy API base URL
const getAlchemyBaseUrl = (network = 'eth') => {
  const networkMap = {
    'eth': 'eth-mainnet',
    'ethereum': 'eth-mainnet',
    'polygon': 'polygon-mainnet',
    'arbitrum': 'arb-mainnet',
    'optimism': 'opt-mainnet',
    'base': 'base-mainnet',
    'zora': 'zora-mainnet',
  };

  const normalizedNetwork = network.toLowerCase();
  const chainId = networkMap[normalizedNetwork] || 'eth-mainnet';
  return `https://${chainId}.g.alchemy.com`;
};

// Constants
// Updated Neynar API URL to match all-in-one.js implementation
// const NEYNAR_API_URL = 'https://api.neynar.com/v2/farcaster';
const ZAPPER_API_URL = 'https://public.zapper.xyz/graphql';
const MAX_RETRIES = 2;

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed', message: 'Only GET requests are supported' });
  }

  try {
    // Get parameters from request
    const { 
      contractAddress, 
      fid, 
      network = 'eth',
      limit = 50, 
      cursor = null 
    } = req.query;

    if (!contractAddress) {
      return res.status(400).json({ error: 'Missing parameter', message: 'contractAddress is required' });
    }

    if (!fid) {
      return res.status(400).json({ error: 'Missing parameter', message: 'fid (Farcaster ID) is required' });
    }

    // Get Alchemy API key from environment variables
    const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY || process.env.REACT_APP_ALCHEMY_API_KEY;
    
    if (!ALCHEMY_API_KEY) {
      console.error('Missing ALCHEMY_API_KEY in environment variables');
      return res.status(500).json({ error: 'Server configuration error', message: 'Missing API key' });
    }

    // Get Neynar API key from environment variables (if available)
    const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY || process.env.REACT_APP_NEYNAR_API_KEY || 'NEYNAR_API_DOCS';
    
    // Get Zapper API key from environment variables
    const ZAPPER_API_KEY = process.env.ZAPPER_API_KEY || process.env.REACT_APP_ZAPPER_API_KEY || '';

    console.log(`Getting collection friends for contract: ${contractAddress}, user FID: ${fid}`);

    // STEP 1: Get the list of users the Farcaster user follows (using Neynar API)
    let followingList = [];
    let followingCursor = null;
    let hasMoreFollowing = true;

    while (hasMoreFollowing) {
      try {
        // Build Neynar API URL for following list - Using the correct format from documentation
        const neynarUrl = `https://api.neynar.com/v2/farcaster/following?fid=${fid}&limit=100${followingCursor ? `&cursor=${followingCursor}` : ''}`;
        
        // Using the correct header format from documentation
        const followingResponse = await axios.get(neynarUrl, {
          headers: {
            'Accept': 'application/json',
            'x-api-key': NEYNAR_API_KEY
          }
        });
        
        // Parsing the response structure correctly according to documentation
        if (followingResponse.data && followingResponse.data.users) {
          // Extract user objects from the follower objects
          const users = followingResponse.data.users.map(follower => follower.user);
          followingList = [...followingList, ...users];
          
          // Check if there's more data to fetch using the correct response structure
          if (followingResponse.data.next && followingResponse.data.next.cursor) {
            followingCursor = followingResponse.data.next.cursor;
          } else {
            hasMoreFollowing = false;
          }
        } else {
          hasMoreFollowing = false;
        }
      } catch (error) {
        console.error('Error fetching following list from Neynar:', error.message);
        if (error.response) {
          console.error('Error response data:', error.response.data);
          console.error('Error response status:', error.response.status);
        }
        return res.status(500).json({ 
          error: 'Neynar API error', 
          message: error.message || 'Failed to fetch following list'
        });
      }
    }

    console.log(`Found ${followingList.length} following users for FID ${fid}`);
    
    // Extract all unique addresses from the following list
    let uniqueFollowingAddresses = [];
    
    followingList.forEach(user => {
      // Add custody addresses
      if (user.custody_address) {
        uniqueFollowingAddresses.push(user.custody_address.toLowerCase());
      }
      
      // Add verified ETH addresses if available
      if (user.verified_addresses && user.verified_addresses.eth_addresses) {
        user.verified_addresses.eth_addresses.forEach(address => {
          uniqueFollowingAddresses.push(address.toLowerCase());
        });
      }
    });
    
    // Remove duplicates
    uniqueFollowingAddresses = [...new Set(uniqueFollowingAddresses)];
    
    console.log(`Found ${uniqueFollowingAddresses.length} unique wallet addresses from following list`);

    // STEP 2: Get all wallet addresses that hold NFTs from the specified contract (using Alchemy API)
    let allOwners = [];
    let ownersCursor = null;
    let hasMoreOwners = true;

    while (hasMoreOwners) {
      try {
        // Build the Alchemy URL
        const alchemyUrl = `${getAlchemyBaseUrl(network)}/nft/v3/${ALCHEMY_API_KEY}/getOwnersForContract`;
        
        // Make the request to Alchemy
        const ownersResponse = await axios.get(alchemyUrl, {
          params: {
            contractAddress,
            withTokenBalances: true,
            pageKey: ownersCursor
          }
        });

        if (ownersResponse.data && ownersResponse.data.owners) {
          allOwners = [...allOwners, ...ownersResponse.data.owners];
          
          // Check if there's more data to fetch
          if (ownersResponse.data.pageKey) {
            ownersCursor = ownersResponse.data.pageKey;
          } else {
            hasMoreOwners = false;
          }
        } else {
          hasMoreOwners = false;
        }
      } catch (error) {
        console.error('Error fetching owners for contract from Alchemy:', error.message);
        return res.status(500).json({ 
          error: 'Alchemy API error', 
          message: error.message || 'Failed to fetch contract owners'
        });
      }
    }

    console.log(`Found ${allOwners.length} owners of NFTs from contract ${contractAddress}`);

    // Find the intersection between following addresses and contract owners
    const friendOwners = uniqueFollowingAddresses.filter(address => 
      allOwners.some(owner => owner.toLowerCase() === address.toLowerCase())
    );

    console.log(`Found ${friendOwners.length} friends who own NFTs from this collection`);

    // If no friends own NFTs from this collection, return an empty result
    if (friendOwners.length === 0) {
      return res.status(200).json({
        contractAddress,
        friends: [],
        totalFriends: 0
      });
    }

    // STEP 3: For each owner address that's a friend, find the corresponding Farcaster profile
    const friendsWithProfiles = [];

    // Match addresses to followingList entries
    for (const address of friendOwners) {
      // Find the corresponding user in the following list
      const matchingFollower = followingList.find(user => {
        // Check custody address
        if (user.custody_address && user.custody_address.toLowerCase() === address.toLowerCase()) {
          return true;
        }
        
        // Check verified addresses
        if (user.verified_addresses && user.verified_addresses.eth_addresses) {
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

    // Return the results, applying the requested limit
    const paginatedResults = friendsWithProfiles.slice(0, parseInt(limit, 10));
    
    return res.status(200).json({
      contractAddress,
      friends: paginatedResults,
      totalFriends: friendsWithProfiles.length,
      hasMore: friendsWithProfiles.length > parseInt(limit, 10)
    });

  } catch (error) {
    console.error('Error in collection-friends API:', error);
    return res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message || 'An unknown error occurred'
    });
  }
} 