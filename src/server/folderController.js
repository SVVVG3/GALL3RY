const mongoose = require('mongoose');
const config = require('../config');
const Folder = require('./models/Folder');
const User = require('./models/User');

/**
 * Controller for handling folder-related API endpoints
 */
const folderController = {
  /**
   * Get all folders for the authenticated user
   */
  getUserFolders: async (req, res) => {
    try {
      const { userId } = req.user;
      
      const folders = await Folder.find({ ownerId: userId })
        .sort({ updatedAt: -1 })
        .populate('nfts', 'tokenId contractAddress imageUrl name collection');
      
      res.json(folders);
    } catch (error) {
      console.error('Error fetching user folders:', error);
      res.status(500).json({ error: 'Failed to fetch folders' });
    }
  },

  /**
   * Get a specific folder by ID
   */
  getFolder: async (req, res) => {
    try {
      const { folderId } = req.params;
      const { userId } = req.user;
      
      const folder = await Folder.findOne({ 
        _id: folderId,
        $or: [
          { ownerId: userId },
          { isPublic: true }
        ]
      }).populate('nfts');
      
      if (!folder) {
        return res.status(404).json({ error: 'Folder not found' });
      }
      
      res.json(folder);
    } catch (error) {
      console.error(`Error fetching folder ${req.params.folderId}:`, error);
      res.status(500).json({ error: 'Failed to fetch folder details' });
    }
  },

  /**
   * Create a new folder
   */
  createFolder: async (req, res) => {
    try {
      const { name, description, isPublic } = req.body;
      const { userId } = req.user;
      
      if (!name) {
        return res.status(400).json({ error: 'Folder name is required' });
      }
      
      const newFolder = new Folder({
        name,
        description,
        isPublic: isPublic || false,
        ownerId: userId,
        nfts: []
      });
      
      await newFolder.save();
      res.status(201).json(newFolder);
    } catch (error) {
      console.error('Error creating folder:', error);
      res.status(500).json({ error: 'Failed to create folder' });
    }
  },

  /**
   * Update a folder's details
   */
  updateFolder: async (req, res) => {
    try {
      const { folderId } = req.params;
      const { userId } = req.user;
      const updates = req.body;
      
      // Find the folder and ensure the user owns it
      const folder = await Folder.findOne({ _id: folderId, ownerId: userId });
      
      if (!folder) {
        return res.status(404).json({ error: 'Folder not found or access denied' });
      }
      
      // Apply updates
      if (updates.name) folder.name = updates.name;
      if (updates.description !== undefined) folder.description = updates.description;
      if (updates.isPublic !== undefined && config.features.enablePublicFolders) {
        folder.isPublic = updates.isPublic;
      }
      
      await folder.save();
      res.json(folder);
    } catch (error) {
      console.error(`Error updating folder ${req.params.folderId}:`, error);
      res.status(500).json({ error: 'Failed to update folder' });
    }
  },

  /**
   * Delete a folder
   */
  deleteFolder: async (req, res) => {
    try {
      const { folderId } = req.params;
      const { userId } = req.user;
      
      const result = await Folder.deleteOne({ _id: folderId, ownerId: userId });
      
      if (result.deletedCount === 0) {
        return res.status(404).json({ error: 'Folder not found or access denied' });
      }
      
      res.status(204).send();
    } catch (error) {
      console.error(`Error deleting folder ${req.params.folderId}:`, error);
      res.status(500).json({ error: 'Failed to delete folder' });
    }
  },

  /**
   * Add an NFT to a folder
   */
  addNftToFolder: async (req, res) => {
    try {
      const { folderId } = req.params;
      const { userId } = req.user;
      const nftData = req.body;
      
      if (!nftData || !nftData.tokenId || !nftData.contractAddress) {
        return res.status(400).json({ error: 'NFT data is incomplete' });
      }
      
      // Find the folder and ensure the user owns it
      const folder = await Folder.findOne({ _id: folderId, ownerId: userId });
      
      if (!folder) {
        return res.status(404).json({ error: 'Folder not found or access denied' });
      }
      
      // Check if the NFT already exists in the folder
      const nftExists = folder.nfts.some(nft => 
        nft.tokenId === nftData.tokenId && 
        nft.contractAddress.toLowerCase() === nftData.contractAddress.toLowerCase()
      );
      
      if (nftExists) {
        return res.status(400).json({ error: 'NFT already exists in this folder' });
      }
      
      // Add the NFT to the folder
      folder.nfts.push(nftData);
      folder.updatedAt = new Date();
      
      await folder.save();
      res.status(201).json(folder);
    } catch (error) {
      console.error(`Error adding NFT to folder ${req.params.folderId}:`, error);
      res.status(500).json({ error: 'Failed to add NFT to folder' });
    }
  },

  /**
   * Remove an NFT from a folder
   */
  removeNftFromFolder: async (req, res) => {
    try {
      const { folderId, nftId } = req.params;
      const { userId } = req.user;
      
      // Find the folder and ensure the user owns it
      const folder = await Folder.findOne({ _id: folderId, ownerId: userId });
      
      if (!folder) {
        return res.status(404).json({ error: 'Folder not found or access denied' });
      }
      
      // Remove the NFT from the folder
      folder.nfts = folder.nfts.filter(nft => nft._id.toString() !== nftId);
      folder.updatedAt = new Date();
      
      await folder.save();
      res.json(folder);
    } catch (error) {
      console.error(`Error removing NFT ${req.params.nftId} from folder ${req.params.folderId}:`, error);
      res.status(500).json({ error: 'Failed to remove NFT from folder' });
    }
  },

  /**
   * Toggle a folder's public/private status
   */
  toggleFolderVisibility: async (req, res) => {
    try {
      if (!config.features.enablePublicFolders) {
        return res.status(403).json({ error: 'Public folders feature is disabled' });
      }
      
      const { folderId } = req.params;
      const { userId } = req.user;
      const { isPublic } = req.body;
      
      if (isPublic === undefined) {
        return res.status(400).json({ error: 'isPublic field is required' });
      }
      
      // Find the folder and ensure the user owns it
      const folder = await Folder.findOne({ _id: folderId, ownerId: userId });
      
      if (!folder) {
        return res.status(404).json({ error: 'Folder not found or access denied' });
      }
      
      // Update visibility
      folder.isPublic = isPublic;
      folder.updatedAt = new Date();
      
      await folder.save();
      res.json(folder);
    } catch (error) {
      console.error(`Error toggling visibility for folder ${req.params.folderId}:`, error);
      res.status(500).json({ error: 'Failed to update folder visibility' });
    }
  },

  /**
   * Get public folders for a specific user by their Farcaster ID
   */
  getPublicFoldersByUser: async (req, res) => {
    try {
      const { fid } = req.params;
      
      // Find the user by Farcaster ID
      const user = await User.findOne({ farcasterFid: fid });
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Find public folders for this user
      const folders = await Folder.find({ 
        ownerId: user._id,
        isPublic: true
      }).populate('nfts', 'tokenId contractAddress imageUrl name collection');
      
      res.json(folders);
    } catch (error) {
      console.error(`Error fetching public folders for user ${req.params.fid}:`, error);
      res.status(500).json({ error: 'Failed to fetch public folders' });
    }
  },

  /**
   * Get featured public folders (for discovery page)
   */
  getFeaturedFolders: async (req, res) => {
    try {
      if (!config.features.enablePublicFolders) {
        return res.json([]);
      }
      
      // Get featured folders (those with most NFTs or most views)
      const featuredFolders = await Folder.find({ 
        isPublic: true,
        // Only folders with at least one NFT
        'nfts.0': { $exists: true }
      })
      .sort({ viewCount: -1, 'nfts.length': -1 })
      .limit(config.pagination.itemsPerPage || 12)
      .populate('ownerId', 'username farcasterFid')
      .populate('nfts', 'tokenId contractAddress imageUrl name collection');
      
      res.json(featuredFolders);
    } catch (error) {
      console.error('Error fetching featured folders:', error);
      res.status(500).json({ error: 'Failed to fetch featured folders' });
    }
  }
};

module.exports = folderController; 