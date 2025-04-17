import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../styles/NFTCard.css';

/**
 * Enhanced NFT Card component with better image loading and error handling
 * 
 * Features:
 * - Robust fallback system for image loading
 * - Better error handling
 * - Comprehensive URL detection from various NFT sources
 * - Support for image and video content
 */
const NFTCard = ({ nft }) => {
  const [media, setMedia] = useState({
    status: 'loading', // loading, loaded, error
    url: null,
    type: 'image', // image, video, or unsupported
    fallbacksExhausted: false
  });

  // Extract NFT details
  const title = nft?.metadata?.name || nft?.name || nft?.title || `NFT #${nft?.tokenId || nft?.token_id || ''}`;
  const collection = nft?.collection?.name || nft?.collection_name || nft?.contractMetadata?.name || '';
  
  // Get contract address from various possible locations
  const contractAddress = 
    nft?.contract?.address || 
    nft?.contractAddress || 
    nft?.contract_address || 
    (nft?.id?.split && nft?.id?.includes(':') ? nft?.id?.split(':')[2] : '');
  
  // Get token id from various possible locations
  const tokenId = 
    nft?.tokenId || 
    nft?.token_id || 
    (nft?.id?.split && nft?.id?.includes(':') ? nft?.id?.split(':')[3] : '');
  
  // Directly process a URL to make it usable
  const processUrl = (url) => {
    if (!url) return null;
    
    // Handle IPFS URLs
    if (url.startsWith('ipfs://')) {
      return `/image-proxy?url=${encodeURIComponent(url)}`;
    }
    
    // Handle Arweave URLs
    if (url.startsWith('ar://')) {
      return `/image-proxy?url=${encodeURIComponent(url)}`;
    }
    
    // Handle HTTP URLs
    if (url.startsWith('http://')) {
      url = url.replace('http://', 'https://');
    }
    
    // Special handling for known problematic domains
    const needsProxy = 
      url.includes('nft-cdn.alchemy.com') || 
      url.includes('alchemyapi.io') ||
      url.includes('i.seadn.io') ||
      url.includes('cloudflare-ipfs.com') ||
      url.includes('ipfs.io') ||
      url.includes('gateway.pinata.cloud') ||
      url.includes('ipfs.infura.io') ||
      url.includes('gateway.ipfs.io') ||
      url.includes('dweb.link') ||
      url.includes('arweave.net') ||
      url.includes('apeokx.one') ||
      url.includes('/ipfs/') ||
      url.includes('goonzworld.com');
    
    if (needsProxy) {
      return `/image-proxy?url=${encodeURIComponent(url)}`;
    }
    
    return url;
  };
  
  // Get media type from URL
  const getMediaType = (url) => {
    if (!url) return 'image';
    
    if (url.match(/\.(mp4|webm|mov)($|\?)/i)) {
      return 'video';
    }
    
    if (nft?.metadata?.animation_type === 'video' || 
        nft?.animation_type === 'video' ||
        (nft?.metadata?.properties?.category === 'video')) {
      return 'video';
    }
    
    return 'image';
  };
  
  // Find the best image URL from the NFT object
  const findBestImageUrl = (nft) => {
    if (!nft) return null;
    
    // Try media array first (Alchemy v3 API format)
    if (nft.media && Array.isArray(nft.media) && nft.media.length > 0) {
      const mediaItem = nft.media[0];
      if (mediaItem.gateway) return mediaItem.gateway;
      if (mediaItem.raw) return mediaItem.raw;
      if (mediaItem.thumbnail) return mediaItem.thumbnail;
    }
    
    // Try image object (Alchemy structured response)
    if (nft.image) {
      if (typeof nft.image === 'object') {
        if (nft.image.cachedUrl) return nft.image.cachedUrl;
        if (nft.image.originalUrl) return nft.image.originalUrl;
        if (nft.image.pngUrl) return nft.image.pngUrl;
        if (nft.image.thumbnailUrl) return nft.image.thumbnailUrl;
        if (nft.image.gateway) return nft.image.gateway;
      } else if (typeof nft.image === 'string') {
        return nft.image;
      }
    }
    
    // Check animation URLs for videos
    if (nft.animation_url) return nft.animation_url;
    
    if (nft.animation) {
      if (typeof nft.animation === 'object' && nft.animation.cachedUrl) {
        return nft.animation.cachedUrl;
      } else if (typeof nft.animation === 'string') {
        return nft.animation;
      }
    }
    
    // Check metadata locations
    if (nft.metadata) {
      if (nft.metadata.image) return nft.metadata.image;
      if (nft.metadata.image_url) return nft.metadata.image_url;
      if (nft.metadata.animation_url) return nft.metadata.animation_url;
    }
    
    // Check raw metadata
    if (nft.raw && nft.raw.metadata) {
      if (nft.raw.metadata.image) return nft.raw.metadata.image;
      if (nft.raw.metadata.image_url) return nft.raw.metadata.image_url;
    }
    
    // Check other common locations
    if (nft.rawMetadata) {
      if (nft.rawMetadata.image) return nft.rawMetadata.image;
      if (nft.rawMetadata.image_url) return nft.rawMetadata.image_url;
    }
    
    if (nft.image_url) return nft.image_url;
    if (nft.thumbnail) return nft.thumbnail;
    
    // If nothing found, return null
    return null;
  };
  
  // Load media on mount or when nft changes
  useEffect(() => {
    console.log('NFTCard: Loading media for', nft?.name || nft?.title || 'unknown NFT');
    
    const imageUrl = findBestImageUrl(nft);
    console.log('NFTCard: Found image URL:', imageUrl);
    
    if (!imageUrl) {
      console.warn('NFTCard: No image URL found');
      setMedia({
        status: 'error',
        url: '/placeholder-nft.svg',
        type: 'image',
        fallbacksExhausted: true
      });
      return;
    }
    
    const processedUrl = processUrl(imageUrl);
    const mediaType = getMediaType(imageUrl);
    
    if (mediaType === 'video') {
      // For videos, we don't preload - just set the URL
      setMedia({
        status: 'loaded', 
        url: processedUrl,
        type: 'video',
        fallbacksExhausted: false
      });
    } else {
      // For images, preload to check if they load properly
      const img = new Image();
      img.onload = () => {
        setMedia({
          status: 'loaded',
          url: processedUrl,
          type: 'image',
          fallbacksExhausted: false
        });
      };
      
      img.onerror = () => {
        console.error(`Failed to load image from ${processedUrl}`);
        
        // If not already using image proxy, try with the proxy
        if (!processedUrl.includes('/image-proxy') && imageUrl) {
          const proxiedUrl = `/image-proxy?url=${encodeURIComponent(imageUrl)}`;
          
          // Try the proxy URL
          const proxyImg = new Image();
          proxyImg.onload = () => {
            setMedia({
              status: 'loaded',
              url: proxiedUrl,
              type: 'image',
              fallbacksExhausted: false
            });
          };
          
          proxyImg.onerror = () => {
            console.error(`Failed to load image via proxy from ${proxiedUrl}`);
            setMedia({
              status: 'error',
              url: '/placeholder-nft.svg',
              type: 'image', 
              fallbacksExhausted: true
            });
          };
          
          proxyImg.src = proxiedUrl;
        } else {
          // Already tried with proxy or no URL to proxy, show error
          setMedia({
            status: 'error',
            url: '/placeholder-nft.svg',
            type: 'image',
            fallbacksExhausted: true
          });
        }
      };
      
      // Set crossOrigin for CORS requests
      if (!processedUrl.startsWith('/') && !processedUrl.startsWith('data:')) {
        img.crossOrigin = 'anonymous';
      }
      
      img.src = processedUrl;
    }
  }, [nft]);
  
  return (
    <div className="nft-card-container">
      <Link to={`/nft/${contractAddress}/${tokenId}`} className="nft-link">
        <div className="nft-image-container">
          {media.status === 'loading' && (
            <div className="nft-image-placeholder">
              <div className="loading-indicator"></div>
              <span>Loading...</span>
            </div>
          )}
          
          {media.status === 'loaded' && media.type === 'image' && (
            <img
              src={media.url}
              alt={title}
              className="nft-image loaded"
              onError={(e) => {
                console.error(`Error loading image ${media.url}`);
                e.target.src = '/placeholder-nft.svg';
                e.target.className = 'nft-image fallback';
              }}
              loading="lazy"
              crossOrigin="anonymous"
              referrerPolicy="no-referrer"
            />
          )}
          
          {media.status === 'loaded' && media.type === 'video' && (
            <video
              src={media.url}
              className="nft-video loaded"
              muted
              loop
              autoPlay
              playsInline
              onError={(e) => {
                console.error(`Error loading video ${media.url}`);
                setMedia({
                  status: 'error',
                  url: '/placeholder-nft.svg',
                  type: 'image',
                  fallbacksExhausted: true
                });
              }}
            />
          )}
          
          {media.status === 'error' && (
            <div className="nft-image-error">
              <img 
                src="/placeholder-nft.svg"
                alt={`${title} (unavailable)`}
                className="nft-image fallback"
              />
            </div>
          )}
        </div>
        
        <div className="nft-info">
          <h3 className="nft-title">{title}</h3>
          {collection && <p className="nft-collection">{collection}</p>}
        </div>
      </Link>
    </div>
  );
};

export default NFTCard; 
