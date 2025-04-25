import React, { useState } from 'react';
import NFTImage from './NFTImage';
import '../styles/nft-unified.css';

/**
 * Optimized NFT image component specifically for Next.js and Vercel deployments
 * Uses a more reliable approach for loading images through an image proxy
 */
const NextNFTImage = ({ nft, alt, className, style, onClick, onLoad, handleMediaError, noHoverEffect = false, prioritized = false }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Find the best URL from the NFT metadata
  const findBestImageUrl = (nft) => {
    if (!nft) return null;
    
    // Try standard image sources
    if (nft.image) {
      return typeof nft.image === 'string' ? nft.image : nft.image.url || nft.image.gateway || nft.image.cachedUrl;
    }
    
    // Try Alchemy media format
    if (nft.media && Array.isArray(nft.media) && nft.media.length > 0) {
      return nft.media[0].gateway || nft.media[0].raw;
    }
    
    // Try other common properties
    return nft.image_url || nft.metadata?.image || nft.tokenUri;
  };

  const imageUrl = findBestImageUrl(nft);
  
  const handleLoadingComplete = () => {
    setIsLoading(false);
    if (onLoad) onLoad();
  };

  const handleImageError = () => {
    setHasError(true);
    setIsLoading(false);
    if (handleMediaError) handleMediaError();
  };

  return (
    <NFTImage
      nft={nft}
      src={imageUrl}
      alt={alt || nft?.name || nft?.title || 'NFT'}
      className={className}
      style={style}
      onClick={onClick}
      onLoad={handleLoadingComplete}
      handleMediaError={handleImageError}
      noHoverEffect={noHoverEffect}
      prioritized={prioritized}
    />
  );
};

export default NextNFTImage; 