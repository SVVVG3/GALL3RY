import React from 'react';
import '../styles/FarcasterUserSearch.css';

/**
 * NFT Sort Controls Component
 */
const NFTSortControls = ({ sortBy, setSortBy, sortOrder, setSortOrder }) => {
  const toggleSortOrder = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };

  return (
    <div className="nft-sort-controls">
      <div className="sort-options">
        <button
          className={`sort-option ${sortBy === 'recent' ? 'active' : ''}`}
          onClick={() => setSortBy('recent')}
        >
          Recent
        </button>
        <button
          className={`sort-option ${sortBy === 'name' ? 'active' : ''}`}
          onClick={() => setSortBy('name')}
        >
          Name
        </button>
        <button
          className={`sort-option ${sortBy === 'collection' ? 'active' : ''}`}
          onClick={() => setSortBy('collection')}
        >
          Collection
        </button>
        <button
          className={`sort-option ${sortBy === 'value' ? 'active' : ''}`}
          onClick={() => setSortBy('value')}
        >
          Value
        </button>
      </div>
      <button className="sort-order-toggle" onClick={toggleSortOrder}>
        {sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
      </button>
    </div>
  );
};

export default NFTSortControls; 