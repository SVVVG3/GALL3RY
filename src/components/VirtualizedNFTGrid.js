import React, { useCallback } from 'react';
import { FixedSizeGrid } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import NFTCard from './NftCard';
import '../styles/nft-unified.css';

/**
 * VirtualizedNFTGrid Component
 * 
 * A drop-in replacement for the old NFTGrid component that uses virtualization
 * for better performance with large collections of NFTs.
 * 
 * @param {Array|Object} nfts - Array of NFT objects or object with count/sample properties 
 * @param {boolean} isLoading - Whether NFTs are currently being loaded
 * @param {string} emptyMessage - Message to display when no NFTs are found
 */
const VirtualizedNFTGrid = ({ nfts = [], isLoading = false, emptyMessage = "No NFTs found" }) => {
  // Add debug logging
  React.useEffect(() => {
    console.log('VirtualizedNFTGrid received nfts:', {
      count: Array.isArray(nfts) ? nfts.length : (nfts?.count || 0),
      sample: Array.isArray(nfts) ? (nfts.length > 0 ? nfts[0] : null) : nfts?.sample || null,
      isLoading
    });
  }, [nfts, isLoading]);

  // Normalize nfts to always be an array
  const nftsArray = React.useMemo(() => {
    if (Array.isArray(nfts)) {
      return nfts;
    }
    // Handle the case where nfts is passed as {count, sample} object from FarcasterUserSearch
    if (nfts && typeof nfts === 'object' && nfts.count >= 0 && Array.isArray(nfts.data)) {
      return nfts.data;
    }
    // Return empty array as default
    return [];
  }, [nfts]);

  // Grid cell renderer
  const Cell = useCallback(({ columnIndex, rowIndex, style, data }) => {
    const index = rowIndex * data.columnCount + columnIndex;
    
    if (index >= data.nfts.length) {
      return null;
    }
    
    const nft = data.nfts[index];
    
    // Skip rendering if NFT object is null or empty
    if (!nft) {
      console.warn(`Empty NFT object at index ${index}`);
      return null;
    }
    
    // Log info about the first few NFTs to check their properties
    if (index < 3) {
      console.log(`NFT at index ${index}:`, {
        id: nft.uniqueId || nft.id,
        name: nft.name,
        hasImage: Boolean(nft.image),
        imageType: typeof nft.image,
        mediaArray: Boolean(nft.media && nft.media.length > 0),
        tokenId: nft.tokenId || nft.token_id
      });
    }
    
    // Generate a stable key for the NFT card
    const nftKey = nft.uniqueId || 
                 `nft-${index}-${nft.tokenId || nft.token_id || nft.id || index}`;
    
    return (
      <div style={{
        ...style,
        padding: '10px',
      }}>
        <div style={{ height: '100%' }}>
          <NFTCard key={nftKey} nft={nft} />
        </div>
      </div>
    );
  }, []);

  if (isLoading) {
    return (
      <div className="nft-loading">
        <div className="loading-spinner"></div>
        <p>Loading NFTs...</p>
      </div>
    );
  }

  if (!nftsArray || nftsArray.length === 0) {
    return (
      <div className="nft-empty">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="virtualized-grid-container">
      <AutoSizer>
        {({ height, width }) => {
          // Calculate number of columns based on width
          // Minimum card width is 250px with 20px gap
          const columnWidth = 270;
          const columnCount = Math.max(1, Math.floor(width / columnWidth));
          const rowCount = Math.ceil(nftsArray.length / columnCount);
          
          return (
            <FixedSizeGrid
              className="virtualized-grid"
              columnCount={columnCount}
              columnWidth={width / columnCount}
              height={Math.min(800, rowCount * 320)} // Set a reasonable max height, but allow smaller if fewer items
              rowCount={rowCount}
              rowHeight={320} // Approximate height for an NFT card
              width={width}
              itemData={{ nfts: nftsArray, columnCount }}
            >
              {Cell}
            </FixedSizeGrid>
          );
        }}
      </AutoSizer>
    </div>
  );
};

export default VirtualizedNFTGrid; 