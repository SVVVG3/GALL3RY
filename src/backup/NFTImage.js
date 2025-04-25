import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import '../styles/nft-unified.css';
import Spinner from './Spinner';

/**
 * NFTImage component that displays an NFT image or video with improved 
 * error handling and prioritization of Alchemy gateway URLs.
 */
const NFTImage = ({ nft, src, alt, className, style, noHoverEffect = false, prioritized = false, onClick, onLoad, handleMediaError }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [mediaType, setMediaType] = useState('image');
  const [usedSrc, setUsedSrc] = useState('');
  const imageRef = useRef(null);
  
  // Log details for debugging
  useEffect(() => {
    console.log(`NFTImage for ${nft?.name || nft?.title || 'Unknown NFT'}:`, { 
      providedSrc: src,
      nftImage: nft?.image,
      nftMedia: nft?.media,
      hasError,
      isLoaded
    });
  }, [nft, src, hasError, isLoaded]);

  useEffect(() => {
    // Reset states when source changes
    if (src !== usedSrc) {
      setIsLoaded(false);
      setHasError(false);
      setUsedSrc(src);
    }
  }, [src, usedSrc]);

  useEffect(() => {
    // Determine media type from src URL
    if (!src) {
      console.error("No source URL provided for NFT image:", nft);
      setHasError(true);
      return;
    }
    
    try {
      const url = new URL(src);
      const pathname = url.pathname.toLowerCase();
      
      if (pathname.endsWith('.mp4') || pathname.endsWith('.webm') || pathname.endsWith('.mov')) {
        setMediaType('video');
      } else {
        setMediaType('image');
      }
    } catch (error) {
      console.error("Invalid URL:", src, error);
      setHasError(true);
    }
  }, [src, nft]);
  
  const handleLoadSuccess = useCallback(() => {
    console.log(`Image loaded successfully: ${src}`);
    setIsLoaded(true);
    setHasError(false);
    if (onLoad) onLoad();
  }, [src, onLoad]);
  
  const handleError = useCallback(() => {
    console.error(`Error loading media: ${src}`);
    setHasError(true);
    setIsLoaded(false);
    
    if (handleMediaError) {
      handleMediaError();
    }
  }, [src, handleMediaError]);
  
  // Create a properly proxied URL
  const getProxiedUrl = useCallback((url) => {
    if (!url) return '';
    
    // Don't double-proxy
    if (url.includes('/api/image-proxy')) return url;
    
    // Encode the URL to handle special characters
    const encodedUrl = encodeURIComponent(url);
    return `/api/image-proxy?url=${encodedUrl}`;
  }, []);
  
  // Use proxied URL to avoid CORS issues and improve caching
  const proxiedSrc = useMemo(() => getProxiedUrl(src), [src, getProxiedUrl]);
  
  // Calculate container classes
  const containerClassName = `nft-media-container ${className || ''} ${
    isLoaded ? 'media-loaded' : 'media-loading'
  } ${hasError ? 'media-error' : ''} ${noHoverEffect ? 'no-hover' : ''}`;
  
  // Improved container styles
  const containerStyle = {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    ...style,
  };
  
  // Generate placeholder for errors
  const placeholderSvg = `
    <svg width="300" height="300" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f0f0f0"/>
      <text x="50%" y="50%" font-family="Arial" font-size="24" fill="#888" text-anchor="middle">NFT</text>
    </svg>
  `;
  const placeholderUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(placeholderSvg)}`;
  
  return (
    <div className={containerClassName} style={containerStyle} onClick={onClick}>
      {mediaType === 'video' && proxiedSrc && (
        <video
          ref={imageRef}
          src={proxiedSrc}
          alt={alt || nft?.name || nft?.title || 'NFT Media'}
          controls
          autoPlay={false}
          loop
          muted
          playsInline
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: !hasError ? 'block' : 'none',
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.3s ease',
          }}
          onLoadedData={handleLoadSuccess}
          onError={handleError}
        />
      )}
      
      {mediaType === 'image' && proxiedSrc && (
        <img
          ref={imageRef}
          src={proxiedSrc}
          alt={alt || nft?.name || nft?.title || 'NFT Image'}
          loading={prioritized ? 'eager' : 'lazy'}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: !hasError ? 'block' : 'none',
            opacity: isLoaded ? 1 : 0,
            transition: 'opacity 0.3s ease',
          }}
          onLoad={handleLoadSuccess}
          onError={handleError}
        />
      )}
      
      {/* Loading spinner */}
      {!isLoaded && !hasError && (
        <div className="nft-loading-indicator" style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f8f8f8',
        }}>
          <div className="loading-spinner" />
        </div>
      )}
      
      {/* Error state */}
      {hasError && (
        <div className="nft-error-state" style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#f8f8f8',
          color: '#888',
          padding: '10px',
          textAlign: 'center',
        }}>
          <img 
            src={placeholderUrl} 
            alt="NFT Placeholder" 
            style={{ width: '50%', height: 'auto', marginBottom: '8px' }} 
          />
          <div style={{ fontSize: '12px' }}>Image unavailable</div>
          <div style={{ fontSize: '10px', opacity: 0.7 }}>{nft?.collection_name || ''}</div>
        </div>
      )}
      
      {/* Debug overlay */}
      {process.env.NODE_ENV !== 'production' && (
        <div className="debug-overlay" style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '2px 5px',
          backgroundColor: 'rgba(0,0,0,0.6)',
          color: 'white',
          fontSize: '8px',
          pointerEvents: 'none',
          zIndex: 10,
        }}>
          {hasError ? '❌ Error' : isLoaded ? '✅ Loaded' : '⏳ Loading'}
          <br />
          {mediaType}: {proxiedSrc ? proxiedSrc.substring(0, 20) + '...' : 'no src'}
        </div>
      )}
    </div>
  );
};

export default NFTImage; 