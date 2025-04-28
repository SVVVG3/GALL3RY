import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setSortOption, setSortDirection, setSelectedWallet } from '../redux/nftFiltersSlice';
import '../styles/FarcasterUserSearch.css';

/**
 * NFT Sort Controls Component
 * Provides UI for sorting NFTs by different criteria and filtering by wallet
 */
const NFTSortControls = ({ walletAddresses = [] }) => {
  const dispatch = useDispatch();
  
  // Get sort and filter state from Redux
  const { sortOption, sortDirection, selectedWallet } = useSelector(state => ({
    sortOption: state.nftFilters?.sortOption || 'collection',
    sortDirection: state.nftFilters?.sortDirection || 'asc',
    selectedWallet: state.nftFilters?.selectedWallet || 'all'
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
  
  // Handle wallet selection
  const handleWalletSelect = (e) => {
    dispatch(setSelectedWallet(e.target.value));
  };

  // Prepare wallet options for dropdown
  const walletOptions = [
    { value: 'all', label: 'All Wallets' },
    ...(walletAddresses || []).map(address => ({
      value: address.toLowerCase(),
      label: `${address.substring(0, 6)}...${address.substring(address.length - 4)}`
    }))
  ];

  return (
    <div className="nft-sort-controls">
      <div className="sort-options">
        {/* Wallet filter dropdown */}
        <select 
          className="wallet-filter"
          value={selectedWallet}
          onChange={handleWalletSelect}
          aria-label="Filter by wallet"
        >
          {walletOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        
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