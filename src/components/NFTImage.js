import React, { useState, useEffect } from 'react';
import './NFTImage.css';
import Spinner from './Spinner';

/**
 * NFTImage component that displays an NFT image or video with improved 
 * error handling and prioritization of Alchemy gateway URLs.
 */
const NFTImage = ({ src, rawSrc, alt = 'NFT Image', className = '', onLoad = () => {}, onError = () => {} }) => {
  const [mediaSrc, setMediaSrc] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isVideo, setIsVideo] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);

  useEffect(() => {
    if (!src && !rawSrc) {
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
    processImageUrl(src, rawSrc, 0);
  }, [src, rawSrc]);

  // Process image URL with different fallback strategies
  const processImageUrl = (originalSrc, rawSrc, attempt) => {
    // Log the attempt for debugging
    console.log(`Processing image URL (attempt ${attempt + 1}):`, originalSrc);
    
    let processedSrc = originalSrc;
    
    // Different strategies based on attempt number
    if (attempt === 0) {
      // First attempt: use the original URL if it's from Alchemy gateway
      // These URLs should already be optimized and cached
      if (originalSrc && (
          originalSrc.includes('nft-cdn.alchemy.com') || 
          originalSrc.includes('nft.alchemyapi.io')
      )) {
        processedSrc = originalSrc;
      } 
      // Otherwise handle IPFS/AR URLs
      else if (originalSrc && originalSrc.startsWith('ipfs://')) {
        processedSrc = originalSrc.replace('ipfs://', 'https://ipfs.io/ipfs/');
      } else if (originalSrc && originalSrc.startsWith('ar://')) {
        processedSrc = originalSrc.replace('ar://', 'https://arweave.net/');
      } else if (originalSrc) {
        // Use original source as-is if it's a regular URL
        processedSrc = originalSrc;
      }
    } else if (attempt === 1) {
      // Second attempt: try with raw source URL if available
      if (rawSrc) {
        // Process rawSrc for IPFS/AR
        if (rawSrc.startsWith('ipfs://')) {
          processedSrc = rawSrc.replace('ipfs://', 'https://ipfs.io/ipfs/');
        } else if (rawSrc.startsWith('ar://')) {
          processedSrc = rawSrc.replace('ar://', 'https://arweave.net/');
        } else {
          processedSrc = rawSrc;
        }
      } 
      // Try Infura IPFS gateway as fallback
      else if (originalSrc && originalSrc.startsWith('ipfs://')) {
        processedSrc = originalSrc.replace('ipfs://', 'https://ipfs.infura.io/ipfs/');
      } else if (originalSrc && originalSrc.includes('ipfs.io')) {
        processedSrc = originalSrc.replace('ipfs.io', 'ipfs.infura.io');
      } else if (originalSrc) {
        // Use original source
        processedSrc = originalSrc;
      }
    } else {
      // Final attempt - simple fallback to placeholder
      // We'll try one more direct URL first
      if (originalSrc && !originalSrc.startsWith('data:')) {
        processedSrc = originalSrc;
      } else {
        console.warn('Using placeholder for failed image load:', originalSrc);
        processedSrc = '/assets/placeholder-nft.svg';
      }
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
    onLoad();
  };

  const handleMediaError = () => {
    console.warn(`Error loading media (attempt ${attemptCount + 1}): ${mediaSrc}`);
    
    // Try next fallback strategy if we haven't exhausted them
    if (attemptCount < 2) {
      processImageUrl(src, rawSrc, attemptCount + 1);
    } else {
      // Give up after 3 attempts
      console.error(`Failed to load image after ${attemptCount + 1} attempts:`, src);
      setError(true);
      setLoading(false);
      onError();
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

      {/* Show placeholder on error - with inline fallback in case placeholder image also fails */}
      {error && (
        <div className="nft-media-error">
          <div className="placeholder-content">
            {alt || "NFT"}
          </div>
        </div>
      )}
    </div>
  );
};

export default NFTImage; 