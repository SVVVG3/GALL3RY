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
    const nftId = nft.contract.address + '-' + nft.tokenId;
    
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
    
    // Log the entire NFT object once to see its structure
    console.log('NFT structure for debugging:', {
      id: nft.id,
      tokenId: nft.tokenId,
      hasImage: !!nft.image,
      imageType: nft.image ? typeof nft.image : 'none',
      mediaCount: nft.media ? nft.media.length : 0
    });
    
    // Try all possible image paths in Alchemy's v3 API response
    let imageUrl = null;
    
    // Handle Alchemy's new format with .image field
    if (nft.image) {
      if (typeof nft.image === 'object') {
        imageUrl = nft.image.thumbnailUrl || nft.image.cachedUrl || nft.image.pngUrl || 
                  nft.image.originalUrl || nft.image.gateway;
      } else if (typeof nft.image === 'string') {
        imageUrl = nft.image;
      }
    }
    
    // Try media array
    if (!imageUrl && nft.media && nft.media.length > 0) {
      const media = nft.media[0];
      imageUrl = media.gateway || media.thumbnailUrl || media.raw;
    }
    
    // Try raw metadata
    if (!imageUrl && nft.raw && nft.raw.metadata && nft.raw.metadata.image) {
      imageUrl = nft.raw.metadata.image;
    }
    
    // If IPFS, use reliable gateway
    if (imageUrl && imageUrl.startsWith('ipfs://')) {
      imageUrl = imageUrl.replace('ipfs://', 'https://cloudflare-ipfs.com/ipfs/');
    }
    
    return imageUrl;
  };
  
  // Render image or placeholder
  const renderNftImage = (nft) => {
    const nftId = nft.contract.address + '-' + nft.tokenId;
    const imageUrl = getImageUrl(nft);
    
    if (!imageUrl) {
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
          <span style={{ color: '#888', fontStyle: 'italic' }}>No image</span>
        </div>
      );
    }
    
    return (
      <img
        src={imageUrl}
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
  
  // Get NFT title
  const getNftTitle = (nft) => {
    if (!nft) return 'Unknown NFT';
    
    return nft.title || `#${nft.tokenId}`;
  };
  
  // Get collection name
  const getCollectionName = (nft) => {
    if (!nft || !nft.contract) return 'Unknown Collection';
    
    return (
      nft.contract.name || 
      (nft.contract.address ? 
        `${nft.contract.address.slice(0, 6)}...${nft.contract.address.slice(-4)}` : 
        'Unknown Collection')
    );
  };
  
  return (
    <div className="nft-grid">
      {nfts.length > 0 ? (
        nfts.map((nft) => {
          const nftId = nft.contract.address + '-' + nft.tokenId;
          
          return (
            <div key={nftId} className="nft-item">
              <div className="nft-card">
                <div className="nft-image">
                  {renderNftImage(nft)}
                </div>
                <div className="nft-info">
                  <h3 className="nft-name">{getNftTitle(nft)}</h3>
                  <p className="nft-collection">{getCollectionName(nft)}</p>
                </div>
              </div>
            </div>
          );
        })
      ) : (
        <div className="no-nfts-message">
          <p>No NFTs found</p>
        </div>
      )}
    </div>
  );
};

export default SimpleNFTGrid; 