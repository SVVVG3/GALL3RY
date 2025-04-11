import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import folderService from '../services/folderService';
import FolderGrid from '../components/FolderGrid';
import FolderDetail from '../components/FolderDetail';
import SignInButton from '../components/SignInButton';
import config from '../config';
import '../styles/folder.css';

const UserDashboard = () => {
  const navigate = useNavigate();
  const { isAuthenticated, profile, token } = useAuth();
  const [userFolders, setUserFolders] = useState([]);
  const [publicFolders, setPublicFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newFolderData, setNewFolderData] = useState({
    name: '',
    description: '',
    isPublic: false
  });

  // Check authentication and redirect if needed
  useEffect(() => {
    if (!isAuthenticated) {
      // Redirect to home page if not authenticated
      navigate('/');
    }
  }, [isAuthenticated, navigate]);

  // Fetch the user's folders
  useEffect(() => {
    if (!isAuthenticated || !profile) {
      setLoading(false);
      return;
    }
    
    fetchUserFolders();
  }, [isAuthenticated, profile]);

  const fetchUserFolders = async () => {
    try {
      setLoading(true);
      
      const folders = await folderService.getUserFolders(token);
      
      // Split into private and public folders
      const publicFolders = folders.filter(folder => folder.isPublic);
      const privateFolders = folders.filter(folder => !folder.isPublic);
      
      setUserFolders(privateFolders);
      setPublicFolders(publicFolders);
      setError(null);
    } catch (err) {
      console.error('Error fetching user folders:', err);
      setError('Failed to load your folders. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Handle selecting a folder to view details
  const handleSelectFolder = (folderId) => {
    setSelectedFolderId(folderId);
    setShowCreateForm(false);
  };

  // Handle creating a new folder
  const handleCreateFolder = async (e) => {
    e.preventDefault();
    
    if (!newFolderData.name.trim()) {
      setError('Folder name is required');
      return;
    }
    
    try {
      setLoading(true);
      
      const newFolder = await folderService.createFolder(
        newFolderData.name,
        newFolderData.description,
        newFolderData.isPublic,
        token
      );
      
      // Add the new folder to the appropriate list
      if (newFolder.isPublic) {
        setPublicFolders([newFolder, ...publicFolders]);
      } else {
        setUserFolders([newFolder, ...userFolders]);
      }
      
      // Reset form
      setNewFolderData({
        name: '',
        description: '',
        isPublic: false
      });
      
      setShowCreateForm(false);
      setError(null);
      
      // Select the new folder
      setSelectedFolderId(newFolder._id);
    } catch (err) {
      console.error('Error creating folder:', err);
      setError('Failed to create folder. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle toggling folder visibility
  const handleToggleVisibility = async (folderId, isCurrentlyPublic) => {
    try {
      await folderService.toggleFolderVisibility(folderId, !isCurrentlyPublic, token);
      
      // Find the folder in either list
      const folder = [...userFolders, ...publicFolders].find(f => f._id === folderId);
      
      if (!folder) return;
      
      const updatedFolder = { ...folder, isPublic: !isCurrentlyPublic };
      
      // Update the appropriate lists
      if (!isCurrentlyPublic) {
        // Moving from private to public
        setUserFolders(userFolders.filter(f => f._id !== folderId));
        setPublicFolders([updatedFolder, ...publicFolders]);
      } else {
        // Moving from public to private
        setPublicFolders(publicFolders.filter(f => f._id !== folderId));
        setUserFolders([updatedFolder, ...userFolders]);
      }
    } catch (err) {
      console.error('Error toggling folder visibility:', err);
      setError('Failed to update folder visibility. Please try again.');
    }
  };

  // Handle deleting a folder
  const handleDeleteFolder = async (folderId) => {
    if (!window.confirm('Are you sure you want to delete this folder?')) {
      return;
    }
    
    try {
      await folderService.deleteFolder(folderId, token);
      
      // Remove from the appropriate list
      setUserFolders(userFolders.filter(f => f._id !== folderId));
      setPublicFolders(publicFolders.filter(f => f._id !== folderId));
      
      if (selectedFolderId === folderId) {
        setSelectedFolderId(null);
      }
    } catch (err) {
      console.error('Error deleting folder:', err);
      setError('Failed to delete folder. Please try again.');
    }
  };

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setNewFolderData({
      ...newFolderData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  // When a folder's details are updated
  const handleFolderUpdate = (updatedFolder) => {
    const isPublic = updatedFolder.isPublic;
    
    // Update the appropriate lists
    if (isPublic) {
      setPublicFolders(publicFolders.map(f => 
        f._id === updatedFolder._id ? updatedFolder : f
      ));
      setUserFolders(userFolders.filter(f => f._id !== updatedFolder._id));
    } else {
      setUserFolders(userFolders.map(f => 
        f._id === updatedFolder._id ? updatedFolder : f
      ));
      setPublicFolders(publicFolders.filter(f => f._id !== updatedFolder._id));
    }
  };

  // If user is not authenticated, show login prompt
  if (!isAuthenticated) {
    return (
      <div className="dashboard-container">
        <div className="auth-needed">
          <h2>Sign In Required</h2>
          <p>Please sign in to view and manage your folders</p>
          <SignInButton />
        </div>
      </div>
    );
  }

  // If a specific folder is selected, show its details
  if (selectedFolderId) {
    // Find the folder in either list
    const folder = [...userFolders, ...publicFolders].find(f => f._id === selectedFolderId);
    
    return (
      <div className="dashboard-container">
        <button 
          className="back-button" 
          onClick={() => setSelectedFolderId(null)}
        >
          &larr; Back to Folders
        </button>
        
        <FolderDetail 
          folderId={selectedFolderId}
          folder={folder}
          onFolderUpdate={handleFolderUpdate}
        />
        
        <div className="delete-option">
          <button 
            className="delete-button" 
            onClick={() => handleDeleteFolder(selectedFolderId)}
          >
            Delete Folder
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>Your NFT Collections</h1>
        
        <button 
          className="create-folder-button"
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          {showCreateForm ? 'Cancel' : '+ Create New Collection'}
        </button>
      </div>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      {/* Create New Folder Form */}
      {showCreateForm && (
        <div className="create-folder-form">
          <h2>Create New Collection</h2>
          <form onSubmit={handleCreateFolder}>
            <div className="form-group">
              <label htmlFor="name">Collection Name</label>
              <input
                type="text"
                id="name"
                name="name"
                value={newFolderData.name}
                onChange={handleInputChange}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                name="description"
                value={newFolderData.description}
                onChange={handleInputChange}
                rows="3"
              />
            </div>
            
            {config.features.enablePublicFolders && (
              <div className="form-group checkbox">
                <input
                  type="checkbox"
                  id="isPublic"
                  name="isPublic"
                  checked={newFolderData.isPublic}
                  onChange={handleInputChange}
                />
                <label htmlFor="isPublic">Make this collection public</label>
              </div>
            )}
            
            <div className="form-actions">
              <button type="submit" className="save-button">
                Create Collection
              </button>
            </div>
          </form>
        </div>
      )}
      
      {/* Private Folders Section */}
      <section className="folders-section">
        <h2>Private Collections</h2>
        <FolderGrid
          folders={userFolders}
          loading={loading && userFolders.length === 0}
          error={null}
          emptyMessage="You don't have any private collections yet."
          onFolderClick={handleSelectFolder}
          onToggleVisibility={handleToggleVisibility}
          showVisibilityControls={true}
        />
      </section>
      
      {/* Public Folders Section */}
      {config.features.enablePublicFolders && (
        <section className="folders-section">
          <h2>Your Public Collections</h2>
          <FolderGrid
            folders={publicFolders}
            loading={loading && publicFolders.length === 0}
            error={null}
            emptyMessage="You don't have any public collections yet."
            onFolderClick={handleSelectFolder}
            onToggleVisibility={handleToggleVisibility}
            showVisibilityControls={true}
          />
        </section>
      )}
    </div>
  );
};

export default UserDashboard; 