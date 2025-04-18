import React from 'react';
import { useNFT } from '../contexts/NFTContext';
import '../styles/FarcasterUserSearch.css';

/**
 * NFT Search Bar Component
 * Provides UI for searching NFTs by name or collection
 */
const NFTSearchBar = () => {
  const { searchQuery, setSearchQuery } = useNFT();

  return (
    <div className="nft-search-bar">
      <input
        type="text"
        placeholder="Search NFTs by name or collection..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="nft-filter-input"
      />
      {searchQuery && (
        <button 
          className="nft-filter-clear" 
          onClick={() => setSearchQuery('')}
          aria-label="Clear search"
        >
          ×
        </button>
      )}
    </div>
  );
};

export default NFTSearchBar; 