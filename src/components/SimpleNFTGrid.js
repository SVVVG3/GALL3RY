import React, { useState, useCallback, useMemo, memo, useEffect, useRef } from 'react';
import { FixedSizeGrid } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import '../styles/NFTGrid.css';

// NFT Card Component - Enhanced for virtualization
const NFTCard = React.memo(({ nft, style }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  const title = getNftTitle(nft);
  const collection = getCollectionName(nft);
  const floorPrice = getFloorPrice(nft);
  
  const contractAddress = getContractAddress(nft);
  const tokenId = nft.tokenId || nft.id?.tokenId || nft.token_id;
  const openseaUrl = `https://opensea.io/assets/ethereum/${contractAddress}/${tokenId}`;
  
  const handleImageLoad = () => {
    setImageLoaded(true);
  };
  
  const handleImageError = () => {
    setImageError(true);
  };
  
  return (
    <div className="nft-item-wrapper" style={style}>
      <div className="nft-item">
        <a href={openseaUrl} target="_blank" rel="noopener noreferrer" className="nft-link">
          <div className="nft-image-container">
            {!imageLoaded && !imageError && (
              <div className="nft-image-placeholder">Loading...</div>
            )}
            
            {imageError ? (
              <div className="nft-image-error">Unable to load image</div>
            ) : (
              <img
                src={getImageUrl(nft)}
                alt={title}
                className={`nft-image ${imageLoaded ? 'loaded' : ''}`}
                onLoad={handleImageLoad}
                onError={handleImageError}
              />
            )}
          </div>
          
          <div className="nft-info">
            <h3 className="nft-title">{title || 'Unnamed NFT'}</h3>
            <p className="nft-collection">{collection || 'Unknown Collection'}</p>
            {floorPrice && <p className="nft-price">{floorPrice}</p>}
          </div>
        </a>
      </div>
    </div>
  );
});

/**
 * Optimized NFT Grid component with virtualization for better performance
 */
const SimpleNFTGrid = ({ nfts, isLoading, loadMore, hasNextPage }) => {
  const gridRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [columnCount, setColumnCount] = useState(4);
  
  // Calculate column count based on viewport width
  useEffect(() => {
    const updateColumnCount = () => {
      const width = window.innerWidth;
      if (width < 480) setColumnCount(1);
      else if (width < 768) setColumnCount(2);
      else if (width < 1200) setColumnCount(3);
      else setColumnCount(4);
    };
    
    updateColumnCount();
    window.addEventListener('resize', updateColumnCount);
    return () => window.removeEventListener('resize', updateColumnCount);
  }, []);
  
  // Update grid dimensions when container size changes
  useEffect(() => {
    if (!gridRef.current) return;
    
    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });
    
    resizeObserver.observe(gridRef.current);
    return () => resizeObserver.disconnect();
  }, []);
  
  // Calculate row count based on column count and NFT count
  const rowCount = nfts.length ? Math.ceil(nfts.length / columnCount) : 0;
  
  // Calculate ideal cell size based on column count and container width
  const cellWidth = dimensions.width ? Math.floor(dimensions.width / columnCount) : 250;
  const cellHeight = Math.floor(cellWidth * 1.5); // 3:2 aspect ratio for cells
  
  // Intersection observer for infinite loading
  const loaderRef = useCallback(node => {
    if (!node || !hasNextPage || isLoading) return;
    
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && loadMore) {
        loadMore();
      }
    }, { threshold: 0.1 });
    
    observer.observe(node);
    
    return () => observer.disconnect();
  }, [hasNextPage, isLoading, loadMore]);
  
  if (!nfts || nfts.length === 0) {
    return (
      <div className="nft-grid-empty">
        {isLoading ? 
          <div className="nft-grid-loading">Loading NFTs...</div> : 
          <div className="nft-grid-no-results">No NFTs found</div>
        }
      </div>
    );
  }
  
  // Render a virtualized grid
  return (
    <div className="virtualized-grid-container" ref={gridRef}>
      {dimensions.width > 0 && (
        <FixedSizeGrid
          className="virtualized-grid"
          width={dimensions.width}
          height={Math.min(dimensions.height || window.innerHeight * 0.8, window.innerHeight * 0.8)}
          columnCount={columnCount}
          rowCount={rowCount}
          columnWidth={cellWidth}
          rowHeight={cellHeight}
          itemData={{
            nfts,
            columnCount
          }}
        >
          {({ columnIndex, rowIndex, style, data }) => {
            const { nfts, columnCount } = data;
            const index = rowIndex * columnCount + columnIndex;
            
            if (index >= nfts.length) return null;
            
            const nft = nfts[index];
            return (
              <NFTCard
                nft={nft}
                style={style}
              />
            );
          }}
        </FixedSizeGrid>
      )}
      
      {hasNextPage && (
        <div ref={loaderRef} className="nft-grid-loader">
          {isLoading && <div className="loader">Loading more NFTs...</div>}
        </div>
      )}
    </div>
  );
};

// Utility functions to handle NFT data
const getNftKey = (nft) => {
  if (!nft) return null;
  
  // Handle different NFT data formats
  if (nft.id && nft.id.tokenId) {
    return `${nft.contract.address}-${nft.id.tokenId}`;
  }
  
  if (nft.contract && nft.tokenId) {
    return `${nft.contract.address}-${nft.tokenId}`;
  }
  
  if (nft.token_address && nft.token_id) {
    return `${nft.token_address}-${nft.token_id}`;
  }
  
  return nft.id || `${nft.contract?.address || nft.token_address}-${nft.tokenId || nft.token_id}`;
};

const getImageUrl = (nft) => {
  if (!nft) return '';
  
  // Try various possible image locations in NFT metadata
  if (nft.media && nft.media.length > 0 && nft.media[0].gateway) {
    return nft.media[0].gateway;
  }
  
  if (nft.metadata && nft.metadata.image) {
    return nft.metadata.image;
  }
  
  if (nft.image_url) {
    return nft.image_url;
  }
  
  if (nft.image) {
    return nft.image;
  }
  
  // For IPFS URLs, make sure they're properly formatted
  if (nft.metadata && nft.metadata.image && nft.metadata.image.startsWith('ipfs://')) {
    return nft.metadata.image.replace('ipfs://', 'https://ipfs.io/ipfs/');
  }
  
  return '';
};

const getNftTitle = (nft) => {
  if (!nft) return '';
  
  // Try various possible title locations in NFT metadata
  if (nft.title) {
    return nft.title;
  }
  
  if (nft.metadata && nft.metadata.name) {
    return nft.metadata.name;
  }
  
  if (nft.name) {
    return nft.name;
  }
  
  if (nft.rawMetadata && nft.rawMetadata.name) {
    return nft.rawMetadata.name;
  }
  
  // Fall back to "Token #ID" format
  if (nft.tokenId) {
    return `Token #${nft.tokenId}`;
  }
  
  if (nft.token_id) {
    return `Token #${nft.token_id}`;
  }
  
  return 'Unnamed NFT';
};

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

const getFloorPrice = (nft) => {
  if (!nft) return '';
  
  // Try different price locations depending on the data source
  let price = null;
  
  if (nft.collection && nft.collection.floorPrice) {
    price = nft.collection.floorPrice;
  } else if (nft.contractMetadata && nft.contractMetadata.openSea && nft.contractMetadata.openSea.floorPrice) {
    price = nft.contractMetadata.openSea.floorPrice;
  } else if (nft.floor_price) {
    price = nft.floor_price;
  }
  
  // Format price if available
  if (price) {
    // Convert to a readable format (2 decimals)
    return `Floor: ${parseFloat(price).toFixed(2)} ETH`;
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

export default SimpleNFTGrid; 