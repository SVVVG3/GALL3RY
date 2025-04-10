import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import PublicFolderManager from '../components/PublicFolderManager';
import FolderDetail from '../components/FolderDetail';
import '../styles/folder.css';

const DiscoveryPage = () => {
  const { isAuthenticated, profile, token } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFid, setSearchFid] = useState(null);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  
  const handleSearch = (e) => {
    e.preventDefault();
    
    // For simplicity, we'll assume the search query is a Farcaster FID
    // In a real app, you would have a proper username search
    if (searchQuery.trim()) {
      setSearchFid(searchQuery.trim());
    }
  };
  
  const handleFolderSelect = (folderId) => {
    setSelectedFolderId(folderId);
  };
  
  return (
    <div className="discovery-container">
      <div className="discovery-header">
        <h1>Discover NFT Collections</h1>
        
        <form onSubmit={handleSearch} className="search-form">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by Farcaster ID..."
            className="search-input"
          />
          <button type="submit" className="search-button">Search</button>
        </form>
      </div>
      
      {selectedFolderId ? (
        <div className="selected-folder-view">
          <button 
            className="back-button" 
            onClick={() => setSelectedFolderId(null)}
          >
            &larr; Back to Discovery
          </button>
          
          <FolderDetail 
            folderId={selectedFolderId} 
            isReadOnly={true}
          />
        </div>
      ) : (
        <PublicFolderManager 
          fid={searchFid} 
          userId={isAuthenticated ? profile?.fid : null}
          token={token}
          onFolderSelect={handleFolderSelect}
        />
      )}
    </div>
  );
};

export default DiscoveryPage; 