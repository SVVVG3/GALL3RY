import React, { useState, useCallback, useEffect, useMemo } from 'react';
import '../styles/NFTGrid.css';

/**
 * Get a safe image URL from the NFT data
 * @param {Object} nft - The NFT data object
 * @returns {string} - A valid image URL or empty string if none found
 */
const getImageUrl = (nft) => {
  if (!nft) return '';
  
  let imageUrl = '';
  
  // Debug the NFT structure to see what we're working with
  console.log('Processing NFT for image:', {
    id: nft.id,
    name: nft.name,
    image: nft.image,
    media: nft.media,
    tokenId: nft.tokenId || nft.token_id,
    network: nft.network
  });
  
  // First, check if the NFT has an image object (from NFTContext processing)
  if (nft.image && typeof nft.image === 'object') {
    imageUrl = nft.image.url || nft.image.gateway || nft.image.originalUrl || 
               nft.image.thumbnailUrl || '';
    console.log('Found image object:', imageUrl);
  }
  
  // Check for media array (Alchemy format)
  if (!imageUrl && nft.media && Array.isArray(nft.media) && nft.media.length > 0) {
    const mediaItem = nft.media.find(m => m.gateway) || nft.media[0];
    imageUrl = mediaItem.gateway || mediaItem.raw || mediaItem.uri || '';
    console.log('Found media array item:', imageUrl);
  }
  
  // Try rawMetadata (Alchemy format)
  if (!imageUrl && nft.rawMetadata) {
    imageUrl = nft.rawMetadata.image || 
               nft.rawMetadata.image_url || 
               nft.rawMetadata.image_uri || 
               nft.rawMetadata.animation_url ||
               nft.rawMetadata.image_data || 
               '';
    if (imageUrl) console.log('Found image in rawMetadata:', imageUrl);
  }
  
  // Try metadata (OpenSea format)
  if (!imageUrl && nft.metadata) {
    try {
      // If metadata is a string, try to parse it as JSON
      const metadata = typeof nft.metadata === 'string' 
        ? JSON.parse(nft.metadata) 
        : nft.metadata;
        
      imageUrl = metadata?.image || 
                 metadata?.image_url || 
                 metadata?.animation_url ||
                 metadata?.image_uri || 
                 metadata?.image_data || 
                 '';
      if (imageUrl) console.log('Found image in metadata:', imageUrl);
    } catch (e) {
      console.error('Error parsing NFT metadata', e);
    }
  }
  
  // Try direct properties (OpenSea format)
  if (!imageUrl) {
    imageUrl = nft.image_url || 
               nft.image || 
               nft.image_preview_url || 
               nft.thumbnail || 
               '';
    if (imageUrl) console.log('Found image in direct properties:', imageUrl);
  }
  
  // Special handling for cachedUrl, thumbnailUrl, pngUrl from Alchemy
  if (!imageUrl && (nft.cachedUrl || nft.thumbnailUrl || nft.pngUrl)) {
    imageUrl = nft.cachedUrl || nft.thumbnailUrl || nft.pngUrl || '';
    console.log('Found Alchemy URL:', imageUrl);
  }
  
  // Handle special cases from the console log
  if (!imageUrl && nft.id && typeof nft.id === 'string') {
    const idParts = nft.id.split(':');
    
    if (idParts.length > 1) {
      const network = idParts[0];
      const tokenData = idParts[1];
      
      // Based on console output, we need specific handlers for certain networks
      if (network === 'base') {
        // For Base NFTs, try the fallback mock image
        imageUrl = `https://placehold.co/600x400/222/fff?text=${encodeURIComponent(nft.name || 'Base NFT')}`;
      } else if (network === 'polygon') {
        // For Polygon NFTs, try the fallback mock image 
        imageUrl = `https://placehold.co/600x400/624/fff?text=${encodeURIComponent(nft.name || 'Polygon NFT')}`;
      }
    }
  }
  
  // Fallback for SHIB NFTs seen in the console
  if (!imageUrl && nft.name && nft.name.includes('SHIB NFT')) {
    imageUrl = `https://placehold.co/600x400/db6/222?text=${encodeURIComponent(nft.name)}`;
  }
  
  // Check if imageUrl is an object (like in the error logs), and extract the URL from it
  if (imageUrl && typeof imageUrl === 'object') {
    console.log('Image URL is an object, extracting string URL:', imageUrl);
    // Try multiple possible properties where the URL might be
    imageUrl = imageUrl.url || imageUrl.gateway || imageUrl.originalUrl || 
              imageUrl.thumbnailUrl || imageUrl.pngUrl || imageUrl.cachedUrl || '';
  }
  
  // Ensure imageUrl is a string
  if (typeof imageUrl !== 'string') {
    console.warn('Invalid imageUrl type:', typeof imageUrl, imageUrl);
    return '';
  }
  
  // Handle IPFS URLs
  if (imageUrl && imageUrl.startsWith('ipfs://')) {
    imageUrl = imageUrl.replace('ipfs://', 'https://ipfs.io/ipfs/');
    console.log('Converted IPFS URL:', imageUrl);
  }
  
  // Handle Arweave URLs
  if (imageUrl && imageUrl.startsWith('ar://')) {
    imageUrl = imageUrl.replace('ar://', 'https://arweave.net/');
    console.log('Converted Arweave URL:', imageUrl);
  }
  
  // Use a fallback placeholder if no image found
  if (!imageUrl) {
    imageUrl = 'https://placehold.co/600x400/ddd/333?text=No+Image';
    console.log('Using fallback placeholder - no image URL found');
  }
  
  return imageUrl;
};

/**
 * NFT Card Component
 * Displays an individual NFT with image and metadata
 */
const NFTCard = React.memo(({ nft, style }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  
  const imageUrl = getImageUrl(nft);
  const title = getNftTitle(nft);
  const collection = getCollectionName(nft);
  const floorPrice = getFloorPrice(nft);
  const contractAddress = getContractAddress(nft);
  const tokenId = getTokenId(nft);
  
  // Create OpenSea URL based on network
  let openSeaUrl = `https://opensea.io/assets/ethereum/${contractAddress}/${tokenId}`;
  
  // Adjust OpenSea URL based on network
  if (nft.network === 'polygon' || (nft.id && nft.id.startsWith('polygon:'))) {
    openSeaUrl = `https://opensea.io/assets/matic/${contractAddress}/${tokenId}`;
  } else if (nft.network === 'base' || (nft.id && nft.id.startsWith('base:'))) {
    openSeaUrl = `https://opensea.io/assets/base/${contractAddress}/${tokenId}`;
  }
  
  // Reset state when NFT changes
  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
    setRetryCount(0);
  }, [nft.id, nft.tokenId]);
  
  // Debug NFT image loading issues
  useEffect(() => {
    console.log(`NFT ${title} (${tokenId}) image status:`, { 
      imageUrl, 
      imageLoaded, 
      imageError,
      retryCount
    });
  }, [imageLoaded, imageError, title, tokenId, imageUrl, retryCount]);
  
  // Handle image loading events
  const handleImageLoad = () => {
    console.log(`Image loaded successfully: ${title}`);
    setImageLoaded(true);
    setImageError(false);
  };
  
  const handleImageError = () => {
    console.error(`Image failed to load: ${title}, URL: ${imageUrl}`);
    
    // Try a proxy URL if we haven't exceeded retry count
    if (retryCount === 0 && imageUrl && !imageUrl.includes('placehold.co')) {
      setRetryCount(1);
      // We'll handle this in the render function
    } else {
      // Give up after retry
      setImageError(true);
    }
  };
  
  // Determine which URL to use based on retry state
  const displayUrl = retryCount === 1 && !imageUrl.includes('placehold.co')
    ? `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`
    : imageUrl;
  
  return (
    <div className="nft-item-wrapper-fallback" style={style}>
      <div className="nft-item">
        <a 
          href={openSeaUrl} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="nft-link"
        >
          <div className="nft-image-container">
            {!imageLoaded && !imageError && (
              <div className="nft-image-placeholder">
                <span>Loading...</span>
              </div>
            )}
            
            {imageError ? (
              <div className="nft-image-error">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="3" y="3" width="18" height="18" rx="2" stroke="#999999" strokeWidth="2" />
                  <path d="M12 8v4m0 4h.01" stroke="#999999" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <p className="error-text">Unable to load image</p>
              </div>
            ) : (
              <img
                src={displayUrl}
                alt={title || 'NFT'}
                className={`nft-image ${imageLoaded ? 'loaded' : ''}`}
                onLoad={handleImageLoad}
                onError={handleImageError}
                crossOrigin="anonymous"
                referrerPolicy="no-referrer"
              />
            )}
          </div>
          
          <div className="nft-info">
            <h3 className="nft-title">{title || 'Untitled NFT'}</h3>
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
const SimpleNFTGrid = ({ nfts = [], isLoading = false }) => {
  if (isLoading && (!nfts || nfts.length === 0)) {
    return (
      <div className="nft-grid-loader">
        <div className="loader"></div>
        <p>Loading NFTs...</p>
      </div>
    );
  }

  if (!nfts || nfts.length === 0) {
    return (
      <div className="nft-grid-empty">
        <p className="nft-grid-no-results">No NFTs found</p>
      </div>
    );
  }

  return (
    <div className="nft-grid-container">
      <div className="fallback-grid">
        {nfts.map((nft, index) => (
          <NFTCard 
            key={getNftKey(nft) || index} 
            nft={nft} 
          />
        ))}
      </div>
    </div>
  );
};

// Utility functions to handle NFT data
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
  
  const contract = getContractAddress(nft);
  const tokenId = getTokenId(nft);
  return `${contract}-${tokenId}`;
};

export default SimpleNFTGrid; 