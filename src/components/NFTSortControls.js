import React, { useEffect, useState, useRef } from 'react';
import { useNFT } from '../contexts/NFTContext';
import '../styles/FarcasterUserSearch.css';

/**
 * NFT Sort Controls Component
 * Provides UI for sorting NFTs by different criteria and filtering by chain
 */
const NFTSortControls = () => {
  const { sortBy, setSortBy, sortOrder, setSortOrder, chainFilter, setChainFilter, getUniqueChains } = useNFT();
  const [isChainDropdownOpen, setIsChainDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  
  // Get all unique chains from NFTs
  const uniqueChains = getUniqueChains();
  
  console.log('Available chains for filtering:', uniqueChains);
  
  // Map chain IDs to readable names
  const chainNames = {
    'eth': 'Ethereum',
    'ethereum': 'Ethereum',
    'polygon': 'Polygon',
    'matic': 'Polygon',
    'opt': 'Optimism',
    'optimism': 'Optimism',
    'arb': 'Arbitrum',
    'arbitrum': 'Arbitrum',
    'base': 'Base',
    'zora': 'Zora'
  };
  
  // Get readable chain name
  const getChainName = (chainId) => {
    if (!chainId) return 'Unknown';
    return chainNames[chainId.toLowerCase()] || chainId;
  };
  
  // Get current chain filter name for display
  const getCurrentChainName = () => {
    return chainFilter === 'all' ? 'All Chains' : getChainName(chainFilter);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsChainDropdownOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleSortOrder = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };
  
  // Ensure we have unique chains to display
  const displayChains = uniqueChains.length > 0 ? uniqueChains : ['eth', 'polygon', 'base', 'arb', 'opt', 'zora'];

  return (
    <div className="nft-sort-controls">
      <div className="sort-options">
        <button
          className={`sort-option ${sortBy === 'name' ? 'active' : ''}`}
          onClick={() => setSortBy('name')}
          aria-label="Sort by name"
          aria-pressed={sortBy === 'name'}
        >
          Name
        </button>
        <button
          className={`sort-option ${sortBy === 'collection' ? 'active' : ''}`}
          onClick={() => setSortBy('collection')}
          aria-label="Sort by collection"
          aria-pressed={sortBy === 'collection'}
        >
          Collection
        </button>
        
        {/* Chain filter dropdown */}
        <div className="chain-filter-container" ref={dropdownRef}>
          <button
            className={`sort-option chain-filter-button ${isChainDropdownOpen ? 'active' : ''}`}
            onClick={() => setIsChainDropdownOpen(!isChainDropdownOpen)}
            aria-label="Filter by chain"
            aria-expanded={isChainDropdownOpen}
          >
            {getCurrentChainName()}
          </button>
          
          {isChainDropdownOpen && (
            <div className="chain-dropdown">
              <button
                className={`chain-option ${chainFilter === 'all' ? 'active' : ''}`}
                onClick={() => {
                  setChainFilter('all');
                  setIsChainDropdownOpen(false);
                }}
              >
                All Chains
              </button>
              
              {displayChains.map(chain => (
                <button
                  key={chain}
                  className={`chain-option ${chainFilter === chain ? 'active' : ''}`}
                  onClick={() => {
                    setChainFilter(chain);
                    setIsChainDropdownOpen(false);
                  }}
                >
                  {getChainName(chain)}
                </button>
              ))}
            </div>
          )}
        </div>
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