const { connectToMongoDB, cache, CACHE_KEYS, corsHeaders, handleOptions } = require('../../_utils');
const Folder = require('../../models/Folder');
const axios = require('axios');

module.exports = async (req, res) => {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Credentials', corsHeaders['Access-Control-Allow-Credentials']);
  res.setHeader('Access-Control-Allow-Origin', corsHeaders['Access-Control-Allow-Origin']);
  res.setHeader('Access-Control-Allow-Methods', corsHeaders['Access-Control-Allow-Methods']);
  res.setHeader('Access-Control-Allow-Headers', corsHeaders['Access-Control-Allow-Headers']);

  // Handle OPTIONS request
  if (handleOptions(req, res)) return;

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Connect to MongoDB
    await connectToMongoDB();

    // Get username from request path
    const { username } = req.query;
    
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }

    return await getPublicFolders(req, res, username);
  } catch (error) {
    console.error('Error in public folders endpoint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get public folders for a specific user
async function getPublicFolders(req, res, username) {
  try {
    // Get API key from environment variables
    const NEYNAR_API_KEY = process.env.REACT_APP_NEYNAR_API_KEY;
    const NEYNAR_API_URL = 'https://api.neynar.com/v2';
    
    if (!NEYNAR_API_KEY) {
      return res.status(500).json({ error: 'Neynar API key not configured' });
    }

    // First, get the user's FID from their username
    const cacheKey = CACHE_KEYS.FARCASTER_PROFILE(username);
    let userProfile = cache.get(cacheKey);
    
    if (!userProfile) {
      // Fetch user profile from Neynar
      console.log(`Fetching Farcaster profile for username: ${username}`);
      const userResponse = await axios.get(`${NEYNAR_API_URL}/farcaster/user/search`, {
        headers: {
          'accept': 'application/json',
          'api_key': NEYNAR_API_KEY
        },
        params: {
          viewer_fid: 1,
          q: username
        }
      });
      
      if (!userResponse.data.result?.users?.length) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      const user = userResponse.data.result.users[0];
      userProfile = { data: { farcasterProfile: { fid: user.fid } } };
      
      // Cache the profile
      cache.set(cacheKey, userProfile, 300); // Cache for 5 minutes
    }
    
    // Now fetch public folders for this user
    const fid = userProfile.data.farcasterProfile.fid;
    console.log(`Finding public folders for user with FID: ${fid}`);
    
    // Find public folders from MongoDB
    const folders = await Folder.find({ 
      userId: fid.toString(),
      isPublic: true 
    });
    
    console.log(`Found ${folders.length} public folders for user ${username} (FID: ${fid})`);
    
    // Add string id for consistency
    const foldersWithId = folders.map(folder => {
      const folderObj = folder.toObject();
      folderObj.id = folder._id.toString();
      return folderObj;
    });
    
    return res.status(200).json(foldersWithId);
  } catch (error) {
    console.error('Error fetching public folders:', error);
    return res.status(500).json({ error: 'Failed to fetch public folders' });
  }
} 