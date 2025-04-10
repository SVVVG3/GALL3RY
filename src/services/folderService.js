import axios from 'axios';
import config from '../config';

const API_URL = config.apiUrl || 'http://localhost:3001';

/**
 * Service for handling all folder-related operations
 */
const folderService = {
  /**
   * Get all folders for the authenticated user
   */
  getUserFolders: async (token) => {
    try {
      const response = await axios.get(`${API_URL}/folders`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      console.error('Error fetching user folders:', error);
      throw error;
    }
  },

  /**
   * Get a specific folder by ID
   */
  getFolder: async (folderId, token) => {
    try {
      const response = await axios.get(`${API_URL}/folders/${folderId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      console.error(`Error fetching folder ${folderId}:`, error);
      throw error;
    }
  },

  /**
   * Create a new folder
   */
  createFolder: async (folderData, token) => {
    try {
      const response = await axios.post(`${API_URL}/folders`, folderData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return response.data;
    } catch (error) {
      console.error('Error creating folder:', error);
      throw error;
    }
  },

  /**
   * Update a folder's details
   */
  updateFolder: async (folderId, folderData, token) => {
    try {
      const response = await axios.put(
        `${API_URL}/folders/${folderId}`, 
        folderData, 
        { headers: { Authorization: `Bearer ${token}` }}
      );
      return response.data;
    } catch (error) {
      console.error(`Error updating folder ${folderId}:`, error);
      throw error;
    }
  },

  /**
   * Delete a folder
   */
  deleteFolder: async (folderId, token) => {
    try {
      await axios.delete(`${API_URL}/folders/${folderId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return true;
    } catch (error) {
      console.error(`Error deleting folder ${folderId}:`, error);
      throw error;
    }
  },

  /**
   * Add an NFT to a folder
   */
  addNftToFolder: async (folderId, nftData, token) => {
    try {
      const response = await axios.post(
        `${API_URL}/folders/${folderId}/nfts`, 
        nftData, 
        { headers: { Authorization: `Bearer ${token}` }}
      );
      return response.data;
    } catch (error) {
      console.error(`Error adding NFT to folder ${folderId}:`, error);
      throw error;
    }
  },

  /**
   * Remove an NFT from a folder
   */
  removeNftFromFolder: async (folderId, nftId, token) => {
    try {
      await axios.delete(`${API_URL}/folders/${folderId}/nfts/${nftId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      return true;
    } catch (error) {
      console.error(`Error removing NFT ${nftId} from folder ${folderId}:`, error);
      throw error;
    }
  },

  /**
   * Toggle a folder's public/private status
   */
  toggleFolderVisibility: async (folderId, isPublic, token) => {
    try {
      const response = await axios.patch(
        `${API_URL}/folders/${folderId}/visibility`, 
        { isPublic }, 
        { headers: { Authorization: `Bearer ${token}` }}
      );
      return response.data;
    } catch (error) {
      console.error(`Error toggling visibility for folder ${folderId}:`, error);
      throw error;
    }
  },

  /**
   * Get public folders for a specific user by their Farcaster ID
   */
  getPublicFoldersByUser: async (fid) => {
    try {
      const response = await axios.get(`${API_URL}/users/${fid}/folders/public`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching public folders for user ${fid}:`, error);
      throw error;
    }
  },

  /**
   * Get featured public folders (for discovery page)
   */
  getFeaturedFolders: async () => {
    try {
      const response = await axios.get(`${API_URL}/folders/featured`);
      return response.data;
    } catch (error) {
      console.error('Error fetching featured folders:', error);
      throw error;
    }
  }
};

export default folderService; 