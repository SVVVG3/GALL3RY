import React, { useState, useCallback, useEffect, useMemo } from 'react';
import '../styles/NFTGrid.css';

// NFT Card Component
const NFTCard = React.memo(({ nft }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [useDirectUrl, setUseDirectUrl] = useState(true); // Start with direct URLs instead of proxy
  
  // Extract NFT data
  const title = getNftTitle(nft);
  const collection = getCollectionName(nft);
  const floorPrice = getFloorPrice(nft);
  
  const contractAddress = getContractAddress(nft);
  const tokenId = nft.tokenId || nft.id?.tokenId || nft.token_id;
  const openseaUrl = `https://opensea.io/assets/ethereum/${contractAddress}/${tokenId}`;
  
  // Extract image URL from NFT data - OpenSea URLs and IPFS URLs will be correctly handled
  const rawImageUrl = getImageUrl(nft);
  
  // For debugging - log the actual image URL being used
  useEffect(() => {
    console.log(`NFT (${title}) image source:`, rawImageUrl);
    if (nft.metadata) console.log('NFT metadata:', nft.metadata);
    if (nft.rawMetadata) console.log('NFT rawMetadata:', nft.rawMetadata);
  }, [nft, title, rawImageUrl]);
  
  // Use direct URL - proxy is causing issues
  const imageUrl = rawImageUrl;
  
  const handleImageLoad = () => {
    setImageLoaded(true);
  };
  
  const handleImageError = () => {
    console.error('Image failed to load:', imageUrl);
    setImageError(true);
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
                referrerPolicy="no-referrer"
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
  
  // OpenSea Asset URL Generation (for images that are only on OpenSea)
  // This is often the most reliable source
  const contractAddress = getContractAddress(nft);
  const tokenId = nft.tokenId || nft.id?.tokenId || nft.token_id;
  
  if (contractAddress && tokenId) {
    // Use this URL format for OpenSea assets
    return `https://assets.coingecko.com/nft_images/ethereum/${contractAddress}/${tokenId}.png`;
  }
  
  // Extract URLs from various metadata formats
  // Check for raw URLs in top-level properties first - most reliable
  if (typeof nft.image === 'string' && nft.image) return cleanUrl(nft.image);
  if (typeof nft.image_url === 'string' && nft.image_url) return cleanUrl(nft.image_url);
  if (typeof nft.imageUrl === 'string' && nft.imageUrl) return cleanUrl(nft.imageUrl);
  
  // Check rawMetadata (used in some Alchemy responses)
  if (nft.rawMetadata && typeof nft.rawMetadata.image === 'string' && nft.rawMetadata.image) {
    return cleanUrl(nft.rawMetadata.image);
  }
  
  // Check standard metadata format
  if (nft.metadata && typeof nft.metadata.image === 'string' && nft.metadata.image) {
    return cleanUrl(nft.metadata.image);
  }
  
  // Try to get image from media
  if (nft.media && nft.media.length > 0) {
    const media = nft.media[0];
    if (typeof media.gateway === 'string' && media.gateway) return media.gateway;
    if (typeof media.raw === 'string' && media.raw) return cleanUrl(media.raw);
    if (media.gateway && typeof media.gateway.cachedUrl === 'string') return media.gateway.cachedUrl;
  }
  
  // Fall back to an image placeholder
  return '';
};

// Helper to clean URLs (convert IPFS, etc)
function cleanUrl(url) {
  if (!url) return '';
  
  // Convert IPFS URLs to HTTP URLs
  if (url.startsWith('ipfs://')) {
    return url.replace('ipfs://', 'https://cloudflare-ipfs.com/ipfs/');
  }
  
  return url;
}

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