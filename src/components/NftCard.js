import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '@farcaster/auth-kit';
import CollectionFriendsModal from './CollectionFriendsModal';
import '../styles/nft-unified.css';

/**
 * Simple NFT Card component
 * 
 * Displays an NFT with image, name, collection name, and optional price
 * Supports various media types (image, video, audio)
 * Includes collection friends button for Farcaster users
 */
const NFTCard = ({ nft }) => {
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [mediaType, setMediaType] = useState('image');
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const { isAuthenticated, profile: authProfile } = useAuth();
  const { profile } = useProfile();
  
  // Extract essential NFT data
  const name = nft?.name || nft?.title || `#${nft?.tokenId || nft?.token_id || ''}`;
  
  // Get collection name from various possible locations
  let collection = '';
  if (nft?.collection?.name) {
    collection = nft?.collection.name;
  } else if (nft?.contract?.name) {
    collection = nft.contract.name;
  } else if (nft?.contractMetadata?.name) {
    collection = nft.contractMetadata.name;
  }
  
  // Get floor price if available
  let floorPrice = null;
  if (nft?.collection?.floorPrice?.value || nft?.floorPrice?.value) {
    floorPrice = nft?.collection?.floorPrice?.value || nft?.floorPrice?.value;
  }
  
  // Find the best image URL from different possible locations
  const getImageUrl = () => {
    try {
      // Check for media array first
      if (nft?.media && nft.media.length > 0) {
        const mediaItem = nft.media[0];
        // Return gateway URL if available, otherwise raw URL
        return mediaItem.gateway || mediaItem.raw || '';
      }
      
      // Check for cached images from Alchemy
      if (nft?.image?.cachedUrl) {
        return nft.image.cachedUrl;
      }
      
      // Try various image properties
      if (nft?.image?.uri || nft?.image?.url || nft?.image) {
        const imageValue = nft.image.uri || nft.image.url || nft.image;
        // Make sure we return a string
        return typeof imageValue === 'string' ? imageValue : '';
      }
      
      // Check metadata
      if (nft?.metadata?.image) {
        const metadataImage = nft.metadata.image;
        return typeof metadataImage === 'string' ? metadataImage : '';
      }
      
      // Default placeholder
      return '';
    } catch (error) {
      console.warn('Error getting image URL:', error);
      return '';
    }
  };
  
  // Determine media type based on URL or metadata
  useEffect(() => {
    const url = getImageUrl();
    if (!url) return;
    
    // Check if url is a string before using match
    if (typeof url === 'string') {
      // Check URL file extension
      if (url.match(/\.(mp4|webm|mov)($|\?)/i)) {
        setMediaType('video');
      } else if (url.match(/\.(mp3|wav|ogg)($|\?)/i)) {
        setMediaType('audio');
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
      }
    }
  }, [nft]);
  
  // Handle media load success
  const handleMediaLoad = () => {
    setMediaLoaded(true);
  };
  
  // Handle media load error
  const handleMediaError = () => {
    setMediaError(true);
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
  
  // Get image URL
  const imageUrl = getImageUrl();
  
  // Render the media content based on type
  const renderMedia = () => {
    if (mediaError) {
      return (
        <div className="nft-media-error">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span>Failed to load</span>
        </div>
      );
    }
    
    if (!mediaLoaded) {
      return (
        <div className="nft-media-loader">
          <div className="loading-spinner"></div>
        </div>
      );
    }
    
    switch (mediaType) {
      case 'video':
        return (
          <video
            src={imageUrl}
            className="nft-media nft-video"
            controls
            loop
            muted
            onLoadedData={handleMediaLoad}
            onError={handleMediaError}
            style={{ display: mediaLoaded ? 'block' : 'none' }}
          />
        );
        
      case 'audio':
        return (
          <div className="nft-audio-container">
            <div className="nft-audio-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 6v12M6 12h12" />
              </svg>
            </div>
            <audio
              src={imageUrl}
              className="nft-audio"
              controls
              onLoadedData={handleMediaLoad}
              onError={handleMediaError}
            />
          </div>
        );
        
      case 'image':
      default:
        return (
          <img
            src={imageUrl}
            alt={name}
            className="nft-media nft-image"
            onLoad={handleMediaLoad}
            onError={handleMediaError}
            style={{ display: mediaLoaded ? 'block' : 'none' }}
          />
        );
    }
  };
  
  return (
    <div className="nft-card">
      <div className="nft-media-container">
        {renderMedia()}
      </div>
      
      <div className="nft-info">
        <div className="nft-info-header">
          <h3 className="nft-name">{name}</h3>
          
          {(isAuthenticated || profile || authProfile) && (
            <button 
              className="collection-friends-button-inline"
              aria-label="Show friends who own this collection"
              onClick={handleShowFriends}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </button>
          )}
        </div>
        
        <p className="nft-collection">{collection}</p>
        
        {floorPrice && (
          <div className="nft-price">
            <span>Floor: {floorPrice} ETH</span>
          </div>
        )}
      </div>
      
      {showFriendsModal && (
        <CollectionFriendsModal
          friends={nft.collection_friends}
          collectionName={collection}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
};

export default NFTCard; 
