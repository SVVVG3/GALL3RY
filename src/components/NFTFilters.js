import React from 'react';
import { useNFT } from '../contexts/NFTContext';
import '../styles/NFTFilters.css';

const NFTFilters = ({ wallets = [] }) => {
  const {
    selectedChains,
    selectedWallets,
    searchQuery,
    sortBy,
    sortOrder,
    setSelectedChains,
    setSelectedWallets,
    setSearchQuery,
    setSortBy,
    setSortOrder,
    resetFilters
  } = useNFT();

  const handleChainChange = (chain) => {
    if (chain === 'all') {
      setSelectedChains(['all']);
    } else {
      setSelectedChains(prev => {
        const newChains = prev.filter(c => c !== 'all');
        if (newChains.includes(chain)) {
          return newChains.filter(c => c !== chain);
        }
        return [...newChains, chain];
      });
    }
  };

  const handleWalletChange = (wallet) => {
    setSelectedWallets(prev => {
      if (prev.includes(wallet)) {
        return prev.filter(w => w !== wallet);
      }
      return [...prev, wallet];
    });
  };

  const handleSortChange = (sort) => {
    // When 'value' is selected, we'll sort NFTs by their estimated value in USD
    // This works with the getSortedNFTs function in NFTContext.js
    console.log(`Setting sort to: ${sort}`); // Add logging to confirm sort is changing
    setSortBy(sort);
    
    // For value sorting, ensure we're sorting in descending order (highest first)
    if (sort === 'value') {
      setSortOrder('desc');
    }
  };

  return (
    <div className="nft-filters">
      <div className="filter-section">
        <h3>Sort By</h3>
        <div className="sort-filters">
          <button
            className={`sort-filter ${sortBy === 'collection' ? 'active' : ''}`}
            onClick={() => handleSortChange('collection')}
          >
            Collection
          </button>
          <button
            className={`sort-filter ${sortBy === 'value' ? 'active' : ''}`}
            onClick={() => handleSortChange('value')}
          >
            Value
          </button>
          <button
            className={`sort-filter ${sortBy === 'recent' ? 'active' : ''}`}
            onClick={() => handleSortChange('recent')}
          >
            Recent
          </button>
        </div>
      </div>

      <div className="filter-section">
        <h3>Chains</h3>
        <div className="chain-filters">
          <button
            className={`chain-filter ${selectedChains.includes('all') ? 'active' : ''}`}
            onClick={() => handleChainChange('all')}
          >
            All
          </button>
          <button
            className={`chain-filter ${selectedChains.includes('eth') ? 'active' : ''}`}
            onClick={() => handleChainChange('eth')}
          >
            Ethereum
          </button>
          <button
            className={`chain-filter ${selectedChains.includes('base') ? 'active' : ''}`}
            onClick={() => handleChainChange('base')}
          >
            Base
          </button>
        </div>
      </div>

      {wallets.length > 0 && (
        <div className="filter-section">
          <h3>Wallets</h3>
          <div className="wallet-filters">
            {wallets.map(wallet => (
              <button
                key={wallet}
                className={`wallet-filter ${selectedWallets.includes(wallet) ? 'active' : ''}`}
                onClick={() => handleWalletChange(wallet)}
              >
                {wallet.slice(0, 6)}...{wallet.slice(-4)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="filter-section">
        <h3>Search</h3>
        <input
          type="text"
          placeholder="Search NFTs and collections..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
      </div>

      <button className="reset-filters" onClick={resetFilters}>
        Reset Filters
      </button>
    </div>
  );
};

export default NFTFilters; 