import React, { useState, useCallback, useMemo, memo, useEffect, useRef } from 'react';
import { FixedSizeGrid } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import '../styles/NFTGrid.css';

// NFT Card Component - Enhanced for virtualization
const NFTCard = React.memo(({ nft, style }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [useDirectUrl, setUseDirectUrl] = useState(false);
  
  // Extract NFT data with additional logging for debugging
  const title = getNftTitle(nft);
  const collection = getCollectionName(nft);
  const floorPrice = getFloorPrice(nft);
  
  const contractAddress = getContractAddress(nft);
  const tokenId = nft.tokenId || nft.id?.tokenId || nft.token_id;
  const openseaUrl = `https://opensea.io/assets/ethereum/${contractAddress}/${tokenId}`;
  
  // Get image URL with CORS protection
  const rawImageUrl = getImageUrl(nft);
  // First try with proxy, and fall back to direct URL if needed
  const imageUrl = !useDirectUrl && rawImageUrl 
    ? `/api/image-proxy?url=${encodeURIComponent(rawImageUrl)}` 
    : rawImageUrl;
  
  // Debug log the NFT structure
  useEffect(() => {
    console.log('Rendering NFT card:', { 
      title, 
      collection, 
      contractAddress, 
      tokenId,
      imageUrl: imageUrl,
      rawImageUrl: rawImageUrl,
      useDirectUrl: useDirectUrl
    });
  }, [title, collection, contractAddress, tokenId, imageUrl, rawImageUrl, useDirectUrl]);
  
  const handleImageLoad = () => {
    setImageLoaded(true);
  };
  
  const handleImageError = () => {
    console.error('Image failed to load:', useDirectUrl ? rawImageUrl : 'proxy url');
    
    // If proxy failed, try direct URL
    if (!useDirectUrl && rawImageUrl) {
      console.log('Trying direct URL as fallback');
      setUseDirectUrl(true);
    } else {
      setImageError(true);
    }
  };
  
  // Create a modified style object that ensures the card stays within its container
  const cardStyle = style ? {
    ...style,
    width: style.width ? Math.min(style.width, window.innerWidth - 40) : style.width,
    overflow: 'hidden',
  } : null;
  
  const cardContent = (
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
              src={imageUrl || 'https://via.placeholder.com/300?text=No+Image'}
              alt={title || 'NFT Image'}
              className={`nft-image ${imageLoaded ? 'loaded' : ''}`}
              onLoad={handleImageLoad}
              onError={handleImageError}
              loading="lazy"
              crossOrigin="anonymous"
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
  );
  
  // For virtualized grid
  if (cardStyle) {
    return (
      <div className="nft-item-wrapper" style={cardStyle}>
        {cardContent}
      </div>
    );
  }
  
  // For fallback grid
  return (
    <div className="nft-item-wrapper-fallback">
      {cardContent}
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
  const [useVirtualization, setUseVirtualization] = useState(true);
  
  // Log NFT count for debugging
  useEffect(() => {
    console.log(`SimpleNFTGrid rendering with ${nfts?.length || 0} NFTs, isLoading: ${isLoading}`);
    if (nfts?.length > 0) {
      console.log('First NFT sample:', nfts[0]);
    }
  }, [nfts, isLoading]);
  
  // Calculate column count based on viewport width
  useEffect(() => {
    const updateColumnCount = () => {
      const width = window.innerWidth;
      if (width < 500) setColumnCount(1);
      else if (width < 800) setColumnCount(2);
      else if (width < 1200) setColumnCount(3);
      else setColumnCount(4);
      
      console.log(`Window width: ${width}px, setting column count to ${
        width < 500 ? 1 : width < 800 ? 2 : width < 1200 ? 3 : 4
      }`);
    };
    
    updateColumnCount();
    window.addEventListener('resize', updateColumnCount);
    return () => window.removeEventListener('resize', updateColumnCount);
  }, []);
  
  // Update grid dimensions when container size changes
  useEffect(() => {
    if (!gridRef.current) return;
    
    // Set initial dimensions immediately
    const initialWidth = gridRef.current.clientWidth || window.innerWidth * 0.9;
    const initialHeight = window.innerHeight * 0.8;
    
    console.log(`Initial grid dimensions: ${initialWidth}x${initialHeight}px`);
    
    setDimensions({
      width: initialWidth,
      height: initialHeight
    });
    
    const resizeObserver = new ResizeObserver(entries => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        // Ensure we have a reasonable height
        const newHeight = height || window.innerHeight * 0.8;
        
        console.log(`Grid container resized: ${width}x${newHeight}px`);
        setDimensions({ width, height: newHeight });
      }
    });
    
    resizeObserver.observe(gridRef.current);
    return () => resizeObserver.disconnect();
  }, []);
  
  // Calculate row count based on column count and NFT count
  const rowCount = useMemo(() => {
    const calculatedRowCount = nfts && nfts.length ? Math.ceil(nfts.length / columnCount) : 0;
    console.log(`Calculated rowCount: ${calculatedRowCount} based on ${nfts?.length || 0} NFTs and ${columnCount} columns`);
    return calculatedRowCount;
  }, [nfts, columnCount]);
  
  // Calculate cell sizes for grid
  const { cellWidth, cellHeight } = useMemo(() => {
    // Default values
    if (!dimensions.width) {
      return { cellWidth: 250, cellHeight: 350 };
    }
    
    // Calculate available width
    const containerPadding = 20; // 10px padding on each side
    const cellGap = 24; // 12px gap on each side
    const availableWidth = dimensions.width - containerPadding;
    
    // Calculate cell dimensions with gaps
    const width = Math.floor((availableWidth / columnCount) - cellGap);
    const height = Math.floor(width * 1.4); // 1.4:1 aspect ratio
    
    console.log(`Calculated cell dimensions: ${width}x${height}px from available width ${availableWidth}px and ${columnCount} columns`);
    
    return { cellWidth: width, cellHeight: height };
  }, [dimensions.width, columnCount]);
  
  // Intersection observer for infinite loading
  const loaderRef = useCallback(node => {
    if (!node || !hasNextPage || isLoading) return;
    
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && loadMore) {
        console.log('Load more NFTs intersection triggered');
        loadMore();
      }
    }, { threshold: 0.1 });
    
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isLoading, loadMore]);
  
  // Debug effect to check why the grid isn't rendering
  useEffect(() => {
    console.log('Grid rendering conditions:', {
      hasNfts: !!nfts && nfts.length > 0,
      dimensionsWidth: dimensions.width,
      dimensionsHeight: dimensions.height,
      rowCount,
      columnCount,
      cellWidth,
      cellHeight,
      useVirtualization
    });
    
    // If we have rendering issues, switch to the fallback grid
    if ((!dimensions.width || !dimensions.height) && nfts?.length > 0) {
      console.log('Switching to fallback grid because dimensions are not set properly');
      setUseVirtualization(false);
    }
  }, [nfts, dimensions, rowCount, columnCount, cellWidth, cellHeight]);
  
  // If there are no NFTs, show empty state
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
  
  // Fallback non-virtualized grid layout
  if (!useVirtualization) {
    return (
      <div className="nft-grid-container">
        <div className="nft-grid fallback-grid">
          {nfts.map((nft, index) => (
            <NFTCard key={`nft-${index}`} nft={nft} />
          ))}
        </div>
        
        {hasNextPage && (
          <div ref={loaderRef} className="nft-grid-loader">
            {isLoading && <div className="loader">Loading more NFTs...</div>}
          </div>
        )}
      </div>
    );
  }
  
  // Render a virtualized grid
  return (
    <div className="virtualized-grid-container" ref={gridRef} style={{ height: '80vh', minHeight: '800px' }}>
      <FixedSizeGrid
        className="virtualized-grid"
        width={dimensions.width || window.innerWidth * 0.9}
        height={dimensions.height || window.innerHeight * 0.8}
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
  
  // More detailed debug logging to understand NFT structure
  console.log('NFT data structure:', {
    id: nft.id,
    tokenId: nft.tokenId || nft.id?.tokenId || nft.token_id,
    contractAddress: getContractAddress(nft),
    hasMedia: !!nft.media,
    mediaLength: nft.media?.length,
    mediaGateway: nft.media?.[0]?.gateway,
    mediaThumbnail: nft.media?.[0]?.thumbnail,
    mediaRaw: nft.media?.[0]?.raw,
    metadata: nft.metadata?.image,
    rawMetadata: nft.rawMetadata?.image,
    image_url: nft.image_url,
    image: nft.image,
    chain: nft.chain || 'unknown'
  });
  
  // Try Alchemy v3 format first (preferred)
  if (nft.media && nft.media.length > 0) {
    // Gateway is the cached, normalized version
    if (nft.media[0].gateway) {
      return nft.media[0].gateway;
    }
    
    // Thumbnail is a smaller version
    if (nft.media[0].thumbnail) {
      return nft.media[0].thumbnail;
    }
    
    // Raw might be an IPFS URL
    if (nft.media[0].raw) {
      const rawUrl = nft.media[0].raw;
      if (rawUrl.startsWith('ipfs://')) {
        return rawUrl.replace('ipfs://', 'https://ipfs.io/ipfs/');
      }
      return rawUrl;
    }
  }
  
  // Try metadata.image which is common in most formats
  if (nft.metadata && nft.metadata.image) {
    const metadataImage = nft.metadata.image;
    // Handle IPFS URLs
    if (typeof metadataImage === 'string' && metadataImage.startsWith('ipfs://')) {
      return metadataImage.replace('ipfs://', 'https://ipfs.io/ipfs/');
    }
    return metadataImage;
  }
  
  // Try standard image URL fields
  if (nft.image_url) {
    return nft.image_url;
  }
  
  if (nft.image) {
    return nft.image;
  }
  
  // Try rawMetadata (used in some Alchemy responses)
  if (nft.rawMetadata && nft.rawMetadata.image) {
    const rawImage = nft.rawMetadata.image;
    if (typeof rawImage === 'string' && rawImage.startsWith('ipfs://')) {
      return rawImage.replace('ipfs://', 'https://ipfs.io/ipfs/');
    }
    return rawImage;
  }
  
  // For old OpenSea formats
  if (nft.imageUrl) {
    return nft.imageUrl;
  }
  
  if (nft.image_preview_url) {
    return nft.image_preview_url;
  }
  
  // Last resort: try to generate an OpenSea URL if we have contract and token ID
  const contractAddress = getContractAddress(nft);
  const tokenId = nft.tokenId || nft.id?.tokenId || nft.token_id;
  
  if (contractAddress && tokenId) {
    return `https://api.opensea.io/api/v1/asset/${contractAddress}/${tokenId}/image`;
  }
  
  // Fallback to a placeholder with the token ID if available
  if (tokenId) {
    return `https://via.placeholder.com/300?text=NFT+%23${tokenId}`;
  }
  
  // Default placeholder
  return 'https://via.placeholder.com/300?text=No+Image';
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