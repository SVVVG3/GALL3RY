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
  const [showDebug, setShowDebug] = useState(false);
  
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
        console.log('NFTCard - Loading image for:', nft.name || nft.tokenId || 'Unknown NFT');
        
        // Use our helper function to find the best image URL
        const bestUrl = findBestImageUrl(nft);
        console.log('NFTCard - Best image URL found:', bestUrl);
        
        // If no URL was found, show error state
        if (!bestUrl) {
          console.warn('NFTCard - No image URL found for:', nft.name || nft.tokenId);
          if (isMounted) {
            setMediaError(true);
          }
          return;
        }

        // Apply proxy to the URL if needed
        const finalUrl = getBestImageUrl(bestUrl);
        console.log('NFTCard - Final proxied URL:', finalUrl);
        
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
    console.log('NFTCard - Media loaded successfully:', imageUrl);
    setMediaLoaded(true);
    setMediaError(false);
  }, [imageUrl]);

  const handleMediaError = useCallback(() => {
    // Simply mark as error if media failed to load
    console.error('NFTCard - Media failed to load:', imageUrl);
    setMediaError(true);
  }, [imageUrl]);
  
  // Toggle debug overlay
  const toggleDebug = (e) => {
    e.stopPropagation();
    setShowDebug(!showDebug);
  };

  // Handle showing collection friends modal
  const handleShowFriends = (e) => {
    e.stopPropagation();
    setShowFriendsModal(true);
  };
  
  // Handle closing modals
  const handleCloseModal = () => {
    setShowFriendsModal(false);
  };

  // Render the media content based on type
  const renderMedia = () => {
    if (mediaError || !imageUrl) {
      return renderNoMedia();
    }
    
    return (
      <div className="media-content">
        {/* Show loading indicator until image loads */}
        <div className="media-loading" style={{ display: mediaLoaded ? 'none' : 'flex' }}>Loading...</div>
        
        {/* Render appropriate media type */}
        {mediaType === 'video' ? (
          <video
            src={imageUrl}
            className="media-image"
            style={{ display: mediaLoaded ? 'block' : 'none' }}
            controls={false}
            autoPlay
            loop
            muted
            playsInline
            onLoadedData={() => setMediaLoaded(true)}
            onError={() => setMediaError(true)}
          />
        ) : mediaType === 'svg' ? (
          <object
            data={imageUrl}
            type="image/svg+xml"
            className="media-image"
            style={{ display: mediaLoaded ? 'block' : 'none' }}
            onLoad={() => setMediaLoaded(true)}
            onError={() => setMediaError(true)}
          >
            {renderNoMedia()}
          </object>
        ) : (
          <img
            src={imageUrl}
            alt={name || 'NFT'}
            className="media-image"
            style={{ display: mediaLoaded ? 'block' : 'none' }}
            onLoad={() => setMediaLoaded(true)}
            onError={() => setMediaError(true)}
          />
        )}
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

  // Handle image error
  const handleImageError = () => {
    console.log('Image failed to load:', imageUrl);
    setMediaLoaded(false);
  };

  // Render component for NFTs with no media
  const renderNoMedia = () => (
    <div className="no-media">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <circle cx="8.5" cy="8.5" r="1.5"></circle>
        <polyline points="21 15 16 10 5 21"></polyline>
      </svg>
      <span style={{ marginTop: '8px', fontSize: '14px', color: '#666', fontWeight: '500' }}>Media Unavailable</span>
      {imageUrl && <span style={{ fontSize: '12px', color: '#888', maxWidth: '80%', textAlign: 'center', marginTop: '4px', wordBreak: 'break-all' }}>{imageUrl.substring(0, 50)}{imageUrl.length > 50 ? '...' : ''}</span>}
    </div>
  );

  return (
    <div 
      className="nft-card" 
      onClick={onSelect}
      style={{
        backgroundColor: 'white',
        border: '1px solid #e0e0e0',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)',
        display: 'flex',
        flexDirection: 'column',
        height: 'auto',
        width: '100%',
        position: 'relative',
        cursor: onSelect ? 'pointer' : 'default'
      }}
    >
      {/* Debug toggle button */}
      <button 
        onClick={(e) => {
          e.stopPropagation();
          toggleDebug();
        }}
        style={{
          position: 'absolute',
          top: '5px',
          right: '5px',
          zIndex: 1000,
          background: 'rgba(255,0,0,0.5)',
          border: 'none',
          borderRadius: '50%',
          width: '16px',
          height: '16px',
          fontSize: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          cursor: 'pointer'
        }}
      >
        ?
      </button>

      {/* Debug overlay */}
      {showDebug && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0,0,0,0.8)',
          color: 'white',
          padding: '12px',
          fontSize: '12px',
          overflow: 'auto',
          zIndex: 200
        }}>
          <pre>{JSON.stringify(nft, null, 2)}</pre>
        </div>
      )}

      {/* Image/media container with aspect ratio */}
      <div style={{ 
        position: 'relative', 
        width: '100%',
        paddingTop: '100%', /* 1:1 Aspect ratio */
        overflow: 'hidden',
        backgroundColor: '#f8f8f8',
        flexShrink: 0,
        borderBottom: '1px solid #f0f0f0'
      }}>
        {/* Render appropriate media type */}
        {mediaError || !imageUrl ? (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f0f0f0',
            borderRadius: '0'
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <circle cx="8.5" cy="8.5" r="1.5"></circle>
              <polyline points="21 15 16 10 5 21"></polyline>
            </svg>
            <span style={{ marginTop: '8px', fontSize: '14px', color: '#666', fontWeight: '500' }}>Media Unavailable</span>
            {imageUrl && <span style={{ fontSize: '12px', color: '#888', maxWidth: '80%', textAlign: 'center', marginTop: '4px', wordBreak: 'break-all' }}>{imageUrl.substring(0, 50)}{imageUrl.length > 50 ? '...' : ''}</span>}
          </div>
        ) : (
          <>
            {/* Show loading indicator until image loads */}
            <div style={{
              position: 'absolute',
              display: mediaLoaded ? 'none' : 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              backgroundColor: '#f0f0f0',
              color: '#555',
              fontSize: '14px',
              fontWeight: '500'
            }}>Loading...</div>
            
            {mediaType === 'video' ? (
              <video
                src={imageUrl}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  objectPosition: 'center',
                  display: mediaLoaded ? 'block' : 'none',
                  backgroundColor: '#f0f0f0'
                }}
                controls={false}
                autoPlay
                loop
                muted
                playsInline
                onLoadedData={() => setMediaLoaded(true)}
                onError={() => setMediaError(true)}
              />
            ) : mediaType === 'svg' ? (
              <object
                data={imageUrl}
                type="image/svg+xml"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  objectPosition: 'center',
                  display: mediaLoaded ? 'block' : 'none',
                  backgroundColor: '#f0f0f0'
                }}
                onLoad={() => setMediaLoaded(true)}
                onError={() => setMediaError(true)}
              >
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#f0f0f0'
                }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="1.5">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                  </svg>
                  <span style={{ marginTop: '8px', fontSize: '14px', color: '#666', fontWeight: '500' }}>SVG Error</span>
                </div>
              </object>
            ) : (
              <img
          src={imageUrl}
                alt={name || 'NFT'}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  objectPosition: 'center',
                  display: mediaLoaded ? 'block' : 'none',
                  backgroundColor: '#f0f0f0'
                }}
                onLoad={() => setMediaLoaded(true)}
                onError={() => setMediaError(true)}
              />
            )}
          </>
        )}
      </div>
          
      {/* NFT info section */}
      <div style={{ 
        padding: '16px',
        paddingBottom: '24px',
        backgroundColor: 'white',
        display: 'flex',
        flexDirection: 'column',
        minHeight: '110px',
        width: '100%',
        gap: '8px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          width: '100%',
          marginBottom: '6px'
        }}>
          <h3 style={{
            fontSize: '15px',
            fontWeight: 600,
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            lineHeight: '1.3',
            color: '#333',
            padding: '4px 0'
          }} title={name}>
            {name || "Unnamed NFT"}
          </h3>
        </div>
        
        {collection && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            padding: '3px 0',
            marginBottom: '3px'
          }}>
            <p style={{
              margin: 0,
              fontSize: '13px',
              color: '#666',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '70%'
            }} title={collection}>
              {collection}
            </p>
            
            {/* Collection Friends Button */}
            {isAuthenticated && profile && collection && (
              <button 
                className="collection-friends-button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleShowFriends(e);
                }}
                style={{
                  background: '#f0f0f0',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '3px 6px',
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  fontSize: '11px',
                  color: '#555',
                  transition: 'background-color 0.2s ease',
                  flexShrink: 0,
                  marginLeft: '4px'
                }}
                aria-label="View collection friends"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '3px' }}>
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                  <circle cx="9" cy="7" r="4"></circle>
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                </svg>
                Friends
              </button>
            )}
          </div>
        )}
        
        {floorPrice && (
          <div style={{
            fontSize: '13px',
            color: '#666',
            display: 'flex',
            alignItems: 'center',
            padding: '3px 0',
            marginBottom: '3px'
          }}>
            <span style={{ fontWeight: '500' }}>Floor:</span> 
            <span style={{ marginLeft: '4px', color: '#333' }}>{floorPrice} ETH</span>
          </div>
        )}
        
        {contractAddress && (
          <div style={{
            fontSize: '11px',
            color: '#888',
            padding: '3px 0'
          }}>
            <span>{contractAddress}</span>
          </div>
        )}
      </div>
      
      {/* Friends Modal */}
      {collection && (
        <CollectionFriendsModal
          isOpen={showFriendsModal}
          onClose={handleCloseModal}
          collectionAddress={nft?.contract?.address}
          collectionName={collection}
          network={nft?.contract?.chain || 'eth'}
        />
      )}
    </div>
  );
};

export default NFTCard; 