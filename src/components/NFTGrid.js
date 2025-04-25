import React, { useCallback, useState, useEffect } from 'react';
import { FixedSizeGrid } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import '../styles/nft-components.css';
import NFTCard from './NftCard.js'; // Explicit extension to ensure correct file is loaded
import VercelNFTCard from './VercelNFTCard.js'; // Import Vercel-optimized component
import { createConsistentUniqueId } from '../services/alchemyService';

/**
 * NFT Grid component with virtualized scrolling
 * Primary component for displaying NFTs in a grid layout
 * 
 * Features:
 * - Uses react-window for efficient virtualized rendering
 * - Only renders NFTs that are visible in the viewport
 * - Handles loading states and empty states
 * - Supports various NFT data formats from different sources
 * - Automatically extracts collection names and other metadata
 * 
 * @param {Object[]} nfts - Array of NFT objects to display
 * @param {boolean} isLoading - Whether NFTs are currently being loaded
 * @param {string} emptyMessage - Optional custom message to show when no NFTs are found
 * @returns {JSX.Element} The rendered NFT grid component
 */
const NFTGrid = ({ nfts = [], isLoading = false, emptyMessage = "No NFTs found" }) => {
  console.log(`NFTGrid rendering ${nfts.length} NFTs, isLoading: ${isLoading}`);
  
  // Calculate responsive column count based on container width
  const getColumnCount = (width) => {
    if (width <= 480) return 1; // Mobile - single column
    if (width <= 768) return 2; // Tablet - 2 columns
    if (width <= 1024) return 3; // Small desktop - 3 columns
    if (width <= 1440) return 4; // Medium desktop - 4 columns
    return 5; // Large desktop - 5 columns
  };
  
  // Deduplicate NFTs by uniqueId or contract+tokenId+network for safety
  const uniqueNfts = removeDuplicateNfts(nfts);
  
  // Additional verification to ensure visual uniqueness
  // Using a Set to track unique NFT identifiers
  const seenIds = new Set();
  const visuallyUniqueNfts = uniqueNfts.filter(nft => {
    if (!nft) return false;
    
    // Skip any NFTs without a valid ID
    if (!nft.uniqueId && !getNftKey(nft)) return false;
    
    // Use the existing uniqueId or generate a key
    const nftKey = nft.uniqueId || getNftKey(nft);
    
    // If we've seen this key before, filter it out
    if (seenIds.has(nftKey)) {
      return false;
    }
    
    // Otherwise, record that we've seen it and keep it
    seenIds.add(nftKey);
    return true;
  });
  
  // Log if we found and removed any additional visual duplicates
  if (visuallyUniqueNfts.length < uniqueNfts.length) {
    console.log(`Removed ${uniqueNfts.length - visuallyUniqueNfts.length} additional visual duplicates in NFTGrid`);
  }
  
  // Update the rendering variable to use our visually unique NFTs
  const nftsToRender = visuallyUniqueNfts;
  
  // Determine if we're in production (Vercel) or development
  const isProduction = process.env.NODE_ENV === 'production' || 
                       window.location.hostname.includes('vercel.app');
  
  // Choose the appropriate NFT card component based on environment
  const CardComponent = isProduction ? VercelNFTCard : NFTCard;
  
  // Loading state
  if (isLoading && (!nftsToRender || nftsToRender.length === 0)) {
    return (
      <div className="nft-grid-loading">
        <div className="loading-spinner"></div>
        <p>Loading NFTs...</p>
      </div>
    );
  }

  // Empty state
  if (!nftsToRender || nftsToRender.length === 0) {
    return (
      <div className="nft-grid-empty">
        <p className="nft-grid-empty-message">{emptyMessage}</p>
      </div>
    );
  }

  // Render a grid cell with the NFT card
  const Cell = ({ columnIndex, rowIndex, style, data }) => {
    const { nfts, columnCount, CardComponent } = data;
    const index = rowIndex * columnCount + columnIndex;
    
    // Don't render if index is out of bounds
    if (index >= nfts.length) {
      return null;
    }
    
    const nft = nfts[index];
    
    // Create a copy of the NFT object to avoid modifying non-extensible objects
    const nftCopy = {...nft};
    
    // Ensure collection_name is set on the copy of the nft object
    if (!nftCopy.collection_name) {
      nftCopy.collection_name = getCollectionName(nft);
    }
    
    // Use uniqueId if available, otherwise generate a key
    const nftKey = nft.uniqueId || getNftKey(nft) || `nft-${index}`;
    
    // Apply padding within the cell, not affecting the grid layout
    const cellStyle = {
      ...style,
      padding: 8,
      boxSizing: 'border-box',
      height: style.height,
      width: style.width
    };
    
    return (
      <div style={cellStyle} key={nftKey}>
        <div className="nft-cell-inner">
          <CardComponent 
            nft={nftCopy}
            virtualized={true} // Tell the card it's in a virtualized environment
          />
        </div>
      </div>
    );
  };

  // Memoize the Cell component to prevent unnecessary rerenders
  const MemoizedCell = React.memo(Cell, (prevProps, nextProps) => {
    // Only re-render if the data or position changed
    // Safety check to prevent undefined access
    const prevIndex = prevProps.rowIndex * prevProps.data.columnCount + prevProps.columnIndex;
    const nextIndex = nextProps.rowIndex * nextProps.data.columnCount + nextProps.columnIndex;
    
    const prevNft = prevIndex < prevProps.data.nfts.length ? prevProps.data.nfts[prevIndex] : null;
    const nextNft = nextIndex < nextProps.data.nfts.length ? nextProps.data.nfts[nextIndex] : null;
    
    if (!prevNft || !nextNft) return prevIndex === nextIndex;
    
    return (
      prevProps.columnIndex === nextProps.columnIndex &&
      prevProps.rowIndex === nextProps.rowIndex &&
      prevNft.uniqueId === nextNft.uniqueId
    );
  });

  // Render the virtualized grid
  return (
    <div className="nft-grid-container virtualized-grid-container">
      <AutoSizer>
        {({ height, width }) => {
          // Calculate responsive column and row settings
          const columnCount = getColumnCount(width);
          const itemWidth = width / columnCount;
          const itemSize = Math.max(itemWidth, 200); // Minimum size of 200px
          const rowCount = Math.ceil(nftsToRender.length / columnCount);
          
          // Use height or default to 600px if not provided
          const gridHeight = height || 600;
          
          console.log(`Rendering grid with dimensions: ${width}x${gridHeight}, columns: ${columnCount}, rows: ${rowCount}`);
          
          return (
            <FixedSizeGrid
              className="virtualized-grid"
              width={width}
              height={gridHeight}
              columnCount={columnCount}
              columnWidth={itemWidth}
              rowCount={rowCount}
              rowHeight={itemSize + 100} // Increased space for NFT title and collection
              itemData={{
                nfts: nftsToRender,
                columnCount,
                CardComponent
              }}
              overscanRowCount={3} // Render additional rows for smoother scrolling
              overscanColumnCount={2}
              style={{
                overflowX: 'hidden',
                overflowY: 'auto'
              }}
            >
              {MemoizedCell}
            </FixedSizeGrid>
          );
        }}
      </AutoSizer>
    </div>
  );
};

// Function to remove duplicate NFTs
function removeDuplicateNfts(nfts) {
  if (!nfts || nfts.length === 0) return [];
  
  const uniqueMap = new Map();
  const duplicatesFound = [];
  
  nfts.forEach(nft => {
    // Skip invalid NFTs
    if (!nft) return;
    
    // Get a unique key for this NFT using the consistent ID function
    // Prioritize existing uniqueId to avoid regenerating it
    const key = nft.uniqueId || createConsistentUniqueId(nft);
    
    if (!uniqueMap.has(key)) {
      // If this is a new uniqueId, store the NFT and ensure it has the uniqueId
      const nftWithId = {...nft, uniqueId: key};
      uniqueMap.set(key, nftWithId);
    } else {
      // Track duplicates for logging
      duplicatesFound.push({
        key,
        name: nft.name || nft.title || `Token #${nft.tokenId || nft.token_id}`,
        collection: nft.collection?.name || nft.contract?.name || 'Unknown Collection'
      });
    }
  });
  
  const uniqueNfts = [...uniqueMap.values()];
  
  // Log if duplicates were found and removed with details
  if (uniqueNfts.length < nfts.length) {
    console.log(`Removed ${nfts.length - uniqueNfts.length} duplicate NFTs in NFTGrid`);
    
    // Log a sample of duplicates for debugging
    if (duplicatesFound.length > 0) {
      console.log(`Sample of removed duplicates:`, 
        duplicatesFound.slice(0, Math.min(5, duplicatesFound.length))
      );
    }
  }
  
  return uniqueNfts;
}

// Utility functions to handle NFT data
const getCollectionName = (nft) => {
  if (!nft) return '';
  
  // Try various possible collection name locations in NFT metadata
  if (nft.contract && nft.contract.name) {
    return nft.contract.name;
  }
  
  if (nft.collection && nft.collection.name) {
    return nft.collection.name;
  }
  
  if (nft.contractMetadata && nft.contractMetadata.name) {
    return nft.contractMetadata.name;
  }
  
  if (nft.contract_name) {
    return nft.contract_name;
  }
  
  if (nft.contractName) {
    return nft.contractName;
  }
  
  return '';
};

const getContractAddress = (nft) => {
  if (!nft) return '';

  // Try to get contract address from various possible locations
  if (nft.contract && nft.contract.address) {
    return nft.contract.address;
  }
  
  if (nft.contractAddress) {
    return nft.contractAddress;
  }
  
  if (nft.id && nft.id.contractAddress) {
    return nft.id.contractAddress;
  }
  
  if (nft.token_address) {
    return nft.token_address;
  }
  
  if (nft.contract && nft.contract.id) {
    return nft.contract.id;
  }
  
  if (nft.address) {
    return nft.address;
  }
  
  // If we can't find a contract address, return an empty string
  return '';
};

const getTokenId = (nft) => {
  if (!nft) return '';
  
  if (nft.tokenId) {
    return nft.tokenId;
  }
  
  if (nft.id && nft.id.tokenId) {
    return nft.id.tokenId;
  }
  
  if (nft.token_id) {
    return nft.token_id;
  }
  
  return '';
};

const getNftKey = (nft) => {
  if (!nft) return '';
  
  return createConsistentUniqueId(nft);
};

export default NFTGrid; 