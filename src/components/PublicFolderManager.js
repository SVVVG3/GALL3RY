import React, { useState, useEffect } from 'react';
import FolderDetail from './FolderDetail';
import folderService from '../services/folderService';

/**
 * PublicFolderManager component
 * Displays public folders for a specific user
 */
const PublicFolderManager = ({ username, fid }) => {
  const [publicFolders, setPublicFolders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeFolderId, setActiveFolderId] = useState(null);
  
  // Fetch public folders when username or fid changes
  useEffect(() => {
    if (username || fid) {
      fetchPublicFolders();
    }
  }, [username, fid]);
  
  const fetchPublicFolders = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      let folders = [];
      
      // Try with username first if available
      if (username) {
        console.log(`Fetching public folders for username: ${username}`);
        folders = await folderService.getPublicFolders(username);
      } 
      // Use FID as fallback
      else if (fid) {
        console.log(`Fetching public folders for FID: ${fid}`);
        folders = await folderService.getPublicFoldersForUser(fid);
      }
      
      console.log(`Found ${folders.length} public folders`);
      setPublicFolders(folders);
    } catch (err) {
      console.error('Error fetching public folders:', err);
      setError('Failed to load public folders');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle folder selection
  const handleSelectFolder = (folderId) => {
    setActiveFolderId(folderId);
  };
  
  // Handle back to folder list
  const handleBackToList = () => {
    setActiveFolderId(null);
  };
  
  // Show folder details if a folder is selected
  if (activeFolderId) {
    return (
      <FolderDetail 
        folderId={activeFolderId} 
        onBack={handleBackToList}
        readOnly={true} // Public folders are view-only
      />
    );
  }
  
  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
        <span className="ml-2 text-gray-600">Loading folders...</span>
      </div>
    );
  }
  
  // Show error state
  if (error) {
    return (
      <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-4">
        {error}
      </div>
    );
  }
  
  // Show empty state
  if (publicFolders.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No public folders found for this user
      </div>
    );
  }
  
  // Show the list of public folders
  return (
    <div className="mb-6">
      <h2 className="text-xl font-semibold mb-4">Public Folders</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {publicFolders.map(folder => (
          <div 
            key={folder.id || folder._id} 
            className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm hover:shadow-md cursor-pointer transition-all"
            onClick={() => handleSelectFolder(folder.id || folder._id)}
          >
            <h3 className="text-lg font-medium mb-2">{folder.name}</h3>
            {folder.description && (
              <p className="text-gray-600 text-sm mb-2">{folder.description}</p>
            )}
            <div className="flex items-center mt-2">
              <span className="text-xs bg-purple-100 text-purple-700 rounded-full px-2 py-1">
                {folder.nfts?.length || 0} NFTs
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PublicFolderManager; 