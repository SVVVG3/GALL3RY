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
  const [urlsAttempted, setUrlsAttempted] = useState([]);

  // When src or rawSrc change, reset state and try loading again
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
    setUrlsAttempted([]);
    
    // Process the URL with different gateways based on attempt count
    processImageUrl(src, rawSrc, 0);
  }, [src, rawSrc]);

  // Process image URL with different fallback strategies
  const processImageUrl = (originalSrc, rawSrc, attempt) => {
    // Special case: null/undefined/empty src - try rawSrc directly
    if (!originalSrc && rawSrc) {
      console.log(`Original src is empty, trying rawSrc directly: ${rawSrc.substring(0, 50)}...`);
      attemptLoading(rawSrc, attempt);
      return;
    }
    
    // Log the attempt
    console.log(`Processing image URL (attempt ${attempt + 1}):`, 
      originalSrc ? (originalSrc.substring(0, 50) + '...') : 'null/undefined');
    
    if (urlsAttempted.includes(originalSrc)) {
      console.log(`Already attempted this URL, skipping to next fallback`);
      if (attempt < 2) {
        processImageUrl(rawSrc, null, attempt + 1);
      } else {
        useDefaultPlaceholder();
      }
      return;
    }
    
    let processedSrc = originalSrc;
    let shouldSkip = false;
    
    // Different strategies based on attempt number
    if (attempt === 0) {
      // First attempt: Check if it's an Alchemy gateway URL (preferred)
      if (originalSrc && (
          originalSrc.includes('nft-cdn.alchemy.com') || 
          originalSrc.includes('nft.alchemyapi.io')
      )) {
        console.log(`Using Alchemy gateway URL directly: ${originalSrc.substring(0, 50)}...`);
        processedSrc = originalSrc;
      } 
      // Handle IPFS/AR URLs
      else if (originalSrc && originalSrc.startsWith('ipfs://')) {
        console.log(`Converting IPFS URL: ${originalSrc.substring(0, 50)}...`);
        processedSrc = originalSrc.replace('ipfs://', 'https://ipfs.io/ipfs/');
      } else if (originalSrc && originalSrc.startsWith('ar://')) {
        console.log(`Converting Arweave URL: ${originalSrc.substring(0, 50)}...`);
        processedSrc = originalSrc.replace('ar://', 'https://arweave.net/');
      } 
      // Check for potentially problematic URLs
      else if (originalSrc && (
        originalSrc.includes('placeholder') ||
        originalSrc.startsWith('data:') ||
        !originalSrc.startsWith('http')
      )) {
        console.log(`Potentially problematic URL, skipping to rawSrc: ${originalSrc.substring(0, 50)}...`);
        shouldSkip = true;
        if (rawSrc) {
          processImageUrl(rawSrc, null, 0);
        } else {
          processImageUrl(originalSrc, null, 1);
        }
      } else if (originalSrc) {
        // Use original source as-is for valid URLs
        console.log(`Using original URL as-is: ${originalSrc.substring(0, 50)}...`);
        processedSrc = originalSrc;
      } else {
        shouldSkip = true;
        processImageUrl(null, rawSrc, 1);
      }
    } else if (attempt === 1) {
      // Second attempt: try with alternative gateways
      if (originalSrc && originalSrc.startsWith('ipfs://')) {
        console.log(`Trying alternative IPFS gateway for: ${originalSrc.substring(0, 50)}...`);
        processedSrc = originalSrc.replace('ipfs://', 'https://ipfs.infura.io/ipfs/');
      } else if (originalSrc && originalSrc.includes('ipfs.io')) {
        console.log(`Switching IPFS gateway from ipfs.io to Infura: ${originalSrc.substring(0, 50)}...`);
        processedSrc = originalSrc.replace('ipfs.io', 'ipfs.infura.io');
      } else if (rawSrc && !urlsAttempted.includes(rawSrc)) {
        console.log(`Trying rawSrc as fallback: ${rawSrc.substring(0, 50)}...`);
        processedSrc = rawSrc;
      } else if (originalSrc) {
        console.log(`Using original source on second attempt: ${originalSrc.substring(0, 50)}...`);
        processedSrc = originalSrc;
      } else {
        shouldSkip = true;
        processImageUrl(null, null, 2);
      }
    } else {
      // Final attempt - try direct URL or use placeholder
      if (originalSrc && !originalSrc.startsWith('data:') && !urlsAttempted.includes(originalSrc)) {
        console.log(`Last attempt with original URL: ${originalSrc.substring(0, 50)}...`);
        processedSrc = originalSrc;
      } else {
        useDefaultPlaceholder();
        return;
      }
    }

    if (!shouldSkip) {
      attemptLoading(processedSrc, attempt);
    }
  };
  
  // Helper to add URL to attempted list and set media source
  const attemptLoading = (url, attempt) => {
    if (!url) {
      console.warn('Empty URL provided to attemptLoading');
      if (attempt < 2) {
        processImageUrl(null, null, attempt + 1);
      } else {
        useDefaultPlaceholder();
      }
      return;
    }
    
    // Check if the media is a video based on extension or content type
    const isVideoFile = /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);
    setIsVideo(isVideoFile);
    
    // Update attempted URLs list
    setUrlsAttempted(prev => [...prev, url]);
    
    // Update the media source and attempt count
    setMediaSrc(url);
    setAttemptCount(attempt);
  };
  
  // Helper to use default placeholder
  const useDefaultPlaceholder = () => {
    console.warn('Using default placeholder after all attempts failed');
    setMediaSrc('/assets/placeholder-nft.svg');
    setIsVideo(false);
  };

  const handleMediaLoad = () => {
    console.log(`Media loaded successfully: ${mediaSrc}`);
    setLoading(false);
    setError(false);
    onLoad();
  };

  const handleMediaError = () => {
    console.warn(`Error loading media (attempt ${attemptCount + 1}): ${mediaSrc}`);
    
    // Try next fallback strategy if we haven't exhausted them
    if (attemptCount < 2) {
      processImageUrl(attemptCount === 0 ? rawSrc : null, null, attemptCount + 1);
    } else {
      // Give up after 3 attempts
      console.error(`Failed to load image after ${attemptCount + 1} attempts, using placeholder`);
      useDefaultPlaceholder();
      setError(true);
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