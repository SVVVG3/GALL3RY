import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '@farcaster/auth-kit';
import '../styles/nft-unified.css';
import CollectionFriendsModal from './CollectionFriendsModal';
import { createPortal } from 'react-dom';
import NFTImage from './NFTImage';

// Define keyframes for spinner animation
const spinKeyframes = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

/**
 * Function to find the best image URL from an NFT object
 * Searches through various metadata locations to find a suitable image
 */
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
  
  // If all else fails, return null (will show placeholder)
  return null;
};

/**
 * Find an alternative image URL when the primary one fails
 */
const findAlternativeImageUrl = (nft, attemptedUrls) => {
  if (!nft) return null;
  
  // Sources to try in order of preference
  const possibleSources = [
    // Direct sources
    nft.image_url,
    typeof nft.image === 'string' ? nft.image : null,
    
    // Object sources - extract potential URLs
    nft.image?.cachedUrl,
    nft.image?.originalUrl,
    nft.image?.pngUrl,
    nft.image?.thumbnailUrl,
    nft.image?.gateway,
    
    // Media array sources
    ...(nft.media && Array.isArray(nft.media) ? 
      nft.media.flatMap(m => [m.gateway, m.raw, m.thumbnail]) : []),
    
    // Animation sources
    nft.animation_url,
    nft.animation?.cachedUrl,
    typeof nft.animation === 'string' ? nft.animation : null,
    
    // Metadata sources
    nft.metadata?.image,
    nft.metadata?.image_url,
    nft.metadata?.animation_url,
    
    // Token URI source
    nft.tokenUri?.gateway,
    
    // Other sources
    nft.thumbnail,
    nft.raw?.metadata?.image,
    nft.raw?.metadata?.image_url,
    nft.rawMetadata?.image,
    nft.rawMetadata?.image_url
  ];
  
  // Filter out null/undefined values and URLs already attempted
  return possibleSources
    .filter(url => url && !attemptedUrls.includes(url))
    .find(url => url); // Return the first valid URL
};

/**
 * Extract collection name from NFT metadata
 */
const getNftCollectionName = (nft) => {
  if (!nft) return '';
  
  // Try various possible collection name locations in NFT metadata
  if (nft.contract && nft.contract.name) {
    return nft.contract.name;
  }
  
  if (nft.collection && nft.collection.name) {
    return nft.collection.name;
  }
  
  if (nft.contractMetadata && nft.contractMetadata.name) {
    return nft.contractMetadata.name;
  }
  
  if (nft.contract_name) {
    return nft.contract_name;
  }
  
  if (nft.contractName) {
    return nft.contractName;
  }
  
  return '';
};

/**
 * VercelNFTCard - Production-optimized NFT card component
 * Specifically designed for Vercel deployment to solve image loading issues
 */
const VercelNFTCard = (props) => {
  const { nft, showFriends = false, interactive = true, onSelect, onDoubleClick, enableGalleryView, selected } = props;
  const { isAuthenticated } = useAuth();
  const { profile } = useProfile();
  const [media, setMedia] = useState(null);
  const [mediaStatus, setMediaStatus] = useState('loading');
  const [attemptCount, setAttemptCount] = useState(0);
  const [urlsAttempted, setUrlsAttempted] = useState([]);
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [modalContractAddress, setModalContractAddress] = useState(null);
  const [modalNetwork, setModalNetwork] = useState('eth'); // Add state for network
  const cardRef = useRef(null);
  
  useEffect(() => {
    console.log('VercelNFTCard rendering NFT:', nft);
    if (nft && nft.debugId) {
      console.log(`Debug ID: ${nft.debugId}`, nft);
    }
    
    // Reset state when NFT changes
    if (nft) {
      setAttemptCount(0);
      setUrlsAttempted([]);
      setMedia(null);
      setMediaStatus('loading');
      
      // Get best image source
      const initialSource = findBestImageUrl(nft);
      if (initialSource) {
        setMedia({ src: initialSource, type: getMediaType(initialSource) });
      }
    }
  }, [nft]);

  // Handle media loading error by trying another source
  const handleMediaError = () => {
    console.warn(`Media error in VercelNFTCard for ${nft?.name || nft?.title || 'Unknown NFT'}, attempt ${attemptCount + 1}`);
    setMediaStatus('error');
    
    // Try another source if available
    const nextSource = findAlternativeImageUrl(nft, urlsAttempted);
    if (nextSource && !urlsAttempted.includes(nextSource)) {
      console.log('Trying alternative source:', nextSource);
      setAttemptCount(prev => prev + 1);
      setUrlsAttempted(prev => [...prev, nextSource]);
      setMedia({ src: nextSource, type: getMediaType(nextSource) });
      setMediaStatus('loading');
    } else {
      console.error('No more alternative sources available');
    }
  };

  const handleMediaLoad = () => {
    console.log(`Media loaded successfully for ${nft?.name || nft?.title || 'Unknown NFT'}`);
    setMediaStatus('loaded');
  };

  // Function to determine media type based on URL
  const getMediaType = (url) => {
    if (!url) return 'image';
    try {
      const fileExt = url.split('.').pop().toLowerCase();
      if (['mp4', 'webm', 'mov'].includes(fileExt)) {
        return 'video';
      } else if (['mp3', 'wav', 'ogg'].includes(fileExt)) {
        return 'audio';
      }
      return 'image';
    } catch (e) {
      return 'image';
    }
  };

  const handleFriendsClick = (e) => {
    e.stopPropagation();
    setShowFriendsModal(true);
  };

  if (!nft) {
    return (
      <div className="nft-card-container empty">
        <div className="nft-card">
          <div className="nft-placeholder">NFT</div>
        </div>
      </div>
    );
  }

  const title = nft.name || nft.title || 'NFT';
  const collection = nft.collection_name || getNftCollectionName(nft);
  const cardClasses = `nft-card-container ${nft.debugId ? 'debug-card' : ''} ${selected ? 'selected' : ''}`;
  
  return (
    <>
      <div 
        className={cardClasses}
        onClick={() => onSelect && onSelect(nft)}
        onDoubleClick={() => onDoubleClick && onDoubleClick(nft)}
      >
        <div className="nft-card">
          <div className="nft-image-container">
            {media?.src ? (
              <NFTImage 
                nft={nft}
                src={media.src}
            alt={title}
                className="nft-media"
            onLoad={handleMediaLoad}
                handleMediaError={handleMediaError}
              />
            ) : (
              <div className="nft-placeholder">Loading NFT...</div>
            )}
            
            {nft.debugId && process.env.NODE_ENV !== 'production' && (
              <div className="debug-overlay">
                ID: {nft.debugId}
                <br/>
                {collection}
          </div>
        )}
      </div>
      
          <div className="nft-info">
            <div className="nft-title" title={title}>
              {title}
            </div>
            <div className="nft-collection">{collection}</div>
          </div>
          
          {showFriends && nft.collection_friends && nft.collection_friends.length > 0 && (
            <button className="friends-button" onClick={handleFriendsClick}>
              <svg 
                width="18" 
                height="18" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              {nft.collection_friends.length}
            </button>
          )}
          
          {interactive && enableGalleryView && (
            <button className="gallery-view-button" onClick={(e) => {
              e.stopPropagation();
              enableGalleryView(nft);
            }}>
              View
            </button>
          )}
        </div>
      </div>
      
      {showFriendsModal && (
            <CollectionFriendsModal
          friends={nft.collection_friends}
          collectionName={collection}
          onClose={() => setShowFriendsModal(false)}
        />
      )}
    </>
  );
};

// Optimize VercelNFTCard with React.memo to prevent unnecessary rerenders in virtualized list
export default React.memo(VercelNFTCard, (prevProps, nextProps) => {
  // Only rerender if the NFT has changed
  // This significantly improves performance in virtualized lists
  return prevProps.nft?.uniqueId === nextProps.nft?.uniqueId;
}); 