import React from 'react';
import PropTypes from 'prop-types';
import FolderCard from './FolderCard';

/**
 * Component for displaying a grid of folders
 */
const FolderGrid = ({
  folders,
  loading = false,
  error = null,
  emptyMessage = 'No folders available',
  onFolderClick,
  onToggleVisibility,
  showVisibilityControls = false,
  featured = false,
  className = '',
}) => {
  if (loading) {
    return (
      <div className="folder-grid-loading" data-testid="folder-grid-loading">
        <div className="loading-spinner"></div>
        <p>Loading folders...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="folder-grid-error" data-testid="folder-grid-error">
        <p>{error}</p>
      </div>
    );
  }

  if (!folders || folders.length === 0) {
    return (
      <div className="folder-grid-empty" data-testid="folder-grid-empty">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`folder-grid ${className}`} data-testid="folder-grid">
      {folders.map(folder => (
        <FolderCard
          key={folder._id}
          folder={folder}
          onClick={() => onFolderClick && onFolderClick(folder._id)}
          onToggleVisibility={onToggleVisibility}
          showVisibilityControls={showVisibilityControls}
          featured={featured}
        />
      ))}
    </div>
  );
};

FolderGrid.propTypes = {
  folders: PropTypes.array.isRequired,
  loading: PropTypes.bool,
  error: PropTypes.string,
  emptyMessage: PropTypes.string,
  onFolderClick: PropTypes.func,
  onToggleVisibility: PropTypes.func,
  showVisibilityControls: PropTypes.bool,
  featured: PropTypes.bool,
  className: PropTypes.string,
};

export default FolderGrid; 