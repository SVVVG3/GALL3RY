import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '@farcaster/auth-kit';
import '../styles/nft-unified.css';
import CollectionFriendsModal from './CollectionFriendsModal';
import NFTImage from './NFTImage';

/**
 * Enhanced NFT Card component with better image loading and error handling
 * 
 * Features:
 * - Robust fallback system for image loading
 * - Better error handling
 * - Comprehensive URL detection from various NFT sources
 * - Support for image and video content
 * - Collection friends button for Farcaster users
 */
const NFTCard = (props) => {
  const { nft, showFriends = false, interactive = true, onSelect, onDoubleClick, enableGalleryView, selected } = props;
  const { isAuthenticated, profile: authProfile } = useAuth();
  const { profile } = useProfile();
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [modalContractAddress, setModalContractAddress] = useState(null);
  const [mediaError, setMediaError] = useState(false);
  const mountedRef = useRef(true);

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
    
    // Try direct image URLs (most common format)
    if (nft.image_url) return nft.image_url;
    if (typeof nft.image === 'string') return nft.image;
    
    // Try image object (Alchemy structured response)
    if (nft.image && typeof nft.image === 'object') {
      if (nft.image.cachedUrl) return nft.image.cachedUrl;
      if (nft.image.originalUrl) return nft.image.originalUrl;
      if (nft.image.pngUrl) return nft.image.pngUrl;
      if (nft.image.thumbnailUrl) return nft.image.thumbnailUrl;
      if (nft.image.gateway) return nft.image.gateway;
    }
    
    // Check animation URLs for videos
    if (nft.animation_url) return nft.animation_url;
    if (nft.animation && typeof nft.animation === 'object' && nft.animation.cachedUrl) {
      return nft.animation.cachedUrl;
    } else if (nft.animation && typeof nft.animation === 'string') {
      return nft.animation;
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
    
    if (nft.thumbnail) return nft.thumbnail;
    
    // Check token URIs - they might contain image data
    if (nft.tokenUri && nft.tokenUri.gateway) return nft.tokenUri.gateway;
    
    // If all else fails, try to generate an Alchemy NFT CDN URL if we have contract and token ID
    if (contractAddress && tokenId) {
      return `https://nft-cdn.alchemy.com/eth-mainnet/${contractAddress}/${tokenId}`;
    }
    
    return null;
  };
  
  const imageUrl = findBestImageUrl(nft);
  
  const handleMediaError = () => {
    setMediaError(true);
  };
  
  const handleShowFriends = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!showFriends || !isAuthenticated) return;
    
    setModalContractAddress(contractAddress);
    setShowFriendsModal(true);
  };
  
  const handleCloseFriendsModal = () => {
    setShowFriendsModal(false);
  };

  const handleCardClick = () => {
    if (onSelect) {
      onSelect(nft);
    }
  };

  const handleCardDoubleClick = () => {
    if (onDoubleClick) {
      onDoubleClick(nft);
    }
  };

  return (
    <div 
      className={`nft-card-container ${selected ? 'selected' : ''} ${interactive ? 'interactive' : ''}`}
      onClick={handleCardClick}
      onDoubleClick={handleCardDoubleClick}
    >
      <div className="nft-image-container">
        <NFTImage
          nft={nft}
          src={imageUrl}
          alt={title}
          className="nft-image"
          handleMediaError={handleMediaError}
          noHoverEffect={!interactive}
        />
        
        {showFriends && isAuthenticated && (profile || authProfile) && (
          <button 
            className="collection-friends-button"
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
        
        {enableGalleryView && (
          <Link
            className="view-gallery-link"
            to={`/nft/${contractAddress}/${tokenId}`}
            onClick={(e) => e.stopPropagation()}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="16"></line>
              <line x1="8" y1="12" x2="16" y2="12"></line>
            </svg>
          </Link>
        )}
      </div>
      
      <div className="nft-details">
        <h3 className="nft-title">{title}</h3>
        {collection && <p className="nft-collection">{collection}</p>}
      </div>
      
      {showFriendsModal && (
        <CollectionFriendsModal
          contractAddress={modalContractAddress}
          onClose={handleCloseFriendsModal}
          collectionName={collection}
        />
      )}
    </div>
  );
};

export default NFTCard; 
