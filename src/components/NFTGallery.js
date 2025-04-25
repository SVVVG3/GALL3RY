import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNFT } from '../contexts/NFTContext';
import NFTGrid from './NFTGrid';
import '../styles/nft-components.css';

/**
 * NFT Gallery Component
 * 
 * Displays a collection of NFTs from multiple Ethereum wallet addresses.
 * Features:
 * - Add/remove wallet addresses
 * - Search NFTs by name or collection
 * - Infinite scrolling for loading more NFTs
 * - Error handling for API issues
 * 
 * Uses NFTGrid component to render the actual grid of NFTs.
 */
const NFTGallery = () => {
  const {
    nfts,
    isLoading,
    error,
    hasMore,
    searchQuery,
    setSearchQuery,
    fetchNFTsForMultipleAddresses,
    loadMoreNFTs,
  } = useNFT();
  
  const [walletInput, setWalletInput] = useState('');
  const [walletAddresses, setWalletAddresses] = useState([]);
  const loaderRef = useRef(null);
  
  // Handle wallet input change
  const handleWalletInputChange = (e) => {
    setWalletInput(e.target.value);
  };
  
  // Handle search input change
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
  };
  
  // Add a wallet address
  const addWalletAddress = () => {
    if (!walletInput || walletInput.trim() === '') return;
    
    // Simple validation for Ethereum addresses
    const isValidAddress = /^0x[a-fA-F0-9]{40}$/.test(walletInput);
    if (!isValidAddress) {
      alert('Please enter a valid Ethereum address');
      return;
    }
    
    // Add the address if it's not already in the list
    const normalizedAddress = walletInput.toLowerCase();
    if (!walletAddresses.includes(normalizedAddress)) {
      const newAddresses = [...walletAddresses, normalizedAddress];
      setWalletAddresses(newAddresses);
      fetchNFTsForMultipleAddresses(newAddresses);
    }
    
    setWalletInput('');
  };
  
  // Remove a wallet address
  const removeWalletAddress = (addressToRemove) => {
    const newAddresses = walletAddresses.filter(addr => addr !== addressToRemove);
    setWalletAddresses(newAddresses);
    
    if (newAddresses.length > 0) {
      fetchNFTsForMultipleAddresses(newAddresses);
    } else {
      // Clear NFTs if no wallets are selected
      fetchNFTsForMultipleAddresses([]);
    }
  };
  
  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    addWalletAddress();
  };
  
  // Intersection Observer for infinite scrolling
  const observerCallback = useCallback((entries) => {
    const [entry] = entries;
    if (entry.isIntersecting && hasMore && !isLoading) {
      loadMoreNFTs();
    }
  }, [hasMore, isLoading, loadMoreNFTs]);
  
  // Set up the Intersection Observer
  useEffect(() => {
    const observer = new IntersectionObserver(observerCallback, {
      root: null,
      rootMargin: '100px', // Load more NFTs when we're 100px from the bottom
      threshold: 0.1,
    });
    
    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }
    
    return () => {
      if (loaderRef.current) {
        observer.unobserve(loaderRef.current);
      }
    };
  }, [observerCallback]);
  
  return (
    <div className="nft-gallery-container">
      <div className="gallery-header">
        <h1>NFT Gallery</h1>
        <p>Enter Ethereum wallet addresses to view NFTs</p>
      </div>
      
      <div className="wallet-input-section">
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={walletInput}
            onChange={handleWalletInputChange}
            placeholder="Enter Ethereum wallet address (0x...)"
            className="wallet-input"
          />
          <button type="submit" className="add-wallet-button">Add Wallet</button>
        </form>
      </div>
      
      {walletAddresses.length > 0 && (
        <div className="wallets-list">
          <h3>Wallets</h3>
          <ul>
            {walletAddresses.map(address => (
              <li key={address} className="wallet-tag">
                <span>{`${address.substring(0, 6)}...${address.substring(address.length - 4)}`}</span>
                <button onClick={() => removeWalletAddress(address)} className="remove-wallet-button">×</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      <div className="search-section">
        <input
          type="text"
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder="Search NFTs by name or collection..."
          className="search-input"
        />
      </div>
      
      {error && (
        <div className="error-message">
          <p><strong>Error:</strong> {error}</p>
          {error.includes('Demo API key') && (
            <div className="error-help">
              <p>You need to set a real Alchemy API key in your <code>.env</code> file.</p>
              <ol>
                <li>Get a free API key from <a href="https://www.alchemy.com/" target="_blank" rel="noopener noreferrer">Alchemy</a></li>
                <li>Add it to the <code>.env</code> file as <code>ALCHEMY_API_KEY=your_key_here</code></li>
                <li>Restart the server</li>
              </ol>
            </div>
          )}
        </div>
      )}
      
      <div className="nft-count">
        <p>{nfts.length} NFTs found</p>
        {nfts.length > 100 && (
          <div className="performance-notice">
            <p>Using virtualized scrolling for better performance with large collections</p>
          </div>
        )}
      </div>
      
      <div className="nft-grid-wrapper">
        <NFTGrid nfts={nfts} isLoading={isLoading && nfts.length === 0} />
      </div>
      
      {isLoading && nfts.length > 0 && (
        <div className="loading-indicator">
          <div className="loading-spinner"></div>
          <p>Loading more NFTs... This may take a moment</p>
          <p className="loading-tip">Using a real Alchemy API key will improve performance</p>
        </div>
      )}
      
      {hasMore && (
        <div ref={loaderRef} className="load-more">
          <p>Scroll for more NFTs</p>
        </div>
      )}
    </div>
  );
};

export default NFTGallery; 