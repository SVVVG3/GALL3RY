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

  // Skip if undefined/null URL
  if (!url) {
    console.warn('Empty URL provided to proxy function');
    return '';
  }

  try {
    // First, try to make the URL absolute if it's not already
    const absoluteUrl = url.startsWith('http') ? url : `https://${url.replace(/^\/\//, '')}`;
    
    // Use the CORS proxy URL (assuming it's defined elsewhere)
    const proxiedUrl = `${process.env.REACT_APP_PROXY_URL || 'https://proxy.gall3ry.co/'}?url=${encodeURIComponent(absoluteUrl)}`;
    console.log('Proxied URL:', proxiedUrl);
    return proxiedUrl;
  } catch (error) {
    console.error('Error creating proxied URL:', error);
    return url; // Return original URL if there's an error
  }
};

/**
 * Find the best image URL from NFT metadata
 * Handles multiple potential locations based on marketplace and standard
 */
const findBestImageUrl = (nft) => {
  // For debugging
  console.log('Finding image URL for NFT:', nft?.title || nft?.name);
  
  if (!nft) {
    console.warn('No NFT data provided to findBestImageUrl');
    return '';
  }
  
  try {
    // Handle the specific structure we're seeing in the console logs first
    if (nft.image && typeof nft.image === 'object') {
      if (nft.image.cachedUrl) return getReliableIpfsUrl(nft.image.cachedUrl);
      if (nft.image.pngUrl) return getReliableIpfsUrl(nft.image.pngUrl);
      if (nft.image.thumbnailUrl) return getReliableIpfsUrl(nft.image.thumbnailUrl);
    }
    
    if (nft.imageUrl && typeof nft.imageUrl === 'object') {
      if (nft.imageUrl.cachedUrl) return getReliableIpfsUrl(nft.imageUrl.cachedUrl);
      if (nft.imageUrl.pngUrl) return getReliableIpfsUrl(nft.imageUrl.pngUrl);
      if (nft.imageUrl.thumbnailUrl) return getReliableIpfsUrl(nft.imageUrl.thumbnailUrl);
    }
    
    // Try multiple possible image sources in order of preference
    const possibleSources = [
      // Direct image property for string values
      typeof nft.image === 'string' ? nft.image : null,
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
      nft.tokenUri?.raw,
      // Deeper structure for OpenSea items
      nft.content?.imageUrl,
      nft.content?.contentUrl,
      nft.content?.links?.image
    ];
    
    // Find first non-empty string URL
    const imageUrl = possibleSources.find(source => 
      typeof source === 'string' && source.trim() !== ''
    );
    
    if (imageUrl) {
      console.log('Found image URL:', imageUrl);
      return getReliableIpfsUrl(imageUrl);
    }
    
    // If no URL string was found directly, but we have an image object with nested URLs
    if (typeof nft.image === 'object' && nft.image !== null) {
      console.log('Processing complex image object:', nft.image);
      // Try to access any URL property within the image object
      for (const key in nft.image) {
        if (
          typeof nft.image[key] === 'string' && 
          nft.image[key].trim() !== '' &&
          (nft.image[key].startsWith('http') || nft.image[key].startsWith('data:') || nft.image[key].startsWith('ipfs://'))
        ) {
          console.log(`Found image URL in image.${key}:`, nft.image[key]);
          return getReliableIpfsUrl(nft.image[key]);
        }
      }
    }
    
    // Check for embedded data URLs in metadata
    if (nft.metadata && typeof nft.metadata === 'object') {
      for (const key in nft.metadata) {
        const value = nft.metadata[key];
        if (
          typeof value === 'string' && 
          value.startsWith('data:image/') && 
          value.length > 100
        ) {
          console.log(`Found data URL in metadata.${key}`);
          return value;
        }
      }
    }
    
    console.warn('No valid image URL found for NFT:', nft);
    return ''; // Return empty string if no valid URL found
  } catch (error) {
    console.error('Error in findBestImageUrl:', error);
    // Return a default or empty string on error
    return '';
  }
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
  
  // Set image URL and media type when NFT changes
  useEffect(() => {
    let isMounted = true;
    
    const loadImage = async () => {
      if (!nft) return;
      
      try {
        // Use our helper function to find the best image URL
        const bestUrl = findBestImageUrl(nft);
        
        // If no URL was found, show error state
        if (!bestUrl) {
          if (isMounted) {
            console.warn('No suitable image URL found for NFT');
            setMediaError(true);
          }
          return;
        }

        // Apply proxy to the URL if it's not a data URL or local URL
        const finalUrl = bestUrl.startsWith('data:') || bestUrl.startsWith('/') 
          ? bestUrl 
          : getProxiedUrl(bestUrl);
        
        // Set URL in state
        if (isMounted) {
          setMediaError(false);
          setImageUrl(finalUrl);
          console.log('Set final image URL:', finalUrl, 'Original:', bestUrl);
          
          // Set media type based on URL extension
          if (bestUrl.match(/\.(mp4|webm|mov)($|\?)/i) || bestUrl.includes('video/')) {
            setMediaType('video');
          } else if (bestUrl.match(/\.(mp3|wav|ogg)($|\?)/i) || bestUrl.includes('audio/')) {
            setMediaType('audio');
          } else if (bestUrl.match(/\.svg($|\?)/i) || bestUrl.includes('image/svg+xml')) {
            setMediaType('svg');
          } else {
            setMediaType('image');
          }
        }
      } catch (error) {
        console.error('Error setting NFT image URL:', error);
        if (isMounted) {
          setMediaError(true);
        }
      }
    };
    
    loadImage();
    
    return () => {
      isMounted = false;
    };
  }, [nft]);
  
  // Video/audio specific event handlers
  const handleMediaLoadedData = useCallback(() => {
    console.log('Media loaded successfully:', imageUrl);
    setMediaLoaded(true);
    setMediaError(false);
  }, [imageUrl]);

  const handleMediaError = useCallback((error) => {
    console.error('Error loading media:', error);
    
    // If the proxy URL failed, try to fallback to direct URL
    if (imageUrl?.includes('proxy.gall3ry.co') && imageUrl?.includes('?url=')) {
      try {
        // Extract the original URL from the proxy URL
        const originalUrl = decodeURIComponent(imageUrl.split('?url=')[1]);
        console.log('Media error, trying fallback to direct URL:', originalUrl);
        
        // Set the direct URL
        setImageUrl(originalUrl);
      } catch (e) {
        console.error('Error extracting original URL:', e);
        setMediaError(true);
      }
    } else {
      setMediaError(true);
    }
  }, [imageUrl]);
  
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
    
    // Always show the loading spinner initially (positioned behind the media)
    const loadingSpinner = !mediaLoaded && !mediaError ? (
      <div className="nft-loading">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" strokeDasharray="32" strokeLinecap="round" />
        </svg>
      </div>
    ) : null;
    
    // Show error state if media failed to load
    if (mediaError) {
      return (
        <div className="nft-media-error">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
          <span>Failed to load</span>
          <small style={{ fontSize: '9px', opacity: 0.7, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {imageUrl?.substring(0, 30)}...
          </small>
        </div>
      );
    }
    
    // Determine media type based on URL and metadata
    let mediaElement;
    let type = 'image'; // Default type
    
    if (imageUrl) {
      // Try to determine the media type from the URL
      if (imageUrl.match(/\.(mp4|webm|mov)($|\?)/i) || 
          imageUrl.includes('video/') || 
          nft.metadata?.animation_type === 'video') {
        type = 'video';
      } else if (imageUrl.match(/\.(mp3|wav|ogg)($|\?)/i) || 
                 imageUrl.includes('audio/') || 
                 nft.metadata?.animation_type === 'audio') {
        type = 'audio';
      } else if (imageUrl.includes('image/svg+xml') || imageUrl.match(/\.svg($|\?)/i)) {
        type = 'svg';
      } else {
        type = 'image';
      }
      
      // Set the media type in state (for use in other parts of the component)
      if (mediaType !== type) {
        setMediaType(type);
      }
      
      // Render based on media type
      switch (type) {
        case 'video':
          mediaElement = (
            <div className="nft-media-wrapper">
              <video
                className="nft-media nft-video"
                src={imageUrl}
                controls
                autoPlay
                muted
                loop
                playsInline
                onLoadedData={handleMediaLoadedData}
                onError={handleMediaError}
              />
              <div className="nft-media-type-icon">📹</div>
            </div>
          );
          break;
          
        case 'audio':
          // For audio, show an icon and the audio control
          mediaElement = (
            <div className="nft-media nft-audio">
              <div className="nft-audio-icon">♪</div>
              <audio
                src={imageUrl}
                controls
                onLoadedData={handleMediaLoadedData}
                onError={handleMediaError}
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
                justifyContent: 'center'
              }}
            >
              <object
                data={imageUrl}
                type="image/svg+xml"
                className="nft-media"
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                onLoad={() => setMediaLoaded(true)}
                onError={handleMediaError}
              >
                SVG not supported
              </object>
            </div>
          );
          break;
          
        case 'image':
        default:
          // Regular image display
          mediaElement = (
            <img
              src={imageUrl}
              alt={nft.name || 'NFT'}
              className="nft-media"
              onLoad={() => setMediaLoaded(true)}
              onError={handleMediaError}
              loading="lazy"
            />
          );
          break;
      }
    }
    
    return (
      <div className="nft-media-container">
        {loadingSpinner}
        {mediaElement}
      </div>
    );
  };
  
  // For images, preload to check if they work
  useEffect(() => {
    let isMounted = true;
    
    // Reset the media state when imageUrl changes
    setMediaLoaded(false);
    setMediaError(false);
    
    // If no image URL, show error state
    if (!imageUrl) {
      console.warn('No image URL to load');
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
    
    // Detect media type from URL
    if (imageUrl.match(/\.(mp4|webm|mov)($|\?)/i) || imageUrl.includes('video/')) {
      setMediaType('video');
    } else if (imageUrl.match(/\.(mp3|wav|ogg)($|\?)/i) || imageUrl.includes('audio/')) {
      setMediaType('audio');
    } else if (imageUrl.match(/\.svg($|\?)/i) || imageUrl.includes('image/svg+xml')) {
      setMediaType('svg');
    } else {
      setMediaType('image');
    }
    
    // Special preloading for different media types
    if (mediaType === 'image') {
      console.log('Preloading image:', imageUrl);
      const img = new Image();
      img.crossOrigin = "anonymous";
      
      img.onload = () => {
        if (isMounted) {
          console.log('Image loaded successfully:', imageUrl);
          setMediaLoaded(true);
          setMediaError(false);
        }
      };
      
      img.onerror = (error) => {
        console.error('Error loading image:', error);
        if (isMounted) {
          // If the proxy URL failed, try to fallback to direct URL
          if (imageUrl.includes('proxy.gall3ry.co') && imageUrl.includes('?url=')) {
            try {
              // Extract the original URL from the proxy URL
              const originalUrl = decodeURIComponent(imageUrl.split('?url=')[1]);
              console.log('Trying fallback to direct URL:', originalUrl);
              
              // Only set the direct URL if the component is still mounted
              if (isMounted) {
                setImageUrl(originalUrl);
              }
            } catch (e) {
              console.error('Error extracting original URL:', e);
              if (isMounted) {
                setMediaError(true);
              }
            }
          } else {
            setMediaError(true);
          }
        }
      };
      
      img.src = imageUrl;
    } else if (mediaType === 'svg') {
      // For SVGs, we can try a fetch to see if it's valid
      fetch(imageUrl)
        .then(response => {
          if (!response.ok) throw new Error('SVG fetch failed with status: ' + response.status);
          return response.text();
        })
        .then(svgContent => {
          if (svgContent.includes('<svg')) {
            if (isMounted) {
              setMediaLoaded(true);
              setMediaError(false);
            }
          } else {
            throw new Error('Not a valid SVG content');
          }
        })
        .catch(error => {
          console.error('Error fetching SVG:', error);
          if (isMounted) {
            setMediaError(true);
          }
        });
    }
    // Video and audio will handle their own loading via the onLoadedData event
    
    return () => {
      isMounted = false;
    };
  }, [imageUrl, mediaType]);
  
  return (
    <div className={`nft-card ${selected ? 'nft-card-selected' : ''}`} onClick={onSelect} style={style}>
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
