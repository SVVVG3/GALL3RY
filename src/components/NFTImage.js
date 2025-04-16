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

  // Define IPFS gateways to try in sequence
  const IPFS_GATEWAYS = [
    'https://ipfs.io/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://ipfs.infura.io/ipfs/',
    'https://gateway.pinata.cloud/ipfs/'
  ];

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

  // Helper to properly format and process URLs
  const processImageUrl = (originalUrl, rawUrl, attemptNumber) => {
    if (!originalUrl && !rawUrl) {
      console.warn('No URLs provided to processImageUrl');
      useDefaultPlaceholder();
      return;
    }

    let currentUrl = originalUrl || rawUrl;
    console.log(`Processing image URL (attempt ${attemptNumber + 1}): ${currentUrl}`);
    
    try {
      // Only process if we have a valid string URL
      if (currentUrl && typeof currentUrl === 'string') {
        
        // Handle different URL formats based on attempt number
        
        // Special handling for Alchemy CDN URLs
        if (currentUrl.includes('nft-cdn.alchemy.com')) {
          console.log('Detected Alchemy CDN URL');
          
          // Make sure we have a format specified
          if (!currentUrl.includes('/original') && !currentUrl.includes('/thumb') &&
              !currentUrl.includes('.jpg') && !currentUrl.includes('.png')) {
            if (attemptNumber === 0) {
              // First attempt with original size
              currentUrl = `${currentUrl}/original`;
              console.log(`Modified to original format: ${currentUrl}`);
            } else {
              // Try thumbnail on retry
              currentUrl = `${currentUrl}/thumb`;
              console.log(`Modified to thumbnail format: ${currentUrl}`);
            }
          }
          
          // Use image proxy for all Alchemy URLs to avoid CORS issues
          currentUrl = `/api/image-proxy?url=${encodeURIComponent(currentUrl)}`;
          console.log(`Using proxy for Alchemy URL: ${currentUrl}`);
        }
        // Special handling for IPFS URLs
        else if (currentUrl.startsWith('ipfs://')) {
          // On different attempts, try different IPFS gateways
          const ipfsHash = currentUrl.replace('ipfs://', '');
          const gateway = IPFS_GATEWAYS[attemptNumber % IPFS_GATEWAYS.length];
          currentUrl = `${gateway}${ipfsHash}`;
          console.log(`Using IPFS gateway: ${currentUrl}`);
        }
        // Handle generic HTTP URLs
        else if (currentUrl.startsWith('http://')) {
          // Try HTTPS version instead
          currentUrl = currentUrl.replace('http://', 'https://');
          console.log(`Using HTTPS version: ${currentUrl}`);
        }
        
        // Check if URL is external and needs proxy
        // Use proxy only for external URLs on failures or for domains known to have CORS issues
        const needsProxy = (
          attemptNumber > 0 || // Use proxy on retry attempts
          currentUrl.includes('nft-cdn.alchemy.com') || // Always proxy Alchemy
          currentUrl.includes('ipfs.io') || // Always proxy IPFS
          currentUrl.includes('opensea') || // Always proxy OpenSea
          currentUrl.includes('seadn.io') // Always proxy OpenSea CDN
        );
        
        if (needsProxy && !currentUrl.includes('/api/image-proxy') && 
            !currentUrl.startsWith('/') && !currentUrl.startsWith('data:')) {
          currentUrl = `/api/image-proxy?url=${encodeURIComponent(currentUrl)}`;
          console.log(`Applied proxy to URL: ${currentUrl}`);
        }
        
        // Set image type based on URL or file extension
        if (currentUrl.match(/\.(mp4|webm|ogv)$/i)) {
          setIsVideo(true);
          console.log('Detected video content');
        } else {
          setIsVideo(false);
        }
        
        // Update the media source
        setMediaSrc(currentUrl);
        // Track the URLs we've tried
        setUrlsAttempted(prev => [...prev, currentUrl]);
      } else {
        console.warn('Invalid URL format', currentUrl);
        useDefaultPlaceholder();
      }
    } catch (error) {
      console.error('Error processing image URL:', error);
      useDefaultPlaceholder();
    }
  };
  
  // Helper to use default placeholder
  const useDefaultPlaceholder = () => {
    console.warn('Using default placeholder after all attempts failed');
    setMediaSrc('/assets/placeholder-nft.svg');
    setIsVideo(false);
    // Set loading to false since we're using the placeholder
    setLoading(false);
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
    if (attemptCount < 3) {
      processImageUrl(attemptCount === 0 ? rawSrc : null, null, attemptCount + 1);
    } else {
      // Give up after multiple attempts
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