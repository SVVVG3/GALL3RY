import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import folderService from '../services/folderService';
import ClientFolder from '../models/ClientFolder';

const FolderList = ({ onSelectFolder, selectedFolderId, useLocalStorage = false, onLocalStorageMode }) => {
  const { isAuthenticated, profile } = useAuth();
  const [folders, setFolders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isLocalStorage, setIsLocalStorage] = useState(useLocalStorage);

  // Update local state when prop changes
  useEffect(() => {
    setIsLocalStorage(useLocalStorage);
  }, [useLocalStorage]);

  // Load folders when the component mounts or auth state changes
  useEffect(() => {
    if (isAuthenticated && profile?.fid) {
      fetchFolders();
    } else {
      setFolders([]);
    }
  }, [isAuthenticated, profile, isLocalStorage]);

  const fetchFolders = async () => {
    if (!profile?.fid) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log("Fetching folders for FID:", profile.fid);
      
      if (isLocalStorage) {
        // If we're using local storage, don't try the server
        const localFolders = folderService.getFolders(profile.fid);
        console.log("Using local folders:", localFolders);
        setFolders(localFolders);
      } else {
        try {
          // First try the server
          const userFolders = await folderService.getUserFolders(profile.fid);
          console.log("Fetched folders from server:", userFolders);
          setFolders(userFolders);
        } catch (serverErr) {
          console.error('Failed to fetch folders from server:', serverErr);
          // Fallback to local storage
          const localFolders = folderService.getFolders(profile.fid);
          console.log("Using local folders as fallback:", localFolders);
          setFolders(localFolders);
          setIsLocalStorage(true);
          if (onLocalStorageMode) onLocalStorageMode(true);
        }
      }
    } catch (err) {
      console.error('Failed to fetch any folders:', err);
      setError('Failed to load folders. Using local storage only.');
      setIsLocalStorage(true);
      if (onLocalStorageMode) onLocalStorageMode(true);
      // One last attempt with local storage
      try {
        const localFolders = folderService.getFolders(profile.fid) || [];
        setFolders(localFolders);
      } catch (localErr) {
        console.error('Failed to load local folders:', localErr);
        setFolders([]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim() || !profile?.fid) return;
    
    setIsCreating(true);
    setError(null);
    
    try {
      const folderData = {
        name: newFolderName.trim(),
        description: '',
        isPublic: false
      };
      
      console.log("Creating folder with data:", folderData, "for FID:", profile.fid);
      
      // Try to create the folder (service will handle server/local fallback)
      const createdFolder = await folderService.createFolder(folderData, profile.fid);
      console.log("Folder created successfully:", createdFolder);
      
      // If we got here, the folder was created either on server or locally
      setFolders([...folders, createdFolder]);
      setNewFolderName('');
      setShowCreateForm(false);
      
      // Select the newly created folder
      if (onSelectFolder) {
        const folderId = createdFolder._id || createdFolder.id;
        if (folderId) {
          onSelectFolder(folderId);
        }
      }
    } catch (err) {
      console.error('Failed to create folder:', err);
      let errorMessage = 'Failed to create folder.';
      
      // Provide more specific error messages
      if (err.response) {
        if (err.response.status === 401) {
          errorMessage = 'Authentication failed. Please sign in again.';
        } else if (err.response.status === 404) {
          errorMessage = 'Server endpoint not found. Using local storage.';
          setIsLocalStorage(true);
          if (onLocalStorageMode) onLocalStorageMode(true);
          
          // Try creating with local storage
          try {
            const newFolder = folderService.createLocalFolderFallback({
              name: newFolderName.trim(),
              description: '',
              isPublic: false
            }, profile.fid);
            
            setFolders([...folders, newFolder]);
            setNewFolderName('');
            setShowCreateForm(false);
            
            // Select the newly created folder
            if (onSelectFolder && newFolder.id) {
              onSelectFolder(newFolder.id);
            }
            
            return; // Exit early after successful local creation
          } catch (localErr) {
            console.error('Failed to create local folder:', localErr);
          }
        } else {
          errorMessage = `Error ${err.response.status}: ${err.response.data?.error || 'Unknown error'}`;
        }
      } else if (err.request) {
        errorMessage = 'No response from server. Please check your connection.';
      }
      
      setError(errorMessage);
    } finally {
      setIsCreating(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="mb-6 p-4 bg-gray-100 rounded-lg">
        <p className="text-gray-600 text-sm">Sign in to view and create folders</p>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Your Folders</h2>
        <button 
          className="btn btn-sm btn-primary"
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          {showCreateForm ? 'Cancel' : 'New Folder'}
        </button>
      </div>

      {error && (
        <div className="bg-red-100 text-red-700 p-3 rounded-lg mb-4">
          {error}
        </div>
      )}
      
      {isLocalStorage && (
        <div className="bg-yellow-100 text-yellow-800 p-3 rounded-lg mb-4">
          Using local storage for folders (server unavailable)
        </div>
      )}

      {showCreateForm && (
        <form onSubmit={handleCreateFolder} className="mb-6 p-4 bg-gray-100 rounded-lg">
          <div className="mb-3">
            <label htmlFor="folderName" className="block mb-1 text-sm font-medium">
              Folder Name
            </label>
            <input
              type="text"
              id="folderName"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              placeholder="My Collection"
              disabled={isCreating}
              required
            />
          </div>
          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={isCreating || !newFolderName.trim()}
          >
            {isCreating ? 'Creating...' : 'Create Folder'}
          </button>
        </form>
      )}

      {isLoading ? (
        <div className="flex justify-center p-4">
          <div className="spinner"></div>
        </div>
      ) : folders.length === 0 ? (
        <div className="text-center py-6 bg-gray-50 rounded-lg">
          <p className="text-gray-500">You don't have any folders yet</p>
          {!showCreateForm && (
            <button 
              className="mt-2 text-blue-500 underline"
              onClick={() => setShowCreateForm(true)}
            >
              Create your first folder
            </button>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {folders.map(folder => (
            <li 
              key={folder._id || folder.id} 
              className={`p-3 rounded-lg cursor-pointer transition-colors ${
                selectedFolderId === (folder._id || folder.id) ? 'bg-blue-100' : 'bg-gray-50 hover:bg-gray-100'
              }`}
              onClick={() => onSelectFolder && onSelectFolder(folder._id || folder.id)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{folder.name}</h3>
                  <p className="text-sm text-gray-500">
                    {folder.nfts?.length || 0} NFT{folder.nfts?.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="text-xs px-2 py-1 rounded bg-gray-200">
                  {folder.isPublic ? 'Public' : 'Private'}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default FolderList; 