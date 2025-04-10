const { connectToMongoDB, verifyAuth, corsHeaders, handleOptions } = require('../_utils');
const Folder = require('../models/Folder');

module.exports = async (req, res) => {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Credentials', corsHeaders['Access-Control-Allow-Credentials']);
  res.setHeader('Access-Control-Allow-Origin', corsHeaders['Access-Control-Allow-Origin']);
  res.setHeader('Access-Control-Allow-Methods', corsHeaders['Access-Control-Allow-Methods']);
  res.setHeader('Access-Control-Allow-Headers', corsHeaders['Access-Control-Allow-Headers']);

  // Handle OPTIONS request
  if (handleOptions(req, res)) return;

  try {
    // Connect to MongoDB
    await connectToMongoDB();

    // Handle different HTTP methods
    switch (req.method) {
      case 'GET':
        return await getFolders(req, res);
      case 'POST':
        return await createFolder(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error in folders endpoint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get all folders for the authenticated user
async function getFolders(req, res) {
  try {
    // Verify authentication
    const { userId } = await verifyAuth(req);
    console.log('Getting all folders for user:', userId);

    // Get folders from MongoDB
    const folders = await Folder.find({ userId });
    console.log(`Found ${folders.length} folders for user ${userId}`);

    // Add string id for consistency
    const foldersWithId = folders.map(folder => {
      const folderObj = folder.toObject();
      folderObj.id = folder._id.toString();
      return folderObj;
    });

    return res.status(200).json(foldersWithId);
  } catch (error) {
    console.error('Error fetching folders:', error);
    
    if (error.message === 'Authorization header is required') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    return res.status(500).json({ error: 'Failed to fetch folders' });
  }
}

// Create a new folder
async function createFolder(req, res) {
  try {
    // Verify authentication
    const { userId } = await verifyAuth(req);
    
    // Get folder data from request body
    const { name, description, isPublic } = req.body;
    
    console.log('Creating folder:', {
      name,
      description,
      isPublic,
      userId
    });
    
    if (!name) {
      return res.status(400).json({ error: 'Folder name is required' });
    }
    
    // Create in MongoDB
    const folder = new Folder({
      name,
      description: description || '',
      userId,
      isPublic: isPublic || false
    });
    
    await folder.save();
    
    // Add string id for consistency
    const folderObj = folder.toObject();
    folderObj.id = folder._id.toString();
    
    console.log('Folder created:', folderObj);
    return res.status(201).json(folderObj);
  } catch (error) {
    console.error('Error creating folder:', error);
    
    if (error.message === 'Authorization header is required') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    return res.status(500).json({ error: 'Failed to create folder' });
  }
} 