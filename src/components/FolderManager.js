import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import folderService from '../services/folderService';
import FolderDetail from './FolderDetail';

/**
 * FolderManager Component
 * Allows users to create, view, and manage their NFT folders
 */
const FolderManager = () => {
  const { isAuthenticated, profile } = useAuth();
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFolderId, setActiveFolderId] = useState(null);
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDescription, setNewFolderDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  
  // Fetch user's folders when profile changes
  useEffect(() => {
    if (isAuthenticated && profile?.fid) {
      fetchFolders();
    } else {
      setFolders([]);
      setLoading(false);
    }
  }, [isAuthenticated, profile]);
  
  // Function to fetch user's folders
  const fetchFolders = async () => {
    if (!profile?.fid) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const userFolders = await folderService.getFolders(profile.fid);
      setFolders(userFolders);
    } catch (err) {
      console.error('Error fetching folders:', err);
      setError('Failed to load your folders');
    } finally {
      setLoading(false);
    }
  };
  
  // Function to create a new folder
  const handleCreateFolder = async (e) => {
    e.preventDefault();
    
    if (!newFolderName.trim() || !isAuthenticated || !profile?.fid) {
      return;
    }
    
    try {
      setLoading(true);
      
      const newFolder = await folderService.createFolder({
        name: newFolderName.trim(),
        description: newFolderDescription.trim(),
        isPublic
      }, profile.fid);
      
      setFolders([...folders, newFolder]);
      setNewFolderName('');
      setNewFolderDescription('');
      setIsPublic(false);
      setShowNewFolderDialog(false);
    } catch (err) {
      console.error('Error creating folder:', err);
      setError('Failed to create folder');
    } finally {
      setLoading(false);
    }
  };
  
  // Function to delete a folder
  const handleDeleteFolder = async (folderId) => {
    if (!window.confirm('Are you sure you want to delete this folder?')) {
      return;
    }
    
    try {
      setLoading(true);
      
      await folderService.deleteFolder(folderId, profile?.fid);
      
      // Remove folder from state
      setFolders(folders.filter(f => f.id !== folderId));
    } catch (err) {
      console.error('Error deleting folder:', err);
      setError('Failed to delete folder');
    } finally {
      setLoading(false);
    }
  };
  
  // Show folder detail if a folder is selected
  if (activeFolderId) {
    return (
      <FolderDetail 
        folderId={activeFolderId} 
        onBack={() => setActiveFolderId(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-gray-800">My Folders</h2>
        <button
          onClick={() => setShowNewFolderDialog(true)}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
        >
          New Folder
        </button>
      </div>
      
      {/* New Folder Dialog */}
      {showNewFolderDialog && (
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200 mt-4">
          <h3 className="text-xl font-semibold mb-4">Create New Folder</h3>
          <form onSubmit={handleCreateFolder}>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Folder Name</label>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="My Favorite NFTs"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-gray-700 mb-2">Description (optional)</label>
              <textarea
                value={newFolderDescription}
                onChange={(e) => setNewFolderDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                placeholder="A collection of my favorite NFTs"
                rows="2"
              />
            </div>
            <div className="mb-4 flex items-center">
              <input
                type="checkbox"
                id="isPublic"
                checked={isPublic}
                onChange={(e) => setIsPublic(e.target.checked)}
                className="mr-2"
              />
              <label htmlFor="isPublic" className="text-gray-700">Make this folder public</label>
            </div>
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={() => setShowNewFolderDialog(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                disabled={!newFolderName.trim() || loading}
              >
                Create Folder
              </button>
            </div>
          </form>
        </div>
      )}
      
      {/* Error Message */}
      {error && (
        <div className="bg-red-100 text-red-700 p-4 rounded-lg mt-4">
          {error}
        </div>
      )}
      
      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          <span className="ml-2 text-gray-600">Loading folders...</span>
        </div>
      )}
      
      {/* Folders Grid */}
      {!loading && folders.length === 0 && (
        <div className="text-center py-8 border border-dashed border-gray-300 rounded-lg">
          <p className="text-gray-500">You don't have any folders yet</p>
          <button
            onClick={() => setShowNewFolderDialog(true)}
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Create Your First Folder
          </button>
        </div>
      )}
      
      {!loading && folders.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {folders.map(folder => (
            <div
              key={folder.id || folder._id}
              className="bg-white p-6 rounded-lg shadow-md border border-gray-200 hover:shadow-lg transition-shadow"
            >
              <div className="flex justify-between items-start">
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  {folder.name}
                </h3>
                <span className={`text-xs px-2 py-1 rounded-full ${folder.isPublic ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                  {folder.isPublic ? 'Public' : 'Private'}
                </span>
              </div>
              {folder.description && (
                <p className="text-gray-600 mb-4">{folder.description}</p>
              )}
              <div className="mt-4 text-sm text-gray-500">
                {(folder.nfts?.length || 0)} NFTs
              </div>
              <div className="mt-4 flex space-x-2">
                <button
                  onClick={() => setActiveFolderId(folder.id || folder._id)}
                  className="flex-1 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  View
                </button>
                <button
                  onClick={() => handleDeleteFolder(folder.id || folder._id)}
                  className="px-3 py-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FolderManager; 