import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import folderService from '../services/folderService';

const AddToFolderModal = ({ nft, onClose }) => {
  const { isAuthenticated, profile } = useAuth();
  const [folders, setFolders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedFolderId, setSelectedFolderId] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Load folders when the modal opens
  useEffect(() => {
    if (isAuthenticated && profile?.fid) {
      fetchFolders();
    }
  }, [isAuthenticated, profile]);

  const fetchFolders = async () => {
    if (!profile?.fid) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log("Fetching folders for FID:", profile.fid);
      
      // Try server API first
      try {
        const userFolders = await folderService.getUserFolders(profile.fid);
        console.log("Fetched folders from server:", userFolders);
        setFolders(userFolders);
        
        // Select the first folder by default if there is one
        if (userFolders.length > 0 && !selectedFolderId) {
          setSelectedFolderId(userFolders[0]._id);
        }
      } catch (serverErr) {
        console.error('Server API failed, using local storage:', serverErr);
        // If server API fails, use local storage
        const localFolders = folderService.getFolders(profile.fid);
        console.log("Fetched folders from local storage:", localFolders);
        setFolders(localFolders);
        
        // Select the first folder by default if there is one
        if (localFolders.length > 0 && !selectedFolderId) {
          setSelectedFolderId(localFolders[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch folders:', err);
      setError('Failed to load folders. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim() || !profile?.fid) return;
    
    setIsCreatingFolder(true);
    setError(null);
    
    try {
      const folderData = {
        name: newFolderName.trim(),
        description: '',
        isPublic: false
      };
      
      console.log("Creating folder with data:", folderData);
      
      // Create folder using the service which handles server/local fallback
      const createdFolder = await folderService.createFolder(folderData, profile.fid);
      console.log("Folder created:", createdFolder);
      
      // Check if we have a valid folder object with an ID
      if (!createdFolder || (!createdFolder.id && !createdFolder._id)) {
        throw new Error("Failed to create folder: Invalid folder data");
      }
      
      // Add the new folder to the folders list
      setFolders([...folders, createdFolder]);
      setNewFolderName('');
      
      // Set the selected folder ID to the new folder's ID
      const folderId = createdFolder._id || createdFolder.id;
      console.log("Setting selected folder ID to:", folderId);
      setSelectedFolderId(folderId);
      
      // Verify the selection was set
      setTimeout(() => {
        console.log("Selected folder ID after creation:", selectedFolderId);
      }, 100);
    } catch (err) {
      console.error('Failed to create folder:', err);
      setError(`Failed to create folder: ${err.message || 'Please try again'}`);
    } finally {
      setIsCreatingFolder(false);
    }
  };

  const handleAddToFolder = async () => {
    if (!selectedFolderId || !profile?.fid || !nft) {
      console.error("Missing required data:", {
        selectedFolderId,
        profileFid: profile?.fid,
        nft: !!nft
      });
      setError("Missing required data to add NFT to folder");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    setSuccessMessage('');
    
    try {
      console.log("Adding NFT to folder with ID:", selectedFolderId);
      
      // First try to get the folder to make sure it exists
      let folder;
      try {
        console.log("Verifying folder exists with ID:", selectedFolderId);
        folder = await folderService.getFolder(selectedFolderId, profile.fid);
        
        if (!folder) {
          console.error("Folder not found with ID:", selectedFolderId);
          // Try with alternative ID format
          const altFolderId = selectedFolderId.toString();
          console.log("Trying with alternative ID format:", altFolderId);
          folder = await folderService.getFolder(altFolderId, profile.fid);
          
          if (!folder) {
            throw new Error("Folder not found with either ID format");
          } else {
            console.log("Found folder with alternative ID format:", folder);
            // Update selectedFolderId to the working format
            setSelectedFolderId(altFolderId);
          }
        } else {
          console.log("Found folder with original ID format:", folder);
        }
      } catch (folderErr) {
        console.error("Error verifying folder:", folderErr);
        
        // Check if the folder exists in the local list
        console.log("Checking if folder exists in local list");
        const localFolder = folders.find(f => 
          f._id === selectedFolderId || 
          f.id === selectedFolderId || 
          f._id?.toString() === selectedFolderId || 
          f.id?.toString() === selectedFolderId
        );
        
        if (localFolder) {
          console.log("Found folder in local list:", localFolder);
          folder = localFolder;
        } else {
          setError(`Could not verify folder: ${folderErr.message}`);
          setIsLoading(false);
          return;
        }
      }
      
      // Prepare NFT data from the modal
      const nftData = {
        tokenId: nft.tokenId || '',
        contractAddress: nft.contractAddress || nft.collection?.id || '',
        network: 'ethereum',
        name: nft.name || 'Unnamed NFT',
        imageUrl: nft.mediasV2?.[0]?.url || nft.imageUrl || nft.tokenImg || nft.image || '',
        collectionName: nft.collection?.name || 'Unknown Collection',
        estimatedValueUsd: nft.estimatedValueEth ? nft.estimatedValueEth * 3000 : null // Rough USD conversion
      };
      
      console.log("NFT data to be added:", nftData);
      
      // Get the effective folder ID (could be _id or id)
      const effectiveFolderId = folder._id || folder.id;
      console.log("Using effective folder ID for operation:", effectiveFolderId);
      
      // Attempt to add NFT to folder - service handles server/local fallback
      const updatedFolder = await folderService.addNftToFolder(effectiveFolderId, nftData, profile.fid);
      console.log("NFT added to folder successfully:", updatedFolder);
      
      // Success message
      setSuccessMessage('NFT added to folder successfully');
      
      // Update the folders list to reflect the changes
      fetchFolders();
      
      // Close modal after a short delay
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error('Failed to add NFT to folder:', err);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to add NFT to folder.';
      
      if (err.response) {
        if (err.response.status === 401) {
          errorMessage = 'Authentication failed. Please sign in again.';
        } else if (err.response.status === 404) {
          errorMessage = 'Folder not found. It may have been deleted.';
        } else {
          errorMessage = `Error ${err.response.status}: ${err.response.data?.error || 'Unknown error'}`;
        }
      } else if (err.request) {
        errorMessage = 'No response from server. Please check your connection.';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="modal-backdrop">
        <div className="modal-content">
          <div className="modal-header">
            <h2>Sign In Required</h2>
            <button className="close-button" onClick={onClose}>×</button>
          </div>
          <div className="modal-body">
            <p>You need to sign in with Farcaster to add NFTs to folders.</p>
          </div>
          <div className="modal-footer">
            <button 
              className="btn btn-primary"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Add to Folder</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          {error && (
            <div className="error-message mb-4">
              {error}
            </div>
          )}
          
          {successMessage && (
            <div className="success-message mb-4">
              {successMessage}
            </div>
          )}
          
          {isLoading ? (
            <div className="text-center py-4">
              <div className="spinner"></div>
              <p className="mt-2">Loading...</p>
            </div>
          ) : (
            <>
              <div className="nft-preview mb-4">
                <div className="nft-preview-image">
                  <img 
                    src={nft.mediasV2?.[0]?.url || nft.imageUrl || nft.tokenImg || nft.image || 'https://via.placeholder.com/100'} 
                    alt={nft.name || 'NFT'} 
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = `https://via.placeholder.com/100/a78bfa/ffffff?text=${nft.name?.charAt(0) || '?'}`;
                    }}
                  />
                </div>
                <div className="nft-preview-info">
                  <h3>{nft.name || 'Unnamed NFT'}</h3>
                  <p>{nft.collection?.name || 'Unknown Collection'}</p>
                </div>
              </div>
              
              <div className="mb-4">
                <h3 className="text-lg font-medium mb-2">Select Folder</h3>
                
                {folders.length === 0 ? (
                  <p className="text-gray-500">You don't have any folders yet.</p>
                ) : (
                  <select
                    value={selectedFolderId}
                    onChange={(e) => {
                      console.log("Selected folder changed to:", e.target.value);
                      setSelectedFolderId(e.target.value);
                    }}
                    className="w-full p-2 border border-gray-300 rounded-md"
                    disabled={isLoading}
                  >
                    <option value="">-- Select a folder --</option>
                    {folders.map(folder => {
                      const folderId = folder._id || folder.id;
                      return (
                        <option key={folderId} value={folderId}>
                          {folder.name} ({folder.nfts?.length || 0} NFTs)
                        </option>
                      );
                    })}
                  </select>
                )}
              </div>
              
              <div className="create-folder-form mb-4">
                <h3 className="text-lg font-medium mb-2">Or Create a New Folder</h3>
                
                <div className="flex">
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    className="flex-grow p-2 border border-gray-300 rounded-l-md"
                    placeholder="New folder name"
                    disabled={isCreatingFolder}
                  />
                  <button
                    className="btn btn-secondary rounded-l-none"
                    onClick={handleCreateFolder}
                    disabled={!newFolderName.trim() || isCreatingFolder}
                  >
                    {isCreatingFolder ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
        
        <div className="modal-footer">
          <button 
            className="btn btn-ghost"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button 
            className="btn btn-primary"
            onClick={handleAddToFolder}
            disabled={isLoading || !selectedFolderId || !!successMessage}
          >
            {isLoading ? 'Adding...' : 'Add to Folder'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddToFolderModal; 