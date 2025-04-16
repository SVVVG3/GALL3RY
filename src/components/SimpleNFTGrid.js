import React, { useState, useCallback, useMemo, memo, useEffect } from 'react';
import { FixedSizeGrid } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import '../styles/NFTGrid.css';

// Create a memoized NFT Card component to prevent unnecessary re-renders
const NFTCard = memo(({ nft, onLoad, onError }) => {
  const nftId = getNftKey(nft);
  const imageUrl = getImageUrl(nft);
  const title = getNftTitle(nft);
  const collection = getCollectionName(nft);
  const [imageError, setImageError] = useState(false);
  
  // Generate fallback color based on NFT id for consistent placeholders
  const fallbackColor = useMemo(() => {
    const hash = nftId.split('').reduce((acc, char) => char.charCodeAt(0) + acc, 0);
    return `hsl(${hash % 360}, 70%, 80%)`;
  }, [nftId]);
  
  // Handle image errors internally first
  const handleImageError = () => {
    setImageError(true);
    onError(nft);
  };
  
  return (
    <div className="nft-card">
      <div className="nft-image">
        {imageUrl && !imageError ? (
          <img
            src={imageUrl}
            alt={title}
            onLoad={() => onLoad(nftId)}
            onError={handleImageError}
            loading="lazy"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              objectPosition: 'center',
              backgroundColor: fallbackColor
            }}
            referrerPolicy="no-referrer"
            crossOrigin="anonymous"
          />
        ) : (
          <div 
            className="nft-placeholder"
            style={{ 
              backgroundColor: fallbackColor,
              position: 'relative',
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              overflow: 'hidden'
            }}
          >
            <span style={{ 
              fontSize: '32px', 
              fontWeight: 'bold',
              color: 'rgba(0,0,0,0.5)'
            }}>
              {title.charAt(0).toUpperCase()}
            </span>
            {imageError && (
              <div style={{
                position: 'absolute',
                bottom: '5px',
                right: '5px',
                background: 'rgba(255,255,255,0.7)',
                borderRadius: '4px',
                padding: '2px 6px',
                fontSize: '10px',
                color: '#e74c3c'
              }}>
                Image unavailable
              </div>
            )}
          </div>
        )}
      </div>
      <div className="nft-info">
        <h3 className="nft-name">{title}</h3>
        <p className="nft-collection">{collection}</p>
      </div>
    </div>
  );
});

/**
 * Optimized NFT Grid component with virtualization for better performance
 */
const SimpleNFTGrid = ({ nfts = [] }) => {
  // Track image loading state
  const [loadedImages, setLoadedImages] = useState({});
  const [failedImages, setFailedImages] = useState({});
  
  // Reset tracking when NFTs change
  useEffect(() => {
    if (nfts.length > 0) {
      setLoadedImages({});
      setFailedImages({});
    }
  }, [nfts.length]);
  
  // Handle successful image load
  const handleImageSuccess = useCallback((nftId) => {
    setLoadedImages(prev => ({
      ...prev,
      [nftId]: true
    }));
  }, []);
  
  // Handle image load error - simplified with fewer console logs
  const handleImageError = useCallback((nft) => {
    const nftId = getNftKey(nft);
    
    setFailedImages(prev => ({
      ...prev,
      [nftId]: true
    }));
  }, []);
  
  // Grid cell renderer - only renders what's visible
  const Cell = useCallback(({ columnIndex, rowIndex, style, data }) => {
    const { items, columnCount } = data;
    const index = rowIndex * columnCount + columnIndex;
    
    if (index >= items.length) {
      return <div style={style} />;
    }
    
    const nft = items[index];
    
    return (
      <div style={style} className="nft-item">
        <NFTCard 
          nft={nft} 
          onLoad={handleImageSuccess} 
          onError={handleImageError}
        />
      </div>
    );
  }, [handleImageSuccess, handleImageError]);
  
  // Adjust the number of columns based on screen width
  const getColumnCount = (width) => {
    if (width >= 1200) return 4;
    if (width >= 768) return 3; 
    if (width >= 480) return 2;
    return 1;
  };
  
  // If we have no NFTs, show a message
  if (nfts.length === 0) {
    return (
      <div className="no-nfts-message">
        <p>No NFTs to display</p>
      </div>
    );
  }
  
  // Render the virtualized grid
  return (
    <div className="virtualized-grid-container">
      <AutoSizer>
        {({ height, width }) => {
          const columnCount = getColumnCount(width);
          const rowCount = Math.ceil(nfts.length / columnCount);
          const columnWidth = width / columnCount;
          const rowHeight = columnWidth * 1.4; // Card aspect ratio with info section
          
          return (
            <FixedSizeGrid
              className="nft-grid"
              width={width}
              height={height}
              columnCount={columnCount}
              columnWidth={columnWidth}
              rowCount={rowCount}
              rowHeight={rowHeight}
              itemData={{
                items: nfts,
                columnCount
              }}
            >
              {Cell}
            </FixedSizeGrid>
          );
        }}
      </AutoSizer>
    </div>
  );
};

// Helper functions - moved outside component and optimized
function getNftKey(nft) {
  if (!nft) return 'unknown';
  return nft.id || 
         `${nft.contractAddress || nft.contract?.address || ''}_${nft.tokenId || ''}` || 
         String(Math.random());
}

function getImageUrl(nft) {
  if (!nft) return null;
  
  // Try all possible image paths in order of reliability
  let imageUrl = null;
  
  // Handle Alchemy's format with .image field
  if (nft.image) {
    if (typeof nft.image === 'object') {
      imageUrl = nft.image.cachedUrl || 
                nft.image.thumbnailUrl || 
                nft.image.pngUrl || 
                nft.image.originalUrl || 
                (nft.image.gateway ? nft.image.gateway : null) ||
                (nft.image.url && typeof nft.image.url === 'string' ? nft.image.url : null);
    } else if (typeof nft.image === 'string') {
      imageUrl = nft.image;
    }
  }
  
  // Try media array
  if (!imageUrl && nft.media && Array.isArray(nft.media) && nft.media.length > 0) {
    const media = nft.media[0];
    if (media) {
      imageUrl = media.gateway || media.thumbnailUrl || media.raw || media.uri;
    }
  }
  
  // Try raw metadata
  if (!imageUrl && nft.raw && nft.raw.metadata && nft.raw.metadata.image) {
    imageUrl = nft.raw.metadata.image;
  }
  
  // Try metadata.image
  if (!imageUrl && nft.metadata && nft.metadata.image) {
    imageUrl = nft.metadata.image;
  }
  
  // Try image_url variants
  if (!imageUrl) {
    if (nft.raw && nft.raw.metadata && nft.raw.metadata.image_url) {
      imageUrl = nft.raw.metadata.image_url;
    } else if (nft.metadata && nft.metadata.image_url) {
      imageUrl = nft.metadata.image_url;
    }
  }
  
  // If still no image, check for tokenUri that might be directly usable
  if (!imageUrl && nft.tokenUri && nft.tokenUri.gateway) {
    imageUrl = nft.tokenUri.gateway;
  }
  
  // Handle various IPFS formats
  if (imageUrl && typeof imageUrl === 'string') {
    // Standard IPFS protocol
    if (imageUrl.startsWith('ipfs://')) {
      imageUrl = imageUrl.replace('ipfs://', 'https://cloudflare-ipfs.com/ipfs/');
    }
    
    // Handle IPFS URLs that use ipfs/xxx format but without protocol
    else if (imageUrl.includes('/ipfs/') && !imageUrl.includes('https://')) {
      const ipfsPath = imageUrl.split('/ipfs/')[1];
      imageUrl = `https://cloudflare-ipfs.com/ipfs/${ipfsPath}`;
    }
    
    // Handle pinata URLs
    else if (imageUrl.includes('gateway.pinata.cloud')) {
      const ipfsPath = imageUrl.split('/ipfs/')[1];
      if (ipfsPath) {
        imageUrl = `https://cloudflare-ipfs.com/ipfs/${ipfsPath}`;
      }
    }
    
    // Handle raw CIDs without any protocol
    else if (/^[a-zA-Z0-9]{46,59}$/.test(imageUrl)) {
      imageUrl = `https://cloudflare-ipfs.com/ipfs/${imageUrl}`;
    }
    
    // Add image proxy for external URLs to avoid CORS issues
    if (imageUrl.startsWith('http') && !imageUrl.includes('cloudflare-ipfs.com')) {
      // Use app's image proxy if available, otherwise leave as is
      if (window.location.origin) {
        imageUrl = `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
      }
    }
  }
  
  return imageUrl;
}

function getNftTitle(nft) {
  if (!nft) return 'Unknown NFT';
  return nft.name || nft.title || `#${nft.tokenId || '0'}`;
}

function getCollectionName(nft) {
  if (!nft) return 'Unknown Collection';
  
  if (nft.collection && nft.collection.name) {
    return nft.collection.name;
  }
  
  if (nft.contract) {
    if (nft.contract.name) {
      return nft.contract.name;
    }
    
    if (nft.contract.openSeaMetadata && nft.contract.openSeaMetadata.collectionName) {
      return nft.contract.openSeaMetadata.collectionName;
    }
    
    if (nft.contract.address) {
      return `${nft.contract.address.slice(0, 6)}...${nft.contract.address.slice(-4)}`;
    }
  }
  
  if (nft.contractAddress) {
    return `${nft.contractAddress.slice(0, 6)}...${nft.contractAddress.slice(-4)}`;
  }
  
  return 'Unknown Collection';
}

export default SimpleNFTGrid; 