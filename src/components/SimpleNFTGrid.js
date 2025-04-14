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
    
    // If proxy fails, use placeholder
    img.onerror = null; // Prevent infinite loop
    img.src = '/assets/placeholder-nft.svg';
  }, []);
  
  // Get the best available image URL from Alchemy NFT data
  const getImageUrl = (nft) => {
    if (!nft) return '/assets/placeholder-nft.svg';
    
    // Check for image object from Alchemy v3 API
    if (nft.image) {
      if (typeof nft.image === 'object') {
        // Try different fields in order of preference
        return (
          nft.image.cachedUrl ||
          nft.image.thumbnailUrl ||
          nft.image.pngUrl ||
          nft.image.originalUrl ||
          nft.image.gateway ||
          '/assets/placeholder-nft.svg'
        );
      } else if (typeof nft.image === 'string') {
        return nft.image;
      }
    }
    
    // Check for media
    if (nft.media && nft.media.length > 0) {
      const media = nft.media[0];
      return (
        media.gateway ||
        media.cachedUrl ||
        media.thumbnailUrl ||
        media.raw ||
        '/assets/placeholder-nft.svg'
      );
    }
    
    // Fallback to contract metadata
    if (nft.contract && nft.contract.openSea && nft.contract.openSea.imageUrl) {
      return nft.contract.openSea.imageUrl;
    }
    
    // Default placeholder
    return '/assets/placeholder-nft.svg';
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
          const imageUrl = getImageUrl(nft);
          
          return (
            <div key={nftId} className="nft-item">
              <div className="nft-card">
                <div className="nft-image">
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