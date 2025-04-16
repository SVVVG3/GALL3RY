import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useAuth } from '../contexts/AuthContext';
import folderService from '../services/folderService';
import NFTGrid from './NFTGrid';
import config from '../config';
import '../styles/folder.css';

/**
 * Component for displaying the details of a folder, including its NFTs
 */
const FolderDetail = ({ 
  folderId, 
  folder: folderProp, 
  isReadOnly = false,
  onNftRemove,
  onFolderUpdate
}) => {
  const { isAuthenticated, profile } = useAuth();
  const [folder, setFolder] = useState(folderProp || null);
  const [loading, setLoading] = useState(!folderProp);
  const [error, setError] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isPublic: false
  });
  const [isLocalStorage, setIsLocalStorage] = useState(false);
  const [sortOption, setSortOption] = useState('default');
  const [sortedNfts, setSortedNfts] = useState([]);
  
  useEffect(() => {
    if (folderProp) {
      setFolder(folderProp);
      setFormData({
        name: folderProp.name || '',
        description: folderProp.description || '',
        isPublic: folderProp.isPublic || false
      });
      return;
    }

    if (folderId) {
      fetchFolderDetails();
    }
  }, [folderId, folderProp]);

  useEffect(() => {
    if (folder && folder.nfts && folder.nfts.length > 0) {
      setSortedNfts(sortNfts(folder.nfts, sortOption));
    } else {
      setSortedNfts([]);
    }
  }, [folder, sortOption]);
  
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
          return priceB - priceA;
        });
      
      case 'price-low':
        return nftsCopy.sort((a, b) => {
          const priceA = a.estimatedValueUsd || (a.estimatedValueEth ? a.estimatedValueEth : 0);
          const priceB = b.estimatedValueUsd || (b.estimatedValueEth ? b.estimatedValueEth : 0);
          return priceA - priceB;
        });
      
      case 'default':
      default:
        return nftsCopy;
    }
  };
  
  const handleSortChange = (e) => {
    setSortOption(e.target.value);
  };

  const fetchFolderDetails = async () => {
    setLoading(true);
    
    try {
      const folderData = await folderService.getFolder(folderId);
      setFolder(folderData);
      setFormData({
        name: folderData.name || '',
        description: folderData.description || '',
        isPublic: folderData.isPublic || false
      });
      setError(null);
    } catch (err) {
      console.error('Error fetching folder details:', err);
      setError('Failed to load folder details');
      setFolder(null);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleUpdateFolder = async (e) => {
    e.preventDefault();
    
    try {
      const updatedFolder = await folderService.updateFolder(folderId, formData);
      setFolder(updatedFolder);
      setEditMode(false);
      
      if (onFolderUpdate) {
        onFolderUpdate(updatedFolder);
      }
    } catch (err) {
      console.error('Error updating folder:', err);
      setError('Failed to update folder details');
    }
  };

  const handleRemoveNft = async (nftId) => {
    if (isReadOnly) return;
    
    try {
      await folderService.removeNftFromFolder(folderId, nftId);
      
      // Update local state
      setFolder({
        ...folder,
        nfts: folder.nfts.filter(nft => nft._id !== nftId)
      });
      
      if (onNftRemove) {
        onNftRemove(nftId);
      }
    } catch (err) {
      console.error('Error removing NFT from folder:', err);
      setError('Failed to remove NFT from folder');
    }
  };

  if (loading) {
    return (
      <div className="folder-detail-loading">
        <div className="loading-spinner"></div>
        <p>Loading folder details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="folder-detail-error">
        <p>{error}</p>
      </div>
    );
  }

  if (!folder) {
    return (
      <div className="folder-detail-error">
        <p>Folder not found</p>
      </div>
    );
  }

  return (
    <div className="folder-detail">
      {editMode && !isReadOnly ? (
        <form onSubmit={handleUpdateFolder} className="folder-edit-form">
          <div className="form-group">
            <label htmlFor="name">Folder Name</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description || ''}
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
                checked={formData.isPublic}
                onChange={handleInputChange}
              />
              <label htmlFor="isPublic">Make this folder public</label>
            </div>
          )}
          
          <div className="form-actions">
            <button type="submit" className="save-button">Save Changes</button>
            <button 
              type="button" 
              className="cancel-button"
              onClick={() => setEditMode(false)}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="folder-header">
          <div className="folder-header-content">
            <h1 className="folder-name">{folder.name}</h1>
            {folder.description && (
              <p className="folder-description">{folder.description}</p>
            )}
            <div className="folder-meta">
              <span className="nft-count">{folder.nfts?.length || 0} NFTs</span>
              {folder.isPublic && <span className="public-badge">Public</span>}
              {folder.viewCount > 0 && <span className="view-count">{folder.viewCount} views</span>}
            </div>
          </div>
          
          {!isReadOnly && (
            <div className="folder-actions">
              <button 
                onClick={() => setEditMode(true)} 
                className="edit-button"
              >
                Edit Folder
              </button>
            </div>
          )}
        </div>
      )}
      
      <div className="folder-nfts">
        {folder.nfts && folder.nfts.length > 0 ? (
          <>
            <div className="folder-controls">
              <div className="sort-controls">
                <label htmlFor="sort">Sort by:</label>
                <select id="sort" value={sortOption} onChange={handleSortChange}>
                  <option value="default">Default</option>
                  <option value="name-asc">Name (A-Z)</option>
                  <option value="name-desc">Name (Z-A)</option>
                  <option value="collection">Collection</option>
                  <option value="price-high">Price (High to Low)</option>
                  <option value="price-low">Price (Low to High)</option>
                </select>
              </div>
            </div>
            <NFTGrid nfts={sortedNfts} />
          </>
        ) : (
          <div className="empty-folder">
            <p>This folder is empty</p>
          </div>
        )}
      </div>
    </div>
  );
};

FolderDetail.propTypes = {
  folderId: PropTypes.string,
  folder: PropTypes.object,
  isReadOnly: PropTypes.bool,
  onNftRemove: PropTypes.func,
  onFolderUpdate: PropTypes.func
};

export default FolderDetail; 