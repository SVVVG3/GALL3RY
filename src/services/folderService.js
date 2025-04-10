import axios from 'axios';
import { ClientFolder } from '../models/Folder';

/**
 * Service for managing folders
 * Provides methods for CRUD operations and supports both API and localStorage
 */
class FolderService {
  constructor() {
    // Use client-side API URL
    this.apiUrl = '/api';
    
    // Local storage key prefix
    this.localStorageKey = 'nft_gallery_folders';
    
    // Initialize memory cache
    this.cachedFolders = null;
  }

  /**
   * Get all folders for the authenticated user
   */
  async getFolders(userId = null) {
    // Try API first
    try {
      console.log('Fetching folders from API');
      
      const config = userId ? { headers: { 'Authorization': userId } } : {};
      const response = await axios.get(`${this.apiUrl}/folders`, config);
      
      console.log('API returned folders:', response.data);
      return response.data;
    } catch (error) {
      console.error('API folder fetch failed:', error);
      
      // Fall back to local storage
      console.log('Falling back to local storage for folders');
      return this.getLocalFolders(userId);
    }
  }

  /**
   * Get folders from local storage
   */
  getLocalFolders(userId) {
    try {
      // Get folders from local storage
      const allFolders = JSON.parse(localStorage.getItem(this.localStorageKey) || '[]');
      
      // Filter by user ID if provided
      const userFolders = userId
        ? allFolders.filter(folder => folder.userId === userId)
        : allFolders;
      
      console.log(`Found ${userFolders.length} folders in local storage for user ${userId || 'all'}`);
      return userFolders;
    } catch (error) {
      console.error('Error reading from local storage:', error);
      return [];
    }
  }

  /**
   * Get a specific folder by ID
   */
  async getFolder(folderId, userId = null) {
    if (!folderId) return null;
    
    // Try API first
    try {
      console.log(`Fetching folder ${folderId} from API`);
      
      const config = userId ? { headers: { 'Authorization': userId } } : {};
      const response = await axios.get(`${this.apiUrl}/folders/${folderId}`, config);
      
      console.log('API returned folder:', response.data);
      return response.data;
    } catch (error) {
      console.error('API folder fetch failed:', error);
      
      // Fall back to local storage
      console.log(`Falling back to local storage for folder ${folderId}`);
      return this.getLocalFolder(folderId);
    }
  }

  /**
   * Get a folder from local storage
   */
  getLocalFolder(folderId) {
    try {
      // Get folders from local storage
      const folders = JSON.parse(localStorage.getItem(this.localStorageKey) || '[]');
      
      // Find the specific folder
      const folder = folders.find(f => f.id === folderId);
      
      console.log(`${folder ? 'Found' : 'Could not find'} folder ${folderId} in local storage`);
      return folder || null;
    } catch (error) {
      console.error('Error reading from local storage:', error);
      return null;
    }
  }

  /**
   * Create a new folder
   */
  async createFolder(folderData, userId) {
    // Try API first
    try {
      console.log('Creating folder via API:', folderData);
      
      const config = userId ? { headers: { 'Authorization': userId } } : {};
      const response = await axios.post(`${this.apiUrl}/folders`, folderData, config);
      
      console.log('API created folder:', response.data);
      return response.data;
    } catch (error) {
      console.error('API folder creation failed:', error);
      
      // Fall back to local storage
      console.log('Falling back to local storage for folder creation');
      return this.createLocalFolder(folderData, userId);
    }
  }

  /**
   * Create a folder in local storage
   */
  createLocalFolder(folderData, userId) {
    try {
      // Get existing folders
      const folders = JSON.parse(localStorage.getItem(this.localStorageKey) || '[]');
      
      // Create a new folder with a unique ID
      const newFolder = {
        ...folderData,
        id: 'local_' + Date.now(),
        userId: userId || 'anonymous',
        nfts: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      // Add folder to array and save
      folders.push(newFolder);
      localStorage.setItem(this.localStorageKey, JSON.stringify(folders));
      
      console.log('Folder created in local storage:', newFolder);
      return newFolder;
    } catch (error) {
      console.error('Error saving to local storage:', error);
      throw new Error('Failed to create folder locally');
    }
  }

  /**
   * Update an existing folder
   */
  async updateFolder(folderId, folderData, userId) {
    // Try API first
    try {
      console.log(`Updating folder ${folderId} via API:`, folderData);
      
      const config = userId ? { headers: { 'Authorization': userId } } : {};
      const response = await axios.put(`${this.apiUrl}/folders/${folderId}`, folderData, config);
      
      console.log('API updated folder:', response.data);
      return response.data;
    } catch (error) {
      console.error('API folder update failed:', error);
      
      // Fall back to local storage
      console.log(`Falling back to local storage for updating folder ${folderId}`);
      return this.updateLocalFolder(folderId, folderData);
    }
  }

  /**
   * Update a folder in local storage
   */
  updateLocalFolder(folderId, folderData) {
    try {
      // Get existing folders
      const folders = JSON.parse(localStorage.getItem(this.localStorageKey) || '[]');
      
      // Find the folder to update
      const folderIndex = folders.findIndex(f => f.id === folderId);
      
      if (folderIndex === -1) {
        throw new Error(`Folder not found: ${folderId}`);
      }
      
      // Update the folder
      folders[folderIndex] = {
        ...folders[folderIndex],
        ...folderData,
        updatedAt: new Date().toISOString()
      };
      
      // Save updated folders
      localStorage.setItem(this.localStorageKey, JSON.stringify(folders));
      
      console.log('Folder updated in local storage:', folders[folderIndex]);
      return folders[folderIndex];
    } catch (error) {
      console.error('Error updating in local storage:', error);
      throw new Error('Failed to update folder locally');
    }
  }

  /**
   * Delete a folder
   */
  async deleteFolder(folderId, userId) {
    // Try API first
    try {
      console.log(`Deleting folder ${folderId} via API`);
      
      const config = userId ? { headers: { 'Authorization': userId } } : {};
      await axios.delete(`${this.apiUrl}/folders/${folderId}`, config);
      
      console.log('API deleted folder');
      return true;
    } catch (error) {
      console.error('API folder deletion failed:', error);
      
      // Fall back to local storage
      console.log(`Falling back to local storage for deleting folder ${folderId}`);
      return this.deleteLocalFolder(folderId);
    }
  }

  /**
   * Delete a folder from local storage
   */
  deleteLocalFolder(folderId) {
    try {
      // Get existing folders
      const folders = JSON.parse(localStorage.getItem(this.localStorageKey) || '[]');
      
      // Filter out the folder to delete
      const updatedFolders = folders.filter(f => f.id !== folderId);
      
      // Save updated folders
      localStorage.setItem(this.localStorageKey, JSON.stringify(updatedFolders));
      
      console.log(`Folder ${folderId} deleted from local storage`);
      return true;
    } catch (error) {
      console.error('Error deleting from local storage:', error);
      throw new Error('Failed to delete folder locally');
    }
  }

  /**
   * Get public folders for a user
   */
  async getPublicFolders(username) {
    if (!username) return [];
    
    // Try API
    try {
      console.log(`Fetching public folders for user ${username} from API`);
      
      const response = await axios.get(`${this.apiUrl}/folders/public/${username}`);
      
      console.log(`API returned ${response.data.length} public folders for ${username}`);
      return response.data;
    } catch (error) {
      console.error('API public folders fetch failed:', error);
      
      // Fallback to local storage isn't really meaningful for public folders
      // as they should be user-specific and retrieved from the server
      console.log('Returning empty array for public folders');
      return [];
    }
  }

  /**
   * Add an NFT to a folder
   */
  async addNftToFolder(folderId, nftData, userId) {
    // For this operation, we'll simply update the folder
    const folder = await this.getFolder(folderId, userId);
    
    if (!folder) {
      throw new Error(`Folder not found: ${folderId}`);
    }
    
    // Check if NFT already exists in the folder
    const nftExists = folder.nfts && folder.nfts.some(nft => 
      nft.tokenId === nftData.tokenId && 
      nft.contractAddress === nftData.contractAddress
    );
    
    if (nftExists) {
      console.log('NFT already exists in folder');
      return folder;
    }
    
    // Add NFT to folder
    const updatedNfts = [...(folder.nfts || []), { 
      ...nftData, 
      addedAt: new Date().toISOString() 
    }];
    
    // Update the folder
    return this.updateFolder(folderId, { nfts: updatedNfts }, userId);
  }

  /**
   * Remove an NFT from a folder
   */
  async removeNftFromFolder(folderId, nftId, userId) {
    // For this operation, we'll simply update the folder
    const folder = await this.getFolder(folderId, userId);
    
    if (!folder || !folder.nfts) {
      throw new Error(`Folder not found: ${folderId}`);
    }
    
    // Filter out the NFT to remove
    const updatedNfts = folder.nfts.filter(nft => nft.id !== nftId && nft._id !== nftId);
    
    // Update the folder
    return this.updateFolder(folderId, { nfts: updatedNfts }, userId);
  }
}

export default new FolderService(); 