import React, { useState, useCallback } from 'react';
import { useNFT } from '../contexts/NFTContext';
import NFTCard from './NftCard';
import { FixedSizeGrid } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import '../styles/nft-unified.css';

/**
 * Simplified NFT Gallery Component with Virtualized Scrolling
 * 
 * Displays NFTs in a clean grid layout with:
 * - Wallet input for fetching NFTs
 * - Simple search functionality
 * - Loading and error states
 * - Virtualized grid layout for performance
 */
const NFTGallery = () => {
  const { nfts, isLoading, error, searchQuery, setSearchQuery, fetchNFTs } = useNFT();
  const [walletInput, setWalletInput] = useState('');
  const [walletAddresses, setWalletAddresses] = useState([]);
  
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
      fetchNFTs(newAddresses);
    }
    
    setWalletInput('');
  };
  
  // Remove a wallet address
  const removeWalletAddress = (addressToRemove) => {
    const newAddresses = walletAddresses.filter(addr => addr !== addressToRemove);
    setWalletAddresses(newAddresses);
    
    if (newAddresses.length > 0) {
      fetchNFTs(newAddresses);
    } else {
      // Clear NFTs if no wallets are selected
      fetchNFTs([]);
    }
  };
  
  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    addWalletAddress();
  };

  // Grid cell renderer
  const Cell = useCallback(({ columnIndex, rowIndex, style, data }) => {
    const index = rowIndex * data.columnCount + columnIndex;
    
    if (index >= data.nfts.length) {
      return null;
    }
    
    const nft = data.nfts[index];
    
    return (
      <div style={{
        ...style,
        padding: '10px',
      }}>
        <NFTCard key={`nft-${index}-${nft.tokenId || nft.token_id || index}`} nft={nft} />
      </div>
    );
  }, []);
  
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
      
      {walletAddresses.length > 0 && (
        <div className="search-section">
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search NFTs by name or collection..."
            className="search-input"
          />
        </div>
      )}
      
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
      
      {isLoading ? (
        <div className="nft-section-loading" style={{ 
          minHeight: '300px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '30px',
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          margin: '10px 0',
          width: '100%',
          border: '1px solid #eaeaea'
        }}>
          <div className="loading-spinner"></div>
          <p style={{ marginTop: '15px', color: '#666' }}>Loading NFTs...</p>
        </div>
      ) : nfts.length > 0 ? (
        <>
          <div className="nft-count">
            <p>{nfts.length} NFTs found</p>
          </div>
          
          <div className="virtualized-grid-container">
            <AutoSizer>
              {({ height, width }) => {
                // Calculate number of columns based on width
                // Minimum card width is 250px with 20px gap
                const columnWidth = 270;
                const columnCount = Math.max(1, Math.floor(width / columnWidth));
                const rowCount = Math.ceil(nfts.length / columnCount);
                
                return (
                  <FixedSizeGrid
                    className="virtualized-grid"
                    columnCount={columnCount}
                    columnWidth={width / columnCount}
                    height={Math.min(800, rowCount * 420)} // Increased max height to match row height
                    rowCount={rowCount}
                    rowHeight={420} // Increased from 320px to 420px to prevent card overlap
                    width={width}
                    itemData={{ nfts, columnCount }}
                  >
                    {Cell}
                  </FixedSizeGrid>
                );
              }}
            </AutoSizer>
          </div>
        </>
      ) : walletAddresses.length > 0 ? (
        <div className="nft-empty">
          <p>No NFTs found for the selected wallets</p>
          {searchQuery && <p>Try adjusting your search or adding more wallets</p>}
        </div>
      ) : (
        <div className="nft-empty">
          <p>Add a wallet address to view NFTs</p>
        </div>
      )}
    </div>
  );
};

export default NFTGallery; 