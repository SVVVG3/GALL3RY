import React, { useState, useEffect } from 'react';
import './NFTImage.css';
import Spinner from './Spinner';

/**
 * NFTImage component that displays an NFT image with basic loading and error handling
 */
const NFTImage = ({ src, alt = 'NFT Image', className = '' }) => {
  const [imgSrc, setImgSrc] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!src) {
      setLoading(false);
      setError(true);
      return;
    }

    // Process IPFS and other special URLs
    let processedSrc = src;
    
    if (src.startsWith('ipfs://')) {
      processedSrc = src.replace('ipfs://', 'https://ipfs.io/ipfs/');
    } else if (src.startsWith('ar://')) {
      processedSrc = src.replace('ar://', 'https://arweave.net/');
    }
    
    setImgSrc(processedSrc);
    setLoading(true);
    setError(false);
  }, [src]);

  const handleImageLoad = () => {
    setLoading(false);
  };

  const handleImageError = () => {
    // Try with CORS proxy if not already
    if (!imgSrc.includes('corsproxy.io') && !error) {
      setImgSrc(`https://corsproxy.io/?${encodeURIComponent(src)}`);
    } else {
      setError(true);
      setLoading(false);
    }
  };

  return (
    <div className={`nft-image-container ${className}`}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Spinner size="md" />
        </div>
      )}
      
      {!error && (
        <img
          src={imgSrc}
          alt={alt}
          className="nft-image"
          onLoad={handleImageLoad}
          onError={handleImageError}
          style={{ display: loading ? 'none' : 'block' }}
        />
      )}
      
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <img 
            src="/placeholder.png"
            alt="NFT Placeholder"
            className="w-12 h-12 opacity-50"
          />
        </div>
      )}
    </div>
  );
};

export default NFTImage; 