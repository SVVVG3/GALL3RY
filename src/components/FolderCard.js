import React from 'react';
import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import config from '../config';

/**
 * A reusable card component for displaying folder information
 */
const FolderCard = ({ 
  folder, 
  onClick, 
  onToggleVisibility,
  showVisibilityControls = false,
  featured = false,
  className = '',
}) => {
  const {
    _id,
    name,
    description,
    nftCount,
    viewCount = 0,
    isPublic,
    customCover,
    owner,
  } = folder;
  
  const handleToggleVisibility = (e) => {
    e.stopPropagation();
    if (onToggleVisibility) {
      onToggleVisibility(_id, isPublic);
    }
  };
  
  // Determine the cover image to display (either custom or first NFT)
  const coverImage = customCover?.imageUrl || 
    (folder.nfts && folder.nfts.length > 0 ? folder.nfts[0].imageUrl : null);
  
  return (
    <div 
      className={`folder-card ${featured ? 'featured' : ''} ${className}`}
      onClick={onClick}
      data-testid="folder-card"
    >
      <div className="folder-card-cover">
        {coverImage ? (
          <img 
            src={coverImage} 
            alt={name} 
            className="folder-cover-image"
            onError={(e) => {
              e.target.src = '/assets/placeholder-nft.jpg';
            }}
          />
        ) : (
          <div className="folder-cover-placeholder">
            <span className="folder-cover-icon">📁</span>
          </div>
        )}
        
        {isPublic && (
          <div className="folder-visibility-badge">
            <span>Public</span>
          </div>
        )}
      </div>
      
      <div className="folder-card-content">
        <h3 className="folder-title">{name}</h3>
        
        {description && (
          <p className="folder-description">{description}</p>
        )}
        
        <div className="folder-stats">
          <span className="nft-count">{nftCount || 0} NFTs</span>
          {isPublic && <span className="view-count">{viewCount} views</span>}
        </div>
        
        {featured && owner && (
          <div className="folder-owner">
            <span>By: {owner.username || `FID: ${owner.farcasterFid}`}</span>
          </div>
        )}
        
        {showVisibilityControls && config.features.enablePublicFolders && (
          <button 
            onClick={handleToggleVisibility}
            className="visibility-toggle-btn"
            data-testid="toggle-visibility-btn"
          >
            {isPublic ? 'Make Private' : 'Make Public'}
          </button>
        )}
      </div>
    </div>
  );
};

FolderCard.propTypes = {
  folder: PropTypes.shape({
    _id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    description: PropTypes.string,
    nftCount: PropTypes.number,
    viewCount: PropTypes.number,
    isPublic: PropTypes.bool,
    customCover: PropTypes.shape({
      imageUrl: PropTypes.string,
      showTitle: PropTypes.bool
    }),
    nfts: PropTypes.array,
    owner: PropTypes.shape({
      username: PropTypes.string,
      farcasterFid: PropTypes.number
    })
  }).isRequired,
  onClick: PropTypes.func,
  onToggleVisibility: PropTypes.func,
  showVisibilityControls: PropTypes.bool,
  featured: PropTypes.bool,
  className: PropTypes.string
};

export default FolderCard; 