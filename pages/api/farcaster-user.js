// Next.js API route for directly looking up Farcaster users
// This is a simplified endpoint for just user lookups

/**
 * API handler for Farcaster user lookups
 */
export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Get username from query
  let { username } = req.query;
  
  if (!username) {
    return res.status(400).json({ error: 'Missing username parameter' });
  }
  
  // Clean username input - remove @ and trim
  username = username.trim().replace(/^@/, '');
  
  try {
    console.log(`Looking up Farcaster user: ${username}`);
    
    // Check if this is an ENS name
    const isEnsName = username.toLowerCase().endsWith('.eth');
    const alternativeUsername = isEnsName 
      ? username.substring(0, username.length - 4) 
      : null;
    
    if (isEnsName) {
      console.log(`Username appears to be ENS name, will also try: ${alternativeUsername}`);
    }
    
    // Try fetching with original username
    let profile = await fetchFarcasterProfile(username);
    
    // If not found and this is an ENS name, try with the alternative username
    if (!profile && isEnsName && alternativeUsername) {
      console.log(`Trying alternative username: ${alternativeUsername}`);
      profile = await fetchFarcasterProfile(alternativeUsername);
    }
    
    if (!profile) {
      return res.status(404).json({
        error: 'User not found',
        username
      });
    }
    
    return res.status(200).json({ profile });
    
  } catch (error) {
    console.error('Error fetching Farcaster user:', error);
    
    // Handle timeout errors
    if (error.name === 'AbortError') {
      return res.status(504).json({
        error: 'Request timed out',
        message: 'Farcaster API request timed out'
      });
    }
    
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'An unknown error occurred'
    });
  }
}

/**
 * Fetch a Farcaster profile by username
 * @param {string} username - Farcaster username
 * @returns {Promise<object|null>} - Profile data or null if not found
 */
async function fetchFarcasterProfile(username) {
  try {
    // First try Warpcast API (v2)
    const warpcastResponse = await fetchFromWarpcast(username);
    if (warpcastResponse) return warpcastResponse;
    
    // Then try Neynar API as fallback
    const neynarResponse = await fetchFromNeynar(username);
    if (neynarResponse) return neynarResponse;
    
    return null;
  } catch (error) {
    console.error(`Error in fetchFarcasterProfile for ${username}:`, error);
    return null;
  }
}

/**
 * Fetch profile from Warpcast API
 * @param {string} username - Farcaster username
 * @returns {Promise<object|null>} - Profile data or null if not found
 */
async function fetchFromWarpcast(username) {
  try {
    // Make request to Farcaster's user endpoint
    const apiUrl = `https://api.warpcast.com/v2/user-by-username?username=${encodeURIComponent(username)}`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    
    // If response is not ok, return null
    if (!response.ok) {
      console.log(`Warpcast API returned ${response.status} for username: ${username}`);
      return null;
    }
    
    const data = await response.json();
    
    // Extract the user profile and extras from the response
    const result = {
      success: true,
      user: data.result?.user || null,
      extras: data.result?.extras || {}
    };
    
    if (!result.user) {
      return null;
    }
    
    // Log the structure for debugging
    console.log(`Warpcast API response structure for ${username}:`, {
      hasExtras: !!result.extras,
      hasCustodyAddress: !!result.extras?.custodyAddress,
      hasEthWallets: Array.isArray(result.extras?.ethWallets),
      ethWalletsCount: result.extras?.ethWallets?.length || 0,
      hasSolWallets: Array.isArray(result.extras?.solanaWallets),
      solWalletsCount: result.extras?.solanaWallets?.length || 0
    });
    
    // Collect connected addresses from multiple sources
    const connectedAddresses = [];
    
    // Add ethereum wallets if available
    if (Array.isArray(result.extras?.ethWallets)) {
      connectedAddresses.push(...result.extras.ethWallets);
    }
    
    // Add solana wallets if available (may need to be handled differently in frontend)
    if (Array.isArray(result.extras?.solanaWallets)) {
      connectedAddresses.push(...result.extras.solanaWallets);
    }
    
    // Add legacy verifications if available
    if (Array.isArray(result.user.verifications)) {
      connectedAddresses.push(...result.user.verifications);
    }

    // Get custody address
    const custodyAddress = result.extras?.custodyAddress || null;
    
    // Log what we found
    console.log(`Found ${connectedAddresses.length} connected addresses and custody address: ${custodyAddress || 'none'} for ${username}`);
    
    // Transform the response to match what our frontend expects
    return {
      fid: result.user.fid,
      username: result.user.username,
      displayName: result.user.displayName,
      avatarUrl: result.user.pfp?.url,
      bio: result.user.profile?.bio?.text,
      followerCount: result.user.followerCount,
      followingCount: result.user.followingCount,
      connectedAddresses: connectedAddresses,
      custodyAddress: custodyAddress,
      _rawData: {
        extras: result.extras,
        user: result.user
      }
    };
  } catch (error) {
    console.error(`Error fetching from Warpcast for ${username}:`, error);
    return null;
  }
}

/**
 * Fetch profile from Neynar API as a fallback
 * @param {string} username - Farcaster username
 * @returns {Promise<object|null>} - Profile data or null if not found
 */
async function fetchFromNeynar(username) {
  try {
    const NEYNAR_API_KEY = process.env.NEYNAR_API_KEY;
    if (!NEYNAR_API_KEY) {
      console.log('No Neynar API key found, skipping this source');
      return null;
    }
    
    const apiUrl = `https://api.neynar.com/v2/farcaster/user/search?q=${encodeURIComponent(username)}&limit=1`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'api_key': NEYNAR_API_KEY
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    
    if (!response.ok) {
      console.log(`Neynar API returned ${response.status} for username: ${username}`);
      return null;
    }
    
    const data = await response.json();
    
    // Check if we found any users
    if (!data.users || data.users.length === 0) {
      return null;
    }
    
    // Get the first user (most relevant)
    const user = data.users[0];
    
    // Check if the username exactly matches what we're looking for
    // In search results, we might get similar but not exact matches
    if (user.username.toLowerCase() !== username.toLowerCase()) {
      console.log(`Neynar returned username ${user.username} but we searched for ${username}, skipping`);
      return null;
    }
    
    return {
      fid: user.fid,
      username: user.username,
      displayName: user.display_name,
      avatarUrl: user.pfp_url,
      bio: user.profile.bio.text,
      followerCount: user.follower_count,
      followingCount: user.following_count,
      connectedAddresses: user.verified_addresses || [],
      custodyAddress: user.custody_address || null
    };
  } catch (error) {
    console.error(`Error fetching from Neynar for ${username}:`, error);
    return null;
  }
} 