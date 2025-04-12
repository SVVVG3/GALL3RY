import React, { useState, useEffect } from 'react';
import './NFTImage.css';
import Spinner from './Spinner';

/**
 * NFTImage component that displays an NFT image or video with basic loading and error handling.
 * Designed to work within a parent container that handles the aspect ratio.
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

  // If loading, show spinner
  if (loading) {
    return (
      <div className="nft-media-loader">
        <Spinner size="md" />
      </div>
    );
  }

  // If error, show placeholder
  if (error) {
    return (
      <div className="nft-media-error">
        <img 
          src="/placeholder.png"
          alt="NFT Placeholder"
          className="placeholder-image"
        />
      </div>
    );
  }

  // If video, render video element
  if (isVideo) {
    return (
      <video
        src={mediaSrc}
        className={`nft-media ${className}`}
        onLoadedData={handleMediaLoad}
        onError={handleMediaError}
        autoPlay
        loop
        muted
        playsInline
        controlsList="nodownload"
      />
    );
  }

  // Otherwise render image
  return (
    <img
      src={mediaSrc}
      alt={alt}
      className={`nft-media ${className}`}
      onLoad={handleMediaLoad}
      onError={handleMediaError}
    />
  );
};

export default NFTImage; 