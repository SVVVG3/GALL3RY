import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import folderService from '../services/folderService';
import NFTGrid from './NFTGrid';

const FolderDetail = ({ folderId, onBack, useLocalStorage = false, onLocalStorageMode, readOnly = false }) => {
  const { isAuthenticated, profile } = useAuth();
  const [folder, setFolder] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedFolder, setEditedFolder] = useState({
    name: '',
    description: '',
    isPublic: false
  });
  const [isLocalStorage, setIsLocalStorage] = useState(useLocalStorage);
  const [sortOption, setSortOption] = useState('default');
  const [sortedNfts, setSortedNfts] = useState([]);
  
  // Update local state when prop changes
  useEffect(() => {
    setIsLocalStorage(useLocalStorage);
  }, [useLocalStorage]);

  // Load folder details when folderId changes
  useEffect(() => {
    if (folderId) {
      fetchFolderDetails();
    }
  }, [folderId, isLocalStorage]);
  
  // Apply sorting when folder NFTs or sort option changes
  useEffect(() => {
    if (folder && folder.nfts && folder.nfts.length > 0) {
      setSortedNfts(sortNfts(folder.nfts, sortOption));
    } else {
      setSortedNfts([]);
    }
  }, [folder, sortOption]);
  
  // Function to sort NFTs based on the selected option
  const sortNfts = (nftArray, option) => {
    if (!nftArray || nftArray.length === 0) return [];
    
    const nftsCopy = [...nftArray];
    
    switch (option) {
      case 'name-asc':
        return nftsCopy.sort((a, b) => {
          const nameA = (a.name || a.collection?.name || '').toLowerCase();
          const nameB = (b.name || b.collection?.name || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });
      
      case 'name-desc':
        return nftsCopy.sort((a, b) => {
          const nameA = (a.name || a.collection?.name || '').toLowerCase();
          const nameB = (b.name || b.collection?.name || '').toLowerCase();
          return nameB.localeCompare(nameA);
        });
      
      case 'collection':
        return nftsCopy.sort((a, b) => {
          const collectionA = (a.collection?.name || '').toLowerCase();
          const collectionB = (b.collection?.name || '').toLowerCase();
          return collectionA.localeCompare(collectionB);
        });
      
      case 'price-high':
        return nftsCopy.sort((a, b) => {
          const priceA = a.estimatedValueUsd || (a.estimatedValueEth ? a.estimatedValueEth : 0);
          const priceB = b.estimatedValueUsd || (b.estimatedValueEth ? b.estimatedValueEth : 0);
          return priceB - priceA; // Higher first
        });
      
      case 'price-low':
        return nftsCopy.sort((a, b) => {
          const priceA = a.estimatedValueUsd || (a.estimatedValueEth ? a.estimatedValueEth : 0);
          const priceB = b.estimatedValueUsd || (b.estimatedValueEth ? b.estimatedValueEth : 0);
          return priceA - priceB; // Lower first
        });
      
      case 'default':
      default:
        return nftsCopy; // No sorting
    }
  };
  
  // Handle sort option change
  const handleSortChange = (e) => {
    setSortOption(e.target.value);
  };

  const fetchFolderDetails = async () => {
    // In read-only mode, we don't require authentication
    if (!folderId || (!isAuthenticated && !readOnly)) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log("Fetching folder details for ID:", folderId);
      
      let folderData = null;
      
      if (!isLocalStorage) {
        try {
          // First try the server API
          // If in read-only mode and not authenticated, don't pass a profile FID
          const userFid = readOnly ? null : (profile?.fid || null);
          folderData = await folderService.getFolder(folderId, userFid);
          console.log("Fetched folder from server:", folderData);
        } catch (serverErr) {
          console.error('Server API failed, trying local storage:', serverErr);
          if (!readOnly) {
            setIsLocalStorage(true);
            if (onLocalStorageMode) onLocalStorageMode(true);
          }
          // If server API fails, try local storage
        }
      }
      
      if (!folderData) {
        // Try local storage if server failed or we're already using local storage
        folderData = folderService.getFolder(folderId);
        console.log("Fetched folder from local storage:", folderData);
        
        if (!folderData) {
          throw new Error('Folder not found in local storage either');
        }
      }
      
      setFolder(folderData);
      setEditedFolder({
        name: folderData.name,
        description: folderData.description || '',
        isPublic: folderData.isPublic
      });
    } catch (err) {
      console.error('Failed to fetch folder details:', err);
      setError('Failed to load folder details. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateFolder = async (e) => {
    e.preventDefault();
    if (!folderId || !isAuthenticated || !profile?.fid) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log("Updating folder:", folderId, "with data:", editedFolder);
      
      let updatedFolder = null;
      
      if (!isLocalStorage) {
        try {
          // Try the server API first
          updatedFolder = await folderService.updateFolder(
            folderId, 
            editedFolder, 
            profile.fid
          );
          console.log("Folder updated on server:", updatedFolder);
        } catch (serverErr) {
          console.error('Server API failed, updating locally:', serverErr);
          setIsLocalStorage(true);
          if (onLocalStorageMode) onLocalStorageMode(true);
          // If server API fails, update locally
        }
      }
      
      if (!updatedFolder) {
        // If server failed or we're using local storage
        updatedFolder = folderService.updateFolder(folderId, editedFolder);
        console.log("Folder updated locally:", updatedFolder);
      }
      
      setFolder(updatedFolder);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to update folder:', err);
      setError('Failed to update folder. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteFolder = async () => {
    if (!folderId || !isAuthenticated || !profile?.fid) return;
    
    if (!window.confirm('Are you sure you want to delete this folder?')) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log("Deleting folder:", folderId);
      
      let deleted = false;
      
      if (!isLocalStorage) {
        try {
          // Try server API first
          await folderService.deleteFolder(folderId, profile.fid);
          console.log("Folder deleted on server");
          deleted = true;
        } catch (serverErr) {
          console.error('Server API failed, deleting locally:', serverErr);
          setIsLocalStorage(true);
          if (onLocalStorageMode) onLocalStorageMode(true);
          // If server API fails, delete locally
        }
      }
      
      if (!deleted) {
        // If server failed or we're using local storage
        deleted = folderService.deleteFolder(folderId);
        console.log("Folder deleted locally:", deleted);
        
        if (!deleted) {
          throw new Error('Failed to delete folder locally');
        }
      }
      
      if (onBack) onBack();
    } catch (err) {
      console.error('Failed to delete folder:', err);
      setError('Failed to delete folder. Please try again.');
      setIsLoading(false);
    }
  };

  const handleRemoveNft = async (nftId) => {
    if (!folderId || !nftId || !isAuthenticated || !profile?.fid) return;
    
    if (!window.confirm('Remove this NFT from the folder?')) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log("Removing NFT:", nftId, "from folder:", folderId);
      
      let updatedFolder = null;
      
      if (!isLocalStorage) {
        try {
          // Try server API first
          updatedFolder = await folderService.removeNftFromFolder(
            folderId, 
            nftId, 
            profile.fid
          );
          console.log("NFT removed on server:", updatedFolder);
        } catch (serverErr) {
          console.error('Server API failed, removing locally:', serverErr);
          setIsLocalStorage(true);
          if (onLocalStorageMode) onLocalStorageMode(true);
          // If server API fails, remove locally
        }
      }
      
      if (!updatedFolder) {
        // If server failed or we're using local storage
        updatedFolder = folderService.removeNftFromFolder(folderId, nftId);
        console.log("NFT removed locally:", updatedFolder);
      }
      
      setFolder(updatedFolder);
    } catch (err) {
      console.error('Failed to remove NFT from folder:', err);
      setError('Failed to remove NFT. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !folder) {
    return (
      <div className="flex justify-center items-center p-12">
        <div className="spinner"></div>
      </div>
    );
  }

  if (error && !folder) {
    return (
      <div className="bg-red-100 text-red-700 p-4 rounded-lg">
        <p>{error}</p>
        <button 
          className="mt-2 underline text-red-600"
          onClick={onBack}
        >
          Go back
        </button>
      </div>
    );
  }

  if (!folder) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">Folder not found</p>
        <button 
          className="mt-2 btn btn-sm btn-primary"
          onClick={onBack}
        >
          Back to Folders
        </button>
      </div>
    );
  }

  return (
    <div className="folder-detail">
      <div className="mb-4">
        <button 
          className="flex items-center text-gray-600 hover:text-gray-900" 
          onClick={onBack}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Back to Folders
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          <span className="ml-2 text-gray-600">Loading folder...</span>
        </div>
      ) : error ? (
        <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-4">
          {error}
        </div>
      ) : folder ? (
        <div>
          <div className="flex flex-wrap items-start justify-between mb-6">
            <div>
              {isEditing ? (
                <div className="w-full max-w-lg">
                  <form onSubmit={handleUpdateFolder}>
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-1">Folder Name</label>
                      <input 
                        type="text" 
                        value={editedFolder.name}
                        onChange={(e) => setEditedFolder({...editedFolder, name: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        required
                      />
                    </div>
                    
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-1">Description</label>
                      <textarea
                        value={editedFolder.description || ''}
                        onChange={(e) => setEditedFolder({...editedFolder, description: e.target.value})}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        rows="3"
                      />
                    </div>
                    
                    <div className="mb-4">
                      <label className="flex items-center">
                        <input 
                          type="checkbox"
                          checked={editedFolder.isPublic}
                          onChange={(e) => setEditedFolder({...editedFolder, isPublic: e.target.checked})}
                          className="mr-2"
                        />
                        <span>Make this folder public</span>
                      </label>
                      <p className="text-sm text-gray-500 mt-1">Public folders can be viewed by anyone who visits your profile</p>
                    </div>
                    
                    <div className="flex space-x-2">
                      <button 
                        type="submit" 
                        className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                        disabled={isLoading}
                      >
                        Save Changes
                      </button>
                      <button 
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-100"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <>
                  <h1 className="text-2xl font-bold mb-2">{folder.name}</h1>
                  {folder.description && (
                    <p className="text-gray-600 mb-2">{folder.description}</p>
                  )}
                  <div className="flex flex-wrap gap-2 mt-2">
                    <span className={`text-xs ${folder.isPublic ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'} rounded-full px-2 py-1`}>
                      {folder.isPublic ? 'Public' : 'Private'}
                    </span>
                    <span className="text-xs bg-purple-100 text-purple-700 rounded-full px-2 py-1">
                      {folder.nfts?.length || 0} NFTs
                    </span>
                  </div>
                </>
              )}
            </div>
            
            {!readOnly && (
              <div className="flex space-x-2 mt-2 sm:mt-0">
                {!isEditing && (
                  <>
                    <button 
                      onClick={() => setIsEditing(true)}
                      className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-100 flex items-center"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                      Edit
                    </button>
                    <button 
                      onClick={handleDeleteFolder}
                      className="px-3 py-1 text-sm border border-red-300 text-red-600 rounded-md hover:bg-red-50 flex items-center"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      Delete
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          
          {folder.nfts && folder.nfts.length > 0 ? (
            <div className="mt-6">
              {/* Sorting UI */}
              <div className="sort-container">
                <label htmlFor="folder-sort-options" className="sort-label">
                  Sort by:
                </label>
                <select
                  id="folder-sort-options"
                  className="sort-select"
                  value={sortOption}
                  onChange={handleSortChange}
                >
                  <option value="default">Default</option>
                  <option value="name-asc">Name (A-Z)</option>
                  <option value="name-desc">Name (Z-A)</option>
                  <option value="collection">Collection</option>
                  <option value="price-high">Price (High to Low)</option>
                  <option value="price-low">Price (Low to High)</option>
                </select>
              </div>
              <NFTGrid 
                nfts={sortedNfts} 
                onRemoveNft={!readOnly ? handleRemoveNft : null}
                isOwner={!readOnly}
              />
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg">
              This folder is empty
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          Folder not found
        </div>
      )}
    </div>
  );
};

export default FolderDetail; 