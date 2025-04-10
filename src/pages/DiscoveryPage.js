import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import PublicFolderManager from '../components/PublicFolderManager';
import FolderDetail from '../components/FolderDetail';
import FarcasterUserSearch from '../components/FarcasterUserSearch';
import '../styles/folder.css';

const DiscoveryPage = () => {
  const { isAuthenticated, profile, token } = useAuth();
  const [activeTab, setActiveTab] = useState('collections'); // 'collections' or 'users'
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  
  const handleFolderSelect = (folderId) => {
    setSelectedFolderId(folderId);
  };
  
  // Render the content based on the active tab
  const renderContent = () => {
    if (selectedFolderId) {
      return (
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
      );
    }
    
    if (activeTab === 'users') {
      return <FarcasterUserSearch />;
    }
    
    return (
      <PublicFolderManager 
        userId={isAuthenticated ? profile?.fid : null}
        token={token}
        onFolderSelect={handleFolderSelect}
      />
    );
  };
  
  return (
    <div className="discovery-container">
      <div className="discovery-header">
        <h1>Discover NFT Collections</h1>
        
        <div className="discovery-tabs">
          <button 
            className={`tab-button ${activeTab === 'collections' ? 'active' : ''}`}
            onClick={() => setActiveTab('collections')}
          >
            Public Collections
          </button>
          <button 
            className={`tab-button ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            Search Farcaster Users
          </button>
        </div>
      </div>
      
      {renderContent()}
    </div>
  );
};

export default DiscoveryPage; 