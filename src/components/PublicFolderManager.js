import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import folderService from '../services/folderService';
import config from '../config';
import FolderGrid from './FolderGrid';
import FolderDetail from './FolderDetail';
import '../styles/folder.css';

/**
 * PublicFolderManager component for viewing other users' public folders
 * Shows only public folders for the specified Farcaster user
 */
function PublicFolderManager({ username, fid, userId, token, onFolderSelect }) {
  const [folders, setFolders] = useState([]);
  const [featuredFolders, setFeaturedFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeFolderId, setActiveFolderId] = useState(null);

  useEffect(() => {
    fetchPublicFolders();
  }, [fid]);

  // Fetch only public folders for the specified user
  const fetchPublicFolders = async () => {
    if (!fid) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const publicFolders = await folderService.getPublicFoldersByUser(fid);
      
      if (!publicFolders || publicFolders.length === 0) {
        setFolders([]);
        setError('No public folders available for this user');
      } else {
        setFolders(publicFolders);
        setError(null);
      }
    } catch (err) {
      console.error('Error fetching public folders:', err);
      setError(`Failed to load folders: ${err.message}`);
      setFolders([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch featured folders for discovery
  useEffect(() => {
    const fetchFeaturedFolders = async () => {
      if (!config.features.enablePublicFolders) return;
      
      try {
        const featured = await folderService.getFeaturedFolders();
        setFeaturedFolders(featured);
      } catch (err) {
        console.error('Failed to fetch featured folders:', err);
        // Don't set error state here as it's not critical
      }
    };

    fetchFeaturedFolders();
  }, []);

  const handleSelectFolder = (folderId) => {
    setActiveFolderId(folderId === activeFolderId ? null : folderId);
  };

  // Toggle folder visibility (public/private)
  const handleToggleVisibility = async (folderId, isCurrentlyPublic) => {
    if (!token) {
      setError('Authentication required to change folder visibility');
      return;
    }

    try {
      await folderService.toggleFolderVisibility(folderId, !isCurrentlyPublic, token);
      
      // Update local state to reflect the change
      setFolders(folders.map(folder => 
        folder._id === folderId 
          ? { ...folder, isPublic: !isCurrentlyPublic } 
          : folder
      ));
    } catch (err) {
      console.error('Failed to toggle folder visibility:', err);
      setError('Unable to update folder visibility. Please try again.');
    }
  };

  // If a specific folder is selected, show its details
  if (activeFolderId) {
    const folder = folders.find(f => f._id === activeFolderId);
    return (
      <div>
        <button 
          onClick={() => setActiveFolderId(null)}
          className="back-button"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          Back to folders
        </button>
        <FolderDetail 
          folderId={activeFolderId} 
          folder={folder}
          isReadOnly={true}  // Public folders are read-only for non-owners
        />
      </div>
    );
  }

  return (
    <div className="public-folder-manager">
      <h2>Public Folders {username ? `by ${username}` : fid ? `by FID: ${fid}` : ''}</h2>
      
      <FolderGrid
        folders={folders}
        loading={loading}
        error={error}
        emptyMessage={`No public folders available ${username ? `for ${username}` : ''}`}
        onFolderClick={handleSelectFolder}
        onToggleVisibility={userId ? handleToggleVisibility : undefined}
        showVisibilityControls={!!userId && !!token} // Only show controls if authenticated
      />
      
      {featuredFolders.length > 0 && (
        <div className="featured-section">
          <h2>Featured Collections</h2>
          <FolderGrid
            folders={featuredFolders}
            onFolderClick={onFolderSelect || handleSelectFolder}
            featured={true}
          />
        </div>
      )}
    </div>
  );
}

PublicFolderManager.propTypes = {
  username: PropTypes.string,
  fid: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  userId: PropTypes.string,
  token: PropTypes.string,
  onFolderSelect: PropTypes.func
};

export default PublicFolderManager; 