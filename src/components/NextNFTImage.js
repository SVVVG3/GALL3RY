import React, { useState, useMemo } from 'react';
import '../styles/nft-unified.css';
import NFTImage from './NFTImage';

/**
 * Vercel-optimized NFT image component.
 * Uses a direct <img> tag for better compatibility with image proxy.
 */
const NextNFTImage = ({ nft, className, style, alt, prioritized = false, onClick }) => {
  const [errorCount, setErrorCount] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  // Find the best image URL from the NFT
  const findBestImageUrl = (nft) => {
    if (!nft) return '';
    
    // Prioritized order to check for image URLs
    const imageSources = [
      // Alchemy gateway URLs are prioritized
      nft.media?.[0]?.gateway,
      nft.media?.[0]?.raw,
      nft.metadata?.image,
      nft.metadata?.image_url,
      nft.image,
      nft.image_url,
      // Fallback to any other images we find
      nft.media?.[0]?.thumbnail,
      nft.thumbnail,
      // Raw URI as last resort
      nft.token_uri
    ];
    
    // Return the first valid URL
    return imageSources.find(url => url && typeof url === 'string' && url.trim() !== '') || '';
  };

  // Get the best image URL
  const imageUrl = useMemo(() => findBestImageUrl(nft), [nft]);
  
  const handleMediaError = () => {
    setErrorCount(prev => prev + 1);
    console.error(`NextNFTImage media error for NFT: ${nft?.name || 'Unknown'}`);
  };

  const handleLoad = () => {
    setIsLoaded(true);
  };

  return (
    <NFTImage
      nft={nft}
      src={imageUrl}
      alt={alt || nft?.name || nft?.title || 'NFT'}
      className={className}
      style={style}
      prioritized={prioritized}
      onClick={onClick}
      onLoad={handleLoad}
      handleMediaError={handleMediaError}
    />
  );
};

export default NextNFTImage; 