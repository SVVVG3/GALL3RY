import React, { useState, useCallback } from 'react';
import '../styles/NFTGrid.css';

/**
 * Simple NFT Grid component designed to work directly with Alchemy API data structure
 * Based on the NFT structure from https://docs.alchemy.com/reference/nfts-by-owner-v3
 */
const SimpleNFTGrid = ({ nfts = [] }) => {
  // Track image loading state
  const [loadedImages, setLoadedImages] = useState({});
  const [failedImages, setFailedImages] = useState({});
  
  // Handle successful image load
  const handleImageSuccess = useCallback((nftId) => {
    setLoadedImages(prev => ({
      ...prev,
      [nftId]: true
    }));
  }, []);
  
  // Handle image load error
  const handleImageError = useCallback((e, nft) => {
    const img = e.target;
    const nftId = getNftKey(nft);
    
    // Skip if already showing a placeholder
    if (img.src.includes('/assets/placeholder-nft.svg')) {
      return;
    }
    
    console.log(`Image failed to load for NFT ${nftId}: ${img.src}`);
    
    setFailedImages(prev => ({
      ...prev,
      [nftId]: true
    }));
    
    // Try image proxy if not already using it
    if (!img.src.includes('/api/image-proxy') && !img.src.includes('/assets/placeholder-nft.svg')) {
      console.log(`Trying image proxy for NFT ${nftId}`);
      img.src = `/api/image-proxy?url=${encodeURIComponent(getImageUrl(nft))}`;
      return;
    }
    
    // Instead of loading a placeholder image, create a colored div
    const placeholderDiv = document.createElement('div');
    placeholderDiv.style.width = '100%';
    placeholderDiv.style.height = '100%';
    placeholderDiv.style.backgroundColor = '#f0f0f0';
    placeholderDiv.style.display = 'flex';
    placeholderDiv.style.alignItems = 'center';
    placeholderDiv.style.justifyContent = 'center';
    
    // Add text to the div
    const textNode = document.createElement('span');
    textNode.textContent = 'Image unavailable';
    textNode.style.color = '#888';
    textNode.style.fontStyle = 'italic';
    placeholderDiv.appendChild(textNode);
    
    // Replace the image with our div
    img.parentNode.replaceChild(placeholderDiv, img);
  }, []);
  
  // Get the best available image URL from Alchemy NFT data
  const getImageUrl = (nft) => {
    if (!nft) return null;
    
    // Enhanced debugging to see exactly what we're getting
    console.log(`NFT image data for ${nft.name || nft.tokenId}:`, {
      fullImageObj: nft.image,
      media: nft.media,
      raw: nft.raw && nft.raw.metadata ? nft.raw.metadata.image : 'No raw metadata'
    });
    
    // Try all possible image paths in Alchemy's v3 API response
    let imageUrl = null;
    
    // Handle Alchemy's new format with .image field
    if (nft.image) {
      if (typeof nft.image === 'object') {
        // Try all possible image URLs in the image object
        imageUrl = nft.image.cachedUrl || 
                  nft.image.thumbnailUrl || 
                  nft.image.pngUrl || 
                  nft.image.originalUrl || 
                  (nft.image.gateway ? nft.image.gateway : null) ||
                  (nft.image.url && typeof nft.image.url === 'string' ? nft.image.url : null);
                  
        console.log(`Found image URL in image object: ${imageUrl}`);
      } else if (typeof nft.image === 'string') {
        imageUrl = nft.image;
        console.log(`Found string image URL: ${imageUrl}`);
      }
    }
    
    // Try media array
    if (!imageUrl && nft.media && Array.isArray(nft.media) && nft.media.length > 0) {
      const media = nft.media[0];
      if (media) {
        imageUrl = media.gateway || media.thumbnailUrl || media.raw || media.uri;
        
        // If we found media, log it for debugging
        if (imageUrl) {
          console.log(`Found image in media array: ${imageUrl}`);
        }
      }
    }
    
    // Try raw metadata
    if (!imageUrl && nft.raw && nft.raw.metadata && nft.raw.metadata.image) {
      imageUrl = nft.raw.metadata.image;
      console.log(`Found image in raw.metadata: ${imageUrl}`);
    }
    
    // Try metadata.image if available
    if (!imageUrl && nft.metadata && nft.metadata.image) {
      imageUrl = nft.metadata.image;
      console.log(`Found image in metadata: ${imageUrl}`);
    }
    
    // Try image_url variants
    if (!imageUrl) {
      if (nft.raw && nft.raw.metadata && nft.raw.metadata.image_url) {
        imageUrl = nft.raw.metadata.image_url;
        console.log(`Found image in raw.metadata.image_url: ${imageUrl}`);
      } else if (nft.metadata && nft.metadata.image_url) {
        imageUrl = nft.metadata.image_url;
        console.log(`Found image in metadata.image_url: ${imageUrl}`);
      }
    }
    
    // If IPFS, use reliable gateway
    if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('ipfs://')) {
      const newUrl = imageUrl.replace('ipfs://', 'https://cloudflare-ipfs.com/ipfs/');
      console.log(`Converted IPFS URL: ${imageUrl} -> ${newUrl}`);
      imageUrl = newUrl;
    }
    
    // If we found an image URL, log it
    if (imageUrl) {
      console.log(`Final image URL for ${nft.name || nft.tokenId}: ${imageUrl}`);
    } else {
      console.warn(`No image URL found for NFT ${nft.name || nft.tokenId}`);
    }
    
    return imageUrl;
  };
  
  // Render image or placeholder
  const renderNftImage = (nft) => {
    if (!nft) return renderPlaceholder('Invalid NFT data');
    
    // Generate a consistent ID for the NFT
    const nftId = getNftKey(nft);
    const imageUrl = getImageUrl(nft);
    
    if (!imageUrl) {
      return renderPlaceholder('No image available');
    }
    
    // Modify the URL to use the proxy for all external URLs
    // This helps prevent CORS issues with Alchemy's CDN
    let finalImageUrl = imageUrl;
    
    // Only add proxy for external URLs (not for local assets)
    if (imageUrl && !imageUrl.startsWith('/') && !imageUrl.startsWith('data:')) {
      // Always use the image proxy for external URLs to avoid CORS issues
      finalImageUrl = `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
      console.log(`Using proxy for image: ${imageUrl.substring(0, 50)}...`);
    }
    
    return (
      <img
        src={finalImageUrl}
        alt={getNftTitle(nft)}
        onLoad={() => handleImageSuccess(nftId)}
        onError={(e) => handleImageError(e, nft)}
        loading="lazy"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          objectPosition: 'center',
          backgroundColor: '#f0f0f0'
        }}
        referrerPolicy="no-referrer"
        crossOrigin="anonymous"
      />
    );
  };
  
  // Render placeholder for missing images
  const renderPlaceholder = (message = 'No image') => {
    return (
      <div 
        className="nft-placeholder"
        style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <span style={{ color: '#888', fontStyle: 'italic' }}>{message}</span>
      </div>
    );
  };
  
  // Get NFT title
  const getNftTitle = (nft) => {
    if (!nft) return 'Unknown NFT';
    
    return nft.name || nft.title || `#${nft.tokenId || '0'}`;
  };
  
  // Get collection name
  const getCollectionName = (nft) => {
    if (!nft) return 'Unknown Collection';
    
    if (nft.collection && nft.collection.name) {
      return nft.collection.name;
    }
    
    if (nft.contract) {
      // Prefer contract name if available
      if (nft.contract.name) {
        return nft.contract.name;
      }
      
      // OpenSea metadata often has richer information
      if (nft.contract.openSeaMetadata && nft.contract.openSeaMetadata.collectionName) {
        return nft.contract.openSeaMetadata.collectionName;
      }
      
      // Fall back to contract address if available
      if (nft.contract.address) {
        return `${nft.contract.address.slice(0, 6)}...${nft.contract.address.slice(-4)}`;
      }
    }
    
    // Direct contractAddress property
    if (nft.contractAddress) {
      return `${nft.contractAddress.slice(0, 6)}...${nft.contractAddress.slice(-4)}`;
    }
    
    return 'Unknown Collection';
  };
  
  // Get floor price if available
  const getFloorPrice = (nft) => {
    if (!nft) return null;
    
    // Check OpenSea metadata first (most reliable)
    if (nft.contract && nft.contract.openSeaMetadata && nft.contract.openSeaMetadata.floorPrice) {
      return `${nft.contract.openSeaMetadata.floorPrice} ETH`;
    }
    
    // Check collection floor price
    if (nft.collection && nft.collection.floorPrice) {
      const price = nft.collection.floorPrice;
      if (price.valueUsd) {
        return `$${price.valueUsd.toFixed(2)}`;
      }
      if (price.value) {
        return `${price.value} ${price.currency || 'ETH'}`;
      }
    }
    
    return null;
  };
  
  // Generate a unique key for each NFT
  const getNftKey = (nft) => {
    if (!nft) return Math.random().toString(36).substring(7);
    
    if (nft.id) return nft.id;
    
    const contractAddress = nft.contractAddress || 
                           (nft.contract ? nft.contract.address : 'unknown');
    const tokenId = nft.tokenId || '0';
    
    return `${contractAddress}-${tokenId}`;
  };
  
  // Format NFT card jsx
  const renderNftCard = (nft) => {
    const nftKey = getNftKey(nft);
    const floorPrice = getFloorPrice(nft);
    
    return (
      <div key={nftKey} className="nft-item">
        <div className="nft-card">
          <div className="nft-image">
            {renderNftImage(nft)}
          </div>
          <div className="nft-info">
            <h3 className="nft-name">{getNftTitle(nft)}</h3>
            <p className="nft-collection">{getCollectionName(nft)}</p>
            {floorPrice && <p className="nft-price">Floor: {floorPrice}</p>}
            {nft.tokenType && <span className="nft-type">{nft.tokenType}</span>}
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <div className="nft-grid">
      {nfts.length > 0 ? (
        nfts.map(renderNftCard)
      ) : (
        <div className="no-nfts-message">
          <p>No NFTs found</p>
        </div>
      )}
    </div>
  );
};

export default SimpleNFTGrid; 