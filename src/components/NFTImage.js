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
    console.log(`Media loaded: ${mediaSrc}`);
    setLoading(false);
  };

  const handleMediaError = () => {
    console.error(`Error loading media: ${mediaSrc}`);
    // Try with CORS proxy if not already
    if (!mediaSrc.includes('corsproxy.io') && !error) {
      setMediaSrc(`https://corsproxy.io/?${encodeURIComponent(src)}`);
    } else {
      setError(true);
      setLoading(false);
    }
  };

  return (
    <div className="nft-media-container">
      {/* Always render the media elements (hidden while loading) so they can trigger onLoad */}
      {!error && !isVideo && (
        <img
          src={mediaSrc}
          alt={alt}
          className={`nft-media ${className}`}
          onLoad={handleMediaLoad}
          onError={handleMediaError}
          style={{ visibility: loading ? 'hidden' : 'visible' }}
        />
      )}

      {!error && isVideo && (
        <video
          src={mediaSrc}
          className={`nft-media ${className}`}
          onLoadedData={handleMediaLoad}
          onError={handleMediaError}
          style={{ visibility: loading ? 'hidden' : 'visible' }}
          autoPlay
          loop
          muted
          playsInline
          controlsList="nodownload"
        />
      )}

      {/* Show loading spinner while loading */}
      {loading && (
        <div className="nft-media-loader">
          <Spinner size="md" />
        </div>
      )}

      {/* Show placeholder if error */}
      {error && (
        <div className="nft-media-error">
          <img 
            src="/placeholder.png"
            alt="NFT Placeholder"
            className="placeholder-image"
          />
        </div>
      )}
    </div>
  );
};

export default NFTImage; 