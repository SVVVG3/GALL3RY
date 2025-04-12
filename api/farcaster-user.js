// Simple Farcaster user lookup API endpoint
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

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
    
    // Make request to Farcaster API
    const apiUrl = `https://api.warpcast.com/v2/user-by-username?username=${encodeURIComponent(username)}`;
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    // Get response as JSON
    const data = await response.json();
    
    // If not found or error
    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Farcaster API error',
        message: data.message || 'Failed to fetch user'
      });
    }
    
    // Extract user profile
    if (data.result?.user) {
      const user = data.result.user;
      
      // Format response to match what our frontend expects
      const profile = {
        fid: user.fid,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.pfp?.url,
        bio: user.profile?.bio?.text,
        followerCount: user.followerCount,
        followingCount: user.followingCount,
        connectedAddresses: user.verifications || []
      };
      
      return res.status(200).json({ profile });
    } else {
      return res.status(404).json({
        error: 'User not found',
        username
      });
    }
  } catch (error) {
    console.error('Error fetching Farcaster user:', error);
    
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message || 'An unknown error occurred'
    });
  }
}; 