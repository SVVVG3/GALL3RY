import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '@farcaster/auth-kit';
import CollectionFriendsModal from './CollectionFriendsModal';
import '../styles/nft-unified.css';

// IPFS gateway URLs in order of preference
const IPFS_GATEWAYS = [
  'https://cf-ipfs.com/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://gateway.pinata.cloud/ipfs/'
];

/**
 * Helper to transform IPFS URLs to more reliable gateways
 */
const getReliableIpfsUrl = (url) => {
  if (!url) return url;

  // Handle ipfs:// protocol
  if (url.startsWith('ipfs://')) {
    return IPFS_GATEWAYS[0] + url.substring(7);
  }

  // Handle ipfs hash formats: ipfs/QmHash or /ipfs/QmHash
  const ipfsHashMatch = url.match(/(?:\/ipfs\/|ipfs\/)([a-zA-Z0-9]+.*)/);
  if (ipfsHashMatch) {
    return IPFS_GATEWAYS[0] + ipfsHashMatch[1];
  }

  return url;
};

/**
 * Get a proxied URL to avoid CORS issues when loading external images
 * @param {string} url - The original image URL
 * @return {string} The proxied URL or original if it's already proxied/local
 */
const getProxiedUrl = (url) => {
  // Skip proxying for data URLs
  if (url?.startsWith('data:')) {
    console.log('Skipping proxy for data URL');
    return url;
  }
  
  // Skip proxying for relative URLs
  if (url?.startsWith('/') && !url.startsWith('//')) {
    console.log('Skipping proxy for local URL:', url);
    return url;
  }
  
  // Skip if already proxied
  if (url?.includes('/api/image-proxy') || url?.includes('/api/proxy')) {
    console.log('URL is already proxied:', url);
    return url;
  }
  
  try {
    // Validate URL format
    if (!url) return '';
    new URL(url);
    
    // Determine if we're in local dev or production and construct proxy URL
    const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';
    const baseUrl = isLocal ? 'http://localhost:3000' : '';
    
    // Use image-proxy endpoint for better handling of NFT images
    const proxiedUrl = `${baseUrl}/api/image-proxy?url=${encodeURIComponent(url)}`;
    
    console.log('Proxied URL:', proxiedUrl);
    return proxiedUrl;
  } catch (error) {
    console.error('Invalid URL format:', url, error);
    return url || ''; // Return original if invalid
  }
};

/**
 * Find the best image URL from NFT metadata
 * Handles multiple potential locations based on marketplace and standard
 */
const findBestImageUrl = (nft) => {
  // For debugging
  console.log('Finding image URL for NFT:', nft?.title || nft?.name);
  
  if (!nft) return '';
  
  // Try multiple possible image sources in order of preference
  const possibleSources = [
    // Alchemy specific paths from NFTDebugView results
    nft.image?.cachedUrl,
    nft.image?.pngUrl, 
    nft.image?.thumbnailUrl,
    nft.imageUrl?.cachedUrl,
    nft.imageUrl?.pngUrl,
    nft.imageUrl?.thumbnailUrl,
    
    // Direct image property
    nft.image,
    // Metadata image
    nft.metadata?.image,
    // OpenSea style media
    nft.metadata?.image_url,
    // Animation URL (sometimes contains image)
    nft.metadata?.animation_url,
    // Alchemy specific paths
    nft.media?.[0]?.gateway,
    nft.media?.[0]?.raw,
    nft.media?.[0]?.thumbnail,
    // NFTPort style
    nft.file_url,
    nft.cached_file_url,
    // Contract metadata
    nft.contract?.openSea?.imageUrl,
    // Raw metadata paths (deeper traversal)
    nft.rawMetadata?.image,
    nft.rawMetadata?.image_url,
    // Nested media in rawMetadata
    nft.rawMetadata?.media?.[0]?.gateway,
    nft.rawMetadata?.media?.[0]?.raw,
    // Token URI as last resort
    nft.tokenUri?.gateway,
    nft.tokenUri?.raw
  ];
  
  // Find first non-empty string URL
  const imageUrl = possibleSources.find(source => 
    typeof source === 'string' && source.trim() !== ''
  );
  
  if (imageUrl) {
    console.log('Found image URL:', imageUrl);
    return imageUrl;
  }
  
  // If no URL string was found directly, but we have an image object with nested URLs
  if (typeof nft.image === 'object' && nft.image !== null) {
    console.log('Processing complex image object:', nft.image);
    // Try to access any URL property within the image object
    for (const key in nft.image) {
      if (
        typeof nft.image[key] === 'string' && 
        nft.image[key].trim() !== '' &&
        (nft.image[key].startsWith('http') || nft.image[key].startsWith('data:'))
      ) {
        console.log(`Found image URL in image.${key}:`, nft.image[key]);
        return nft.image[key];
      }
    }
  }
  
  console.warn('No valid image URL found for NFT:', nft);
  return ''; // Return empty string if no valid URL found
};

/**
 * Simple NFT Card component
 * 
 * Displays an NFT with image, name, collection name, and optional price
 * Supports various media types (image, video, audio)
 * Includes collection friends button for Farcaster users
 */
const NFTCard = ({ nft, onSelect, selected, showFriends, style, showCheckbox = true }) => {
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [mediaType, setMediaType] = useState('image');
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [currentGatewayIndex, setCurrentGatewayIndex] = useState(0);
  const [imageUrl, setImageUrl] = useState('');
  const { isAuthenticated, profile: authProfile } = useAuth();
  const { profile } = useProfile();
  
  // Extract essential NFT data
  const name = nft?.name || nft?.title || nft?.rawMetadata?.name || `#${nft?.tokenId || nft?.token_id || ''}`;
  
  // Get collection name from various possible locations
  let collection = '';
  try {
    // Log the collection related fields for debugging
    console.log('Collection related fields:', {
      collectionName: nft?.collectionName,
      collectionFromObj: nft?.collection?.name,
      contractName: nft?.contract?.name,
      contractMetadataName: nft?.contractMetadata?.name
    });

    if (nft?.collectionName) {
      collection = nft.collectionName;
    } else if (nft?.collection_name) {
      collection = nft.collection_name;
    } else if (nft?.collection?.name) {
      collection = nft.collection.name;
    } else if (nft?.contract?.name) {
      collection = nft.contract.name;
    } else if (nft?.contractMetadata?.name) {
      collection = nft.contractMetadata.name;
    } else if (nft?.contractName) {
      collection = nft.contractName;
    } else if (nft?.rawMetadata?.collection?.name) {
      collection = nft.rawMetadata.collection.name;
    }
  } catch (error) {
    console.warn('Error extracting collection name:', error);
  }
  
  // Get floor price if available
  let floorPrice = null;
  try {
    if (nft?.collection?.floorPrice?.value || nft?.floorPrice?.value) {
      floorPrice = nft?.collection?.floorPrice?.value || nft?.floorPrice?.value;
    } else if (nft?.floorPrice && typeof nft.floorPrice === 'number') {
      floorPrice = nft.floorPrice;
    }
  } catch (error) {
    console.warn('Error extracting floor price:', error);
  }
  
  // Extract and process image URL on mount
  useEffect(() => {
    console.log('Processing NFT image for:', name);
    const url = findBestImageUrl(nft);
    if (url) {
      const processedUrl = getProxiedUrl(url);
      setImageUrl(processedUrl);
      console.log('Set processed URL:', processedUrl);
    } else {
      console.warn('No URL found for NFT:', name);
      setMediaError(true);
    }
  }, [nft, name]);
  
  // Determine media type based on URL or metadata
  useEffect(() => {
    if (!imageUrl) return;
    
    console.log('Determining media type for URL:', imageUrl);
    
    // Check if url is a string before using match
    if (typeof imageUrl === 'string') {
      // Special handling for data URLs
      if (imageUrl.startsWith('data:')) {
        if (imageUrl.includes('image/svg+xml')) {
          setMediaType('svg');
          return;
        } else if (imageUrl.includes('image/')) {
          setMediaType('image');
          return;
        }
      }
      
      // Check URL file extension
      if (imageUrl.match(/\.(mp4|webm|mov)($|\?)/i)) {
        setMediaType('video');
      } else if (imageUrl.match(/\.(mp3|wav|ogg)($|\?)/i)) {
        setMediaType('audio');
      } else if (imageUrl.match(/\.svg($|\?)/i)) {
        setMediaType('svg');
      } else {
        setMediaType('image');
      }
    } else {
      // Default to image if url is not a string
      setMediaType('image');
    }
    
    // Also check explicit metadata
    if (nft?.media && nft.media[0]?.format) {
      const format = nft.media[0].format.toLowerCase();
      if (format.includes('video')) {
        setMediaType('video');
      } else if (format.includes('audio')) {
        setMediaType('audio');
      } else if (format.includes('svg')) {
        setMediaType('svg');
      }
    }
  }, [imageUrl, nft]);
  
  // Handle media load success
  const handleMediaLoad = () => {
    console.log('Media loaded successfully:', imageUrl);
    setMediaLoaded(true);
    setMediaError(false);
  };
  
  // Handle media load error
  const handleMediaError = () => {
    console.error('Media error for URL:', imageUrl);
    
    // Try to handle data URLs differently
    if (imageUrl && imageUrl.startsWith('data:')) {
      console.log('Error with data URL, trying direct display');
      
      // For data URLs, we'll try to display directly without any special handling
      try {
        if (imageUrl.includes('image/svg+xml')) {
          setMediaType('svg');
          setMediaLoaded(true); // Consider it loaded
          return;
        }
      } catch (e) {
        console.error('Error handling data URL:', e);
      }
    }
    
    // If we have more gateways to try and this is an IPFS URL, try the next gateway
    if (currentGatewayIndex < IPFS_GATEWAYS.length - 1 && imageUrl.includes('/ipfs/')) {
      console.log(`Gateway ${currentGatewayIndex} failed, trying next gateway...`);
      setCurrentGatewayIndex(currentGatewayIndex + 1);
      
      // Update URL with new gateway
      const ipfsHashMatch = imageUrl.match(/(?:\/ipfs\/|ipfs\/)([a-zA-Z0-9]+.*)/);
      if (ipfsHashMatch) {
        const newUrl = IPFS_GATEWAYS[currentGatewayIndex + 1] + ipfsHashMatch[1];
        console.log('Trying new gateway URL:', newUrl);
        setImageUrl(newUrl);
      }
    } else {
      setMediaError(true);
    }
  };
  
  // Handle showing the friends modal
  const handleShowFriends = (e) => {
    e.stopPropagation();
    setShowFriendsModal(true);
  };
  
  // Close the friends modal
  const handleCloseModal = () => {
    setShowFriendsModal(false);
  };
  
  // Render the media content based on type
  const renderMedia = () => {
    // Debug the current image URL being used
    console.log('Rendering media with URL:', imageUrl);
    
    // Always show the loading spinner initially (but positioned behind the media)
    const loadingSpinner = !mediaLoaded && !mediaError ? (
      <div className="nft-media-loader" style={{ zIndex: 1, backgroundColor: 'rgba(0, 0, 0, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}>
        <div className="loading-spinner"></div>
      </div>
    ) : null;
    
    // Show error state if media failed to load
    if (mediaError) {
      console.error('Media error for URL:', imageUrl);
      return (
        <div className="nft-media-error" style={{ zIndex: 3 }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>Failed to load</span>
          <small style={{ fontSize: '9px', opacity: 0.7, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {imageUrl?.substring(0, 30)}...
          </small>
        </div>
      );
    }
    
    // Check if we have a valid URL
    if (!imageUrl) {
      console.warn('No image URL found for NFT:', name);
      return (
        <div className="nft-media-error" style={{ zIndex: 3 }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>No media available</span>
        </div>
      );
    }
    
    // Render appropriate media type
    let mediaElement;
    switch (mediaType) {
      case 'video':
        mediaElement = (
          <video
            key={`video-${imageUrl}`}
            src={imageUrl}
            className="nft-media nft-video"
            controls
            loop
            muted
            onLoadedData={handleMediaLoad}
            onError={handleMediaError}
            style={{ position: 'absolute', zIndex: 2, width: '100%', height: '100%', objectFit: 'cover' }}
            crossOrigin="anonymous"
          />
        );
        break;
        
      case 'audio':
        mediaElement = (
          <div className="nft-audio-container" style={{ zIndex: 2 }}>
            <div className="nft-audio-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 6v12M6 12h12" />
              </svg>
            </div>
            <audio
              key={`audio-${imageUrl}`}
              src={imageUrl}
              className="nft-audio"
              controls
              onLoadedData={handleMediaLoad}
              onError={handleMediaError}
              crossOrigin="anonymous"
            />
          </div>
        );
        break;
        
      case 'svg':
        // Directly display SVGs (especially for data URLs)
        mediaElement = (
          <div 
            className="nft-media nft-svg"
            style={{ 
              position: 'absolute',
              zIndex: 2, 
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px',
              boxSizing: 'border-box'
            }}
            dangerouslySetInnerHTML={{ 
              __html: imageUrl.startsWith('data:image/svg+xml') 
                ? atob(imageUrl.split(',')[1]) 
                : `<img src="${imageUrl}" style="max-width:100%; max-height:100%; object-fit:contain;" />` 
            }}
          />
        );
        break;
        
      case 'image':
      default:
        // Check if this is a data URL
        if (imageUrl.startsWith('data:')) {
          mediaElement = (
            <img
              key={`img-${imageUrl.substring(0, 20)}`}
              src={imageUrl}
              alt={name}
              className="nft-media nft-image"
              onLoad={handleMediaLoad}
              onError={handleMediaError}
              style={{ 
                position: 'absolute',
                zIndex: 2, 
                width: '100%',
                height: '100%',
                objectFit: 'contain' // Use contain for data URLs which might be SVGs
              }}
            />
          );
        } else {
          mediaElement = (
            <img
              key={`img-${imageUrl}`}
              src={imageUrl}
              alt={name}
              className="nft-media nft-image"
              onLoad={handleMediaLoad}
              onError={handleMediaError}
              style={{ 
                position: 'absolute',
                zIndex: 2, 
                width: '100%',
                height: '100%',
                objectFit: 'cover'
              }}
              crossOrigin="anonymous"
            />
          );
        }
        break;
    }
    
    // Return both the loading spinner and the media element
    return (
      <>
        {loadingSpinner}
        {mediaElement}
      </>
    );
  };
  
  // For images, preload to check if they work
  useEffect(() => {
    // Reset the media state when imageUrl changes
    setMediaLoaded(false);
    setMediaError(false);
    
    // If no image URL, show error state
    if (!imageUrl) {
      setMediaError(true);
      return;
    }
    
    // Special handling for data URLs - consider them loaded
    if (imageUrl.startsWith('data:')) {
      console.log('Data URL detected, considering loaded:', imageUrl.substring(0, 50) + '...');
      
      // If it's an SVG, we'll handle it specially
      if (imageUrl.includes('image/svg+xml')) {
        setMediaType('svg');
      }
      
      // For data URLs, we can assume they're already loaded
      setMediaLoaded(true);
      return;
    }
    
    // Special preloading for different media types
    if (mediaType === 'image') {
      console.log('Preloading image:', imageUrl);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = handleMediaLoad;
      img.onerror = handleMediaError;
      img.src = imageUrl;
    } else if (mediaType === 'svg') {
      // For SVGs, we can try a fetch to see if it's valid
      fetch(imageUrl)
        .then(response => {
          if (!response.ok) throw new Error('SVG fetch failed');
          return response.text();
        })
        .then(svgContent => {
          if (svgContent.includes('<svg')) {
            handleMediaLoad();
          } else {
            handleMediaError();
          }
        })
        .catch(error => {
          console.error('Error fetching SVG:', error);
          handleMediaError();
        });
    }
    // Video and audio will handle their own loading via the onLoadedData event
  }, [imageUrl, mediaType]);
  
  return (
    <div 
      className={`nft-card ${selected ? 'nft-card-selected' : ''}`} 
      onClick={onSelect}
      style={style}
    >
      <div className="nft-media-container">
        {renderMedia()}
        
        {showCheckbox && (
          <div className="nft-checkbox">
            <input 
              type="checkbox" 
              checked={selected} 
              onChange={onSelect} 
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </div>
          
      <div className="nft-info">
        <div className="nft-info-header">
          <h3 className="nft-name" title={name}>{name}</h3>
            
          {/* Inline collection friends button (alternative placement) */}
          {isAuthenticated && profile && collection && (
            <button 
              className="collection-friends-button-inline"
              onClick={handleShowFriends}
              aria-label="View collection friends"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </button>
          )}
        </div>
        
        {collection && <p className="nft-collection" title={collection}>{collection}</p>}
        
        {floorPrice && (
          <div className="nft-price">
            Floor: {floorPrice} ETH
          </div>
        )}
      </div>
      
      {/* Collection friends modal */}
      {showFriendsModal && (
        <CollectionFriendsModal
          collection={collection}
          contractAddress={nft?.contract?.address || nft?.contractAddress}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
};

export default NFTCard; 
