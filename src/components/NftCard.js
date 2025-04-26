import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '@farcaster/auth-kit';
import CollectionFriendsModal from './CollectionFriendsModal';
import { getProxiedUrl, getReliableIpfsUrl, getBestImageUrl } from '../services/proxyService';
import '../styles/nft-unified.css';
import { formatAddress } from '../utils/formatters';
import { FaExternalLinkAlt, FaPlay } from 'react-icons/fa';

/**
 * Find the best image URL from NFT metadata
 * Handles multiple potential locations based on marketplace and standard
 */
const findBestImageUrl = (nft) => {
  if (!nft) {
    return '';
  }
  
  try {
    // Handle the specific structure we're seeing in the console logs first
    if (nft.image && typeof nft.image === 'object') {
      // For Alchemy format, prefer cachedUrl
      if (nft.image.cachedUrl) return nft.image.cachedUrl;
      if (nft.image.pngUrl) return nft.image.pngUrl;
      if (nft.image.thumbnailUrl) return nft.image.thumbnailUrl;
    }
    
    if (nft.imageUrl && typeof nft.imageUrl === 'object') {
      if (nft.imageUrl.cachedUrl) return nft.imageUrl.cachedUrl;
      if (nft.imageUrl.pngUrl) return nft.imageUrl.pngUrl;
      if (nft.imageUrl.thumbnailUrl) return nft.imageUrl.thumbnailUrl;
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
      return imageUrl; // Don't apply IPFS conversion here, that's done in getBestImageUrl
    }
    
    // If no URL string was found directly, but we have an image object with nested URLs
    if (typeof nft.image === 'object' && nft.image !== null) {
      // Try to access any URL property within the image object
      for (const key in nft.image) {
        if (
          typeof nft.image[key] === 'string' && 
          nft.image[key].trim() !== '' &&
          (nft.image[key].startsWith('http') || nft.image[key].startsWith('data:') || nft.image[key].startsWith('ipfs://'))
        ) {
          return nft.image[key];
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
          return value;
        }
      }
    }
    
    return ''; // Return empty string if no valid URL found
  } catch (error) {
    console.error('Error finding best image URL:', error);
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
const NFTCard = ({ nft, onSelect, selected, showFriends, style }) => {
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [mediaType, setMediaType] = useState('image');
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const { isAuthenticated, profile: authProfile } = useAuth();
  const { profile } = useProfile();
  
  // Extract essential NFT data
  const name = nft?.name || nft?.title || nft?.rawMetadata?.name || `#${nft?.tokenId || nft?.token_id || ''}`;
  
  // Get collection name from various possible locations
  let collection = '';
  try {
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
    // Silent error handling
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
    // Silent error handling
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
            setMediaError(true);
          }
          return;
        }

        // Apply proxy to the URL if needed
        const finalUrl = getBestImageUrl(bestUrl);
        
        // Set URL in state
        if (isMounted) {
          setMediaError(false);
          setImageUrl(finalUrl);
          
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
          
          // For data URLs, we can immediately set them as loaded
          if (finalUrl.startsWith('data:')) {
            setMediaLoaded(true);
          }
        }
      } catch (error) {
        console.error('Error loading NFT image:', error);
        if (isMounted) {
          setMediaError(true);
        }
      }
    };
    
    loadImage();
    
    return () => {
      isMounted = false;
    };
  }, [nft]); // Only depend on the NFT changing, not imageUrl or mediaType

  // Video/audio specific event handlers
  const handleMediaLoadedData = useCallback(() => {
    setMediaLoaded(true);
    setMediaError(false);
  }, []);

  const handleMediaError = useCallback(() => {
    // Simply mark as error if media failed to load
    setMediaError(true);
  }, []);
  
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
  
  // Reset loading state when image URL changes, but don't try to preload
  // This avoids duplicate requests as the <img> tag will handle loading
  useEffect(() => {
    // Only reset loading state if the URL actually changed
    setMediaLoaded(false);
    setMediaError(false);
    
    // If no image URL, show error state
    if (!imageUrl) {
      setMediaError(true);
    }
    
    // Special handling for data URLs - consider them loaded
    if (imageUrl?.startsWith('data:')) {
      setMediaLoaded(true);
      
      // If it's an SVG, we'll handle it specially  
      if (imageUrl.includes('image/svg+xml')) {
        setMediaType('svg');
      }
    }
  }, [imageUrl]);
  
  // Handle contract address display
  const contractAddress = nft?.contract?.address ? formatAddress(nft.contract.address) : '';

  return (
    <div className={`nft-card ${selected ? 'nft-card-selected' : ''}`} onClick={onSelect} style={style}>
      <div className="nft-media-container">
        {renderMedia()}
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
        
        {contractAddress && (
          <div className="nft-contract">
            <span>{contractAddress}</span>
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