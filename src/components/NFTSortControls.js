import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setSortOption, setSortDirection } from '../redux/nftFiltersSlice';
import '../styles/FarcasterUserSearch.css';

/**
 * NFT Sort Controls Component
 * Provides UI for sorting NFTs by different criteria
 */
const NFTSortControls = () => {
  const dispatch = useDispatch();
  
  // Get sort state from Redux
  const { sortOption, sortDirection } = useSelector(state => ({
    sortOption: state.nftFilters?.sortOption || 'recent',
    sortDirection: state.nftFilters?.sortDirection || 'desc'
  }));
  
  // Use sortBy and sortOrder as aliases for easier readability
  const sortBy = sortOption;
  const sortOrder = sortDirection;

  // Update sort option in Redux
  const handleSetSortBy = (option) => {
    dispatch(setSortOption(option));
  };
  
  // Toggle sort direction in Redux
  const toggleSortOrder = () => {
    const newDirection = sortOrder === 'asc' ? 'desc' : 'asc';
    dispatch(setSortDirection(newDirection));
  };

  return (
    <div className="nft-sort-controls">
      <div className="sort-options">
        <button
          className={`sort-option ${sortBy === 'recent' ? 'active' : ''}`}
          onClick={() => handleSetSortBy('recent')}
          aria-label="Sort by recent acquisition"
          aria-pressed={sortBy === 'recent'}
        >
          Recent
        </button>
        <button
          className={`sort-option ${sortBy === 'name' ? 'active' : ''}`}
          onClick={() => handleSetSortBy('name')}
          aria-label="Sort by name"
          aria-pressed={sortBy === 'name'}
        >
          Name
        </button>
        <button
          className={`sort-option ${sortBy === 'collection' ? 'active' : ''}`}
          onClick={() => handleSetSortBy('collection')}
          aria-label="Sort by collection"
          aria-pressed={sortBy === 'collection'}
        >
          Collection
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