const { connectToMongoDB, verifyAuth, corsHeaders, handleOptions } = require('../_utils');
const Folder = require('../models/Folder');
const mongoose = require('mongoose');

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

    // Get folder ID from request path
    const { id } = req.query;
    
    if (!id) {
      return res.status(400).json({ error: 'Folder ID is required' });
    }

    // Handle different HTTP methods
    switch (req.method) {
      case 'GET':
        return await getFolder(req, res, id);
      case 'PUT':
        return await updateFolder(req, res, id);
      case 'DELETE':
        return await deleteFolder(req, res, id);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error in folder endpoint:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// Get a specific folder
async function getFolder(req, res, folderId) {
  try {
    console.log('Getting folder by ID:', folderId);
    
    // Find the folder
    let folder;
    try {
      folder = await Folder.findById(folderId);
      
      if (!folder && mongoose.Types.ObjectId.isValid(folderId)) {
        console.log('Folder not found by ObjectId, trying string match...');
        folder = await Folder.findOne({ _id: mongoose.Types.ObjectId(folderId) });
      }
    } catch (err) {
      console.error('MongoDB lookup error:', err.message);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!folder) {
      console.log('Folder not found with ID:', folderId);
      return res.status(404).json({ error: 'Folder not found' });
    }
    
    // Check if the user has permission to access this folder
    if (!folder.isPublic) {
      try {
        const { userId } = await verifyAuth(req);
        const isOwner = folder.userId === userId;
        
        if (!isOwner) {
          return res.status(403).json({ error: 'Access denied' });
        }
      } catch (error) {
        // If auth fails and folder is not public, deny access
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }
    
    // Add string id field for consistency
    const folderObj = folder.toObject();
    folderObj.id = folder._id.toString();
    
    return res.status(200).json(folderObj);
  } catch (error) {
    console.error('Error getting folder:', error);
    return res.status(500).json({ error: 'Failed to get folder' });
  }
}

// Update a folder
async function updateFolder(req, res, folderId) {
  try {
    // Verify authentication
    const { userId } = await verifyAuth(req);
    
    // Find the folder
    const folder = await Folder.findById(folderId);
    
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    
    // Ensure the user owns this folder
    if (folder.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Get folder data from request body
    const { name, description, isPublic } = req.body;
    
    // Update fields if provided
    if (name !== undefined) folder.name = name;
    if (description !== undefined) folder.description = description;
    if (isPublic !== undefined) folder.isPublic = Boolean(isPublic);
    
    await folder.save();
    
    // Add string id field for consistency
    const folderObj = folder.toObject();
    folderObj.id = folder._id.toString();
    
    return res.status(200).json(folderObj);
  } catch (error) {
    console.error('Error updating folder:', error);
    
    if (error.message === 'Authorization header is required') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    return res.status(500).json({ error: 'Failed to update folder' });
  }
}

// Delete a folder
async function deleteFolder(req, res, folderId) {
  try {
    // Verify authentication
    const { userId } = await verifyAuth(req);
    
    // Find the folder
    const folder = await Folder.findById(folderId);
    
    if (!folder) {
      return res.status(404).json({ error: 'Folder not found' });
    }
    
    // Ensure the user owns this folder
    if (folder.userId !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await Folder.findByIdAndDelete(folderId);
    
    return res.status(200).json({ message: 'Folder deleted successfully' });
  } catch (error) {
    console.error('Error deleting folder:', error);
    
    if (error.message === 'Authorization header is required') {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    return res.status(500).json({ error: 'Failed to delete folder' });
  }
} 