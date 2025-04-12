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
  const { username } = req.query;
  
  if (!username) {
    return res.status(400).json({ error: 'Missing username parameter' });
  }
  
  try {
    console.log(`Looking up Farcaster user: ${username}`);
    
    // Make request to Farcaster's user endpoint
    const apiUrl = `https://api.warpcast.com/v2/user-by-username?username=${encodeURIComponent(username)}`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });
    
    const data = await response.json();
    
    // If the request was not successful
    if (!response.ok) {
      console.error(`Failed to find Farcaster user: ${username}`, data);
      return res.status(response.status).json({
        error: data.message || 'Failed to find Farcaster user',
        details: data
      });
    }
    
    // Extract the user profile from the response
    const result = {
      success: true,
      user: data.result?.user || null
    };
    
    if (!result.user) {
      return res.status(404).json({
        error: 'User not found',
        username
      });
    }
    
    // Transform the response to match what our frontend expects
    const profile = {
      fid: result.user.fid,
      username: result.user.username,
      displayName: result.user.displayName,
      avatarUrl: result.user.pfp?.url,
      bio: result.user.profile?.bio?.text,
      followerCount: result.user.followerCount,
      followingCount: result.user.followingCount,
      connectedAddresses: result.user.verifications || []
    };
    
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