import React, { useState, useEffect } from 'react';
import FolderList from './FolderList';
import FolderDetail from './FolderDetail';
import { useAuth } from '../contexts/AuthContext';

/**
 * Folder Manager component
 * Serves as the parent container for folder management
 */
const FolderManager = () => {
  const { isAuthenticated, profile } = useAuth();
  const [activeFolderId, setActiveFolderId] = useState(null);
  const [useLocalStorage, setUseLocalStorage] = useState(false);
  
  // Reset active folder if user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      setActiveFolderId(null);
    }
  }, [isAuthenticated]);
  
  // Handle folder selection
  const handleSelectFolder = (folderId) => {
    setActiveFolderId(folderId);
  };
  
  // Handle navigation back to folder list
  const handleBackToList = () => {
    setActiveFolderId(null);
  };
  
  // Handle local storage mode toggle from children
  const handleLocalStorageMode = (mode) => {
    setUseLocalStorage(mode);
  };
  
  return (
    <div className="folder-manager">
      {activeFolderId ? (
        <FolderDetail 
          folderId={activeFolderId} 
          onBack={handleBackToList}
          useLocalStorage={useLocalStorage}
          onLocalStorageMode={handleLocalStorageMode}
        />
      ) : (
        <FolderList 
          onSelectFolder={handleSelectFolder} 
          selectedFolderId={activeFolderId}
          useLocalStorage={useLocalStorage}
          onLocalStorageMode={handleLocalStorageMode}
        />
      )}
    </div>
  );
};

export default FolderManager; 