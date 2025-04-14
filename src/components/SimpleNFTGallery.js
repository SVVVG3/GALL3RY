import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSimpleNFT } from '../contexts/SimpleNFTContext';
import SimpleNFTGrid from './SimpleNFTGrid';
import '../styles/NFTGallery.css';

const SimpleNFTGallery = () => {
  const {
    nfts,
    isLoading,
    error,
    hasMore,
    searchQuery,
    setSearchQuery,
    fetchNFTsForMultipleAddresses,
    loadMoreNFTs,
  } = useSimpleNFT();
  
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
      rootMargin: '0px',
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
          <p>{error}</p>
        </div>
      )}
      
      <div className="nft-count">
        <p>{nfts.length} NFTs found</p>
      </div>
      
      <SimpleNFTGrid nfts={nfts} />
      
      {isLoading && (
        <div className="loading-indicator">
          <p>Loading NFTs...</p>
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

export default SimpleNFTGallery; 