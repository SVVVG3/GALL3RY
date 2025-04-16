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
  
  // Check for Alchemy media format first
  const cachedImageUrl = getCachedImageUrl(nft);
  
  // Debug - log the NFT object
  useEffect(() => {
    if (nft.media && nft.media.length > 0) {
      console.log('NFT media object:', JSON.stringify(nft.media[0]));
    }
  }, [nft]);
  
  // Get image URL - make sure we get a string URL, not an object
  const imageUrl = cachedImageUrl || (useDirectUrl ? getImageUrl(nft) : `/api/image-proxy?url=${encodeURIComponent(getImageUrl(nft))}`);
  
  // Debug logging
  useEffect(() => {
    console.log('NFT card rendering:', {
      title,
      cachedImageUrl,
      imageUrl,
      useDirectUrl
    });
  }, [title, cachedImageUrl, imageUrl, useDirectUrl]);
  
  const handleImageLoad = () => {
    setImageLoaded(true);
  };
  
  const handleImageError = () => {
    console.error('Image failed to load:', imageUrl);
    
    // If proxy failed, try direct URL
    if (!useDirectUrl) {
      console.log('Trying direct URL as fallback');
      setUseDirectUrl(true);
    } else {
      setImageError(true);
    }
  };
  
  // Create a fallback SVG with title
  const fallbackImage = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300' viewBox='0 0 300 300'%3E%3Crect width='300' height='300' fill='%23f0f0f0'/%3E%3Ctext x='50%25' y='50%25' font-family='Arial' font-size='16' text-anchor='middle' dominant-baseline='middle' fill='%23999'%3E${encodeURIComponent(title || 'NFT')}%3C/text%3E%3C/svg%3E`;
  
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
                src={imageUrl || fallbackImage}
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

// Function to get cached image URL directly from Alchemy CDN
function getCachedImageUrl(nft) {
  // Check for Alchemy's media format first (most reliable)
  if (nft.media && nft.media.length > 0 && nft.media[0]) {
    const media = nft.media[0];
    
    // String URL properties
    if (typeof media.gateway === 'string') return media.gateway;
    if (typeof media.thumbnail === 'string') return media.thumbnail;
    
    // Object properties that might contain URLs
    if (media.gateway && typeof media.gateway.cachedUrl === 'string') return media.gateway.cachedUrl;
    if (media.raw && typeof media.raw === 'string') {
      if (media.raw.startsWith('ipfs://')) {
        return media.raw.replace('ipfs://', 'https://ipfs.io/ipfs/');
      }
      return media.raw;
    }
  }
  
  return null;
}

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
    
    // Log the first NFT to see its structure
    if (unique.length > 0) {
      console.log('NFT structure sample:', JSON.stringify(unique[0]));
    }
    
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
  
  // Try to extract from metadata directly
  if (nft.rawMetadata && nft.rawMetadata.image) {
    const rawImage = nft.rawMetadata.image;
    if (typeof rawImage === 'string') {
      if (rawImage.startsWith('ipfs://')) {
        return rawImage.replace('ipfs://', 'https://ipfs.io/ipfs/');
      }
      return rawImage;
    }
  }
  
  // Try standard fields first
  if (typeof nft.image === 'string') return nft.image;
  if (typeof nft.image_url === 'string') return nft.image_url;
  if (typeof nft.imageUrl === 'string') return nft.imageUrl;
  if (typeof nft.image_preview_url === 'string') return nft.image_preview_url;
  
  // Try direct metadata image if it exists
  if (nft.metadata && typeof nft.metadata.image === 'string') {
    const metadataImage = nft.metadata.image;
    if (metadataImage.startsWith('ipfs://')) {
      return metadataImage.replace('ipfs://', 'https://ipfs.io/ipfs/');
    }
    return metadataImage;
  }
  
  // Last resort: try to generate an OpenSea URL if we have contract and token ID
  const contractAddress = getContractAddress(nft);
  const tokenId = nft.tokenId || nft.id?.tokenId || nft.token_id;
  
  if (contractAddress && tokenId) {
    return `https://api.opensea.io/api/v1/asset/${contractAddress}/${tokenId}/image`;
  }
  
  return ''; // No valid image URL found
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