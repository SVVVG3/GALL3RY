import React, { useState, useEffect } from 'react';
import './NFTImage.css';
import Spinner from './Spinner';

/**
 * NFTImage component that displays an NFT image or video with improved 
 * error handling and IPFS gateway fallbacks.
 */
const NFTImage = ({ src, alt = 'NFT Image', className = '' }) => {
  const [mediaSrc, setMediaSrc] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isVideo, setIsVideo] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);

  useEffect(() => {
    if (!src) {
      console.warn('NFTImage received empty source');
      setLoading(false);
      setError(true);
      return;
    }

    // Reset states for new src
    setLoading(true);
    setError(false);
    setAttemptCount(0);
    
    // Process the URL with different gateways based on attempt count
    processImageUrl(src, 0);
  }, [src]);

  // Process image URL with different fallback strategies
  const processImageUrl = (originalSrc, attempt) => {
    // Log the attempt for debugging
    console.log(`Processing image URL (attempt ${attempt}):`, originalSrc);
    
    let processedSrc = originalSrc;
    
    // Different strategies based on attempt number
    if (attempt === 0) {
      // First attempt: use the original URL with IPFS/AR handling
      if (originalSrc.startsWith('ipfs://')) {
        processedSrc = originalSrc.replace('ipfs://', 'https://ipfs.io/ipfs/');
      } else if (originalSrc.startsWith('ar://')) {
        processedSrc = originalSrc.replace('ar://', 'https://arweave.net/');
      }
    } else if (attempt === 1) {
      // Second attempt: try with Infura IPFS gateway
      if (originalSrc.startsWith('ipfs://')) {
        processedSrc = originalSrc.replace('ipfs://', 'https://ipfs.infura.io/ipfs/');
      } else if (originalSrc.includes('ipfs.io')) {
        processedSrc = originalSrc.replace('ipfs.io', 'ipfs.infura.io');
      } else {
        // Try CORS proxy for non-IPFS URLs
        processedSrc = `https://corsproxy.io/?${encodeURIComponent(originalSrc)}`;
      }
    } else if (attempt === 2) {
      // Third attempt: try another IPFS gateway
      if (originalSrc.startsWith('ipfs://') || originalSrc.includes('ipfs')) {
        const cid = originalSrc.includes('ipfs://') 
          ? originalSrc.replace('ipfs://', '') 
          : originalSrc.split('ipfs/')[1];
        
        if (cid) {
          processedSrc = `https://cloudflare-ipfs.com/ipfs/${cid}`;
        }
      } else {
        // Last resort for non-IPFS: try direct with img-src-fallback
        processedSrc = originalSrc;
      }
    } else {
      // Give up after 3 attempts
      console.error(`Failed to load image after ${attempt} attempts:`, originalSrc);
      setError(true);
      setLoading(false);
      return;
    }

    // Check if the media is a video based on extension or content type
    const isVideoFile = /\.(mp4|webm|ogg|mov)(\?|$)/i.test(processedSrc);
    setIsVideo(isVideoFile);
    
    // Update the media source
    setMediaSrc(processedSrc);
    setAttemptCount(attempt);
  };

  const handleMediaLoad = () => {
    console.log(`Media loaded successfully: ${mediaSrc}`);
    setLoading(false);
  };

  const handleMediaError = () => {
    console.warn(`Error loading media (attempt ${attemptCount}): ${mediaSrc}`);
    
    // Try next fallback strategy if we haven't exhausted them
    if (attemptCount < 3) {
      processImageUrl(src, attemptCount + 1);
    } else {
      // Give up after 3 attempts
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
          loading="lazy"
          crossOrigin="anonymous"
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
          crossOrigin="anonymous"
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