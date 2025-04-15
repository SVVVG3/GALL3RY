import React, { useState } from 'react';
import '../styles/FarcasterUserSearch.css';

/**
 * A very simple search component that doesn't rely on any complex dependencies
 * This can be rendered safely while the main app initializes
 */
const SimpleSearch = ({ onSearch }) => {
  const [searchQuery, setSearchQuery] = useState('');
  
  const handleSubmit = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearch(searchQuery.trim());
    }
  };
  
  return (
    <div className="farcaster-search-container">
      <div className="search-header">
        <h1>Search Farcaster Users</h1>
        <p className="search-instructions">Enter a Farcaster username to explore their NFT collection</p>
      </div>
      
      <form onSubmit={handleSubmit} className="search-form">
        <div className="search-input-wrapper">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Enter Farcaster username (e.g. dwr, vitalik)"
            className="search-input"
            aria-label="Farcaster username"
          />
          <button 
            type="submit"
            className="search-button"
            disabled={!searchQuery.trim()}
          >
            Search
          </button>
        </div>
      </form>
    </div>
  );
};

export default SimpleSearch; 