import React, { useState, useCallback, useEffect, useMemo } from 'react';
import '../styles/NFTGrid.css';

// NFT Card Component
const NFTCard = React.memo(({ nft }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [useDirectUrl, setUseDirectUrl] = useState(false);
  
  // Extract NFT data
  const title = getNftTitle(nft);
  const collection = getCollectionName(nft);
  const floorPrice = getFloorPrice(nft);
  
  const contractAddress = getContractAddress(nft);
  const tokenId = nft.tokenId || nft.id?.tokenId || nft.token_id;
  const openseaUrl = `https://opensea.io/assets/ethereum/${contractAddress}/${tokenId}`;
  
  // Get image URL - make sure we get a string URL, not an object
  const rawImageUrl = getImageUrl(nft);
  
  // Only use the proxy if we have a valid string URL
  const imageUrl = !useDirectUrl && rawImageUrl && typeof rawImageUrl === 'string'
    ? `/api/image-proxy?url=${encodeURIComponent(rawImageUrl)}`
    : rawImageUrl;
  
  // Debug logging
  useEffect(() => {
    console.log('NFT card rendering:', {
      title,
      rawImageUrl,
      imageUrl,
      useDirectUrl
    });
  }, [title, rawImageUrl, imageUrl, useDirectUrl]);
  
  const handleImageLoad = () => {
    setImageLoaded(true);
  };
  
  const handleImageError = () => {
    console.error('Image failed to load:', imageUrl);
    
    // If proxy failed, try direct URL
    if (!useDirectUrl && typeof rawImageUrl === 'string') {
      console.log('Trying direct URL as fallback:', rawImageUrl);
      setUseDirectUrl(true);
    } else {
      setImageError(true);
    }
  };
  
  // Don't try to render with invalid image URL
  const validImageUrl = typeof imageUrl === 'string' ? 
    imageUrl : 
    `https://via.placeholder.com/300?text=${encodeURIComponent(title || 'NFT')}`;
  
  return (
    <div className="nft-item-wrapper-fallback">
      <div className="nft-item">
        <a href={openseaUrl} target="_blank" rel="noopener noreferrer" className="nft-link">
          <div className="nft-image-container">
            {!imageLoaded && !imageError && (
              <div className="nft-image-placeholder">Loading...</div>
            )}
            
            {imageError ? (
              <div className="nft-image-error">Image unavailable</div>
            ) : (
              <img
                src={validImageUrl}
                alt={title || 'NFT Image'}
                className={`nft-image ${imageLoaded ? 'loaded' : ''}`}
                onLoad={handleImageLoad}
                onError={handleImageError}
                loading="lazy"
              />
            )}
          </div>
          
          <div className="nft-info">
            <h3 className="nft-title">{title || 'Unnamed NFT'}</h3>
            {collection && <p className="nft-collection">{collection}</p>}
            {floorPrice && <p className="nft-price">{floorPrice}</p>}
          </div>
        </a>
      </div>
    </div>
  );
});

/**
 * Simplified NFT Grid component 
 */
const SimpleNFTGrid = ({ nfts, isLoading, loadMore, hasNextPage }) => {
  // Deduplicate NFTs by using a unique ID
  const uniqueNfts = useMemo(() => {
    if (!nfts || nfts.length === 0) return [];
    
    // Generate a unique key for each NFT
    const seen = new Set();
    const unique = [];
    
    nfts.forEach(nft => {
      const key = getUniqueNftKey(nft);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(nft);
      }
    });
    
    return unique;
  }, [nfts]);
  
  // Get a unique key for an NFT to deduplicate
  function getUniqueNftKey(nft) {
    const contract = getContractAddress(nft);
    const tokenId = nft.tokenId || nft.id?.tokenId || nft.token_id;
    return `${contract}-${tokenId}`;
  }
  
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
  
  // If there are no NFTs, show empty state
  if (!uniqueNfts || uniqueNfts.length === 0) {
    return (
      <div className="nft-grid-empty">
        {isLoading ? 
          <div className="nft-grid-loading">Loading NFTs...</div> : 
          <div className="nft-grid-no-results">No NFTs found</div>
        }
      </div>
    );
  }
  
  // Render the grid
  return (
    <div className="nft-grid-container">
      <div className="fallback-grid">
        {uniqueNfts.map((nft) => (
          <NFTCard key={`nft-${getUniqueNftKey(nft)}`} nft={nft} />
        ))}
      </div>
        
      {hasNextPage && (
        <div ref={loaderRef} className="nft-grid-loader">
          {isLoading && <div className="loader">Loading more NFTs...</div>}
        </div>
      )}
    </div>
  );
};

// Utility functions to handle NFT data
const getImageUrl = (nft) => {
  if (!nft) return '';
  
  // Check if the image is already a complex object with multiple URL options
  if (nft.media?.[0] && typeof nft.media[0] === 'object') {
    const mediaObj = nft.media[0];
    
    // Handle object with multiple URL options
    if (mediaObj.cachedUrl) return mediaObj.cachedUrl;
    if (mediaObj.gateway) return mediaObj.gateway;
    if (mediaObj.thumbnailUrl) return mediaObj.thumbnailUrl;
    if (mediaObj.pngUrl) return mediaObj.pngUrl;
    if (mediaObj.originalUrl) return mediaObj.originalUrl;
    if (mediaObj.raw) {
      const rawUrl = mediaObj.raw;
      if (typeof rawUrl === 'string' && rawUrl.startsWith('ipfs://')) {
        return rawUrl.replace('ipfs://', 'https://ipfs.io/ipfs/');
      }
      return rawUrl;
    }
  }
  
  // For cases where rawImageUrl might be an object itself 
  if (typeof nft.rawImageUrl === 'object' && nft.rawImageUrl !== null) {
    const imgObj = nft.rawImageUrl;
    if (imgObj.cachedUrl) return imgObj.cachedUrl;
    if (imgObj.thumbnailUrl) return imgObj.thumbnailUrl;
    if (imgObj.pngUrl) return imgObj.pngUrl;
    if (imgObj.originalUrl) return imgObj.originalUrl;
    return ''; // No valid URL found in the object
  }
  
  // Try Alchemy v3 format first (preferred)
  if (nft.media && nft.media.length > 0) {
    // Gateway is the cached, normalized version
    if (nft.media[0].gateway && typeof nft.media[0].gateway === 'string') {
      return nft.media[0].gateway;
    }
    
    // Thumbnail is a smaller version
    if (nft.media[0].thumbnail && typeof nft.media[0].thumbnail === 'string') {
      return nft.media[0].thumbnail;
    }
    
    // Raw might be an IPFS URL
    if (nft.media[0].raw && typeof nft.media[0].raw === 'string') {
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