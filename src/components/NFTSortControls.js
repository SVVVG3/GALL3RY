import React from 'react';
import { useNFT } from '../contexts/NFTContext';
import '../styles/FarcasterUserSearch.css';

/**
 * NFT Sort Controls Component
 * Provides UI for sorting NFTs by different criteria
 */
const NFTSortControls = () => {
  const { sortBy, setSortBy, sortOrder, setSortOrder } = useNFT();

  const toggleSortOrder = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };

  return (
    <div className="nft-sort-controls">
      <div className="sort-options">
        <button
          className={`sort-button ${sortBy === 'recent' ? 'active' : ''}`}
          onClick={() => setSortBy('recent')}
          aria-label="Sort by recent"
          aria-pressed={sortBy === 'recent'}
        >
          Recent
        </button>
        <button
          className={`sort-button ${sortBy === 'name' ? 'active' : ''}`}
          onClick={() => setSortBy('name')}
          aria-label="Sort by name"
          aria-pressed={sortBy === 'name'}
        >
          Name
        </button>
        <button
          className={`sort-button ${sortBy === 'collection' ? 'active' : ''}`}
          onClick={() => setSortBy('collection')}
          aria-label="Sort by collection"
          aria-pressed={sortBy === 'collection'}
        >
          Collection
        </button>
        <button
          className={`sort-button ${sortBy === 'value' ? 'active' : ''}`}
          onClick={() => setSortBy('value')}
          aria-label="Sort by value"
          aria-pressed={sortBy === 'value'}
        >
          Value
        </button>
      </div>
      <button
        className="sort-order-toggle"
        onClick={toggleSortOrder}
        aria-label={`Sort order: ${sortOrder === 'asc' ? 'ascending' : 'descending'}`}
      >
        {sortOrder === 'asc' ? '↑' : '↓'}
      </button>
    </div>
  );
};

export default NFTSortControls; 