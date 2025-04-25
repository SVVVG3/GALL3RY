import React, { useState } from 'react';
import '../styles/nft-unified.css';

/**
 * Vercel-optimized NFT image component
 * Uses direct <img> tag rather than Next Image for better compatibility
 * with the image proxy
 */
const NextNFTImage = ({ src, alt = 'NFT', className = '' }) => {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  // Use proxy for all external images
  const processUrl = (url) => {
    if (!url) return `${window.location.origin}/assets/placeholder-nft.svg`;
    
    // If already proxied or local asset, use as is
    if (url.startsWith('/api/image-proxy') || url.startsWith('/assets/')) return url;
    
    // Otherwise, proxy the image
    return `/api/image-proxy?url=${encodeURIComponent(url)}`;
  };
  
  const imageUrl = processUrl(src);
  
  return (
    <div className="next-nft-image-container">
      {!loaded && !error && (
        <div className="next-nft-loading">
          <div className="loading-spinner"></div>
        </div>
      )}
      
      <img
        src={imageUrl}
        alt={alt}
        className={`next-nft-image ${loaded ? 'loaded' : ''} ${error ? 'error' : ''}`}
        onLoad={() => setLoaded(true)}
        onError={() => {
          setError(true);
          setLoaded(true);
        }}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          visibility: 'visible',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 0.3s ease'
        }}
      />
      
      {error && (
        <div className="next-nft-error">
          <img 
            src={`${window.location.origin}/assets/placeholder-nft.svg`}
            alt={`${alt} (unavailable)`}
            className="next-nft-placeholder"
          />
        </div>
      )}
    </div>
  );
};

export default NextNFTImage; 