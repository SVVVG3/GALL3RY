import React, { useState, useEffect } from 'react';
import './NFTImage.css';
import Spinner from './Spinner';

/**
 * NFTImage component that displays an NFT image or video with basic loading and error handling
 */
const NFTImage = ({ src, alt = 'NFT Image', className = '' }) => {
  const [mediaSrc, setMediaSrc] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isVideo, setIsVideo] = useState(false);

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

    // Check if the media is a video based on extension
    const isVideoFile = /\.(mp4|webm|ogg|mov)(\?|$)/i.test(processedSrc);
    setIsVideo(isVideoFile);
    
    setMediaSrc(processedSrc);
    setLoading(true);
    setError(false);
  }, [src]);

  const handleMediaLoad = () => {
    setLoading(false);
  };

  const handleMediaError = () => {
    // Try with CORS proxy if not already
    if (!mediaSrc.includes('corsproxy.io') && !error) {
      setMediaSrc(`https://corsproxy.io/?${encodeURIComponent(src)}`);
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
      
      {!error && !isVideo && (
        <img
          src={mediaSrc}
          alt={alt}
          className="nft-image"
          onLoad={handleMediaLoad}
          onError={handleMediaError}
          style={{ display: loading ? 'none' : 'block' }}
        />
      )}

      {!error && isVideo && (
        <video
          src={mediaSrc}
          className="nft-image"
          onLoadedData={handleMediaLoad}
          onError={handleMediaError}
          style={{ display: loading ? 'none' : 'block' }}
          autoPlay
          loop
          muted
          playsInline
          controlsList="nodownload"
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