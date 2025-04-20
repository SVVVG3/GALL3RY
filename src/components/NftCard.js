import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '@farcaster/auth-kit';
import '../styles/NFTCard.css';
import CollectionFriendsModal from './CollectionFriendsModal';

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
const NFTCard = ({ nft }) => {
  const { isAuthenticated, profile: authProfile } = useAuth();
  const { profile } = useProfile();
  const [media, setMedia] = useState({
    status: 'loading', // loading, loaded, error
    url: null,
    type: 'image', // image, video, or unsupported
    fallbacksExhausted: false
  });
  const [attemptCount, setAttemptCount] = useState(0);
  const [urlsAttempted, setUrlsAttempted] = useState([]);
  const [showFriendsModal, setShowFriendsModal] = useState(false);
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
  
  // Directly process a URL to make it usable
  const processUrl = (url) => {
    if (!url) return null;
    
    // Handle IPFS URLs
    if (url.startsWith('ipfs://')) {
      return `/api/image-proxy?url=${encodeURIComponent(url)}`;
    }
    
    // Handle Arweave URLs
    if (url.startsWith('ar://')) {
      return `/api/image-proxy?url=${encodeURIComponent(url)}`;
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
      return `/api/image-proxy?url=${encodeURIComponent(url)}`;
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
    
    console.log('Finding image URL for NFT:', nft);
    
    // Try media array first (Alchemy v3 API format)
    if (nft.media && Array.isArray(nft.media) && nft.media.length > 0) {
      const mediaItem = nft.media[0];
      console.log('Found media array item:', mediaItem);
      if (mediaItem.gateway) return mediaItem.gateway;
      if (mediaItem.raw) return mediaItem.raw;
      if (mediaItem.thumbnail) return mediaItem.thumbnail;
    }
    
    // Try direct image URLs (most common format)
    if (nft.image_url) {
      console.log('Found image_url:', nft.image_url);
      return nft.image_url;
    }
    
    if (typeof nft.image === 'string') {
      console.log('Found image string:', nft.image);
      return nft.image;
    }
    
    // Try image object (Alchemy structured response)
    if (nft.image && typeof nft.image === 'object') {
      console.log('Found image object:', nft.image);
      if (nft.image.cachedUrl) return nft.image.cachedUrl;
      if (nft.image.originalUrl) return nft.image.originalUrl;
      if (nft.image.pngUrl) return nft.image.pngUrl;
      if (nft.image.thumbnailUrl) return nft.image.thumbnailUrl;
      if (nft.image.gateway) return nft.image.gateway;
    }
    
    // Check animation URLs for videos
    if (nft.animation_url) {
      console.log('Found animation_url:', nft.animation_url);
      return nft.animation_url;
    }
    
    if (nft.animation && typeof nft.animation === 'object' && nft.animation.cachedUrl) {
      console.log('Found animation object:', nft.animation);
      return nft.animation.cachedUrl;
    } else if (nft.animation && typeof nft.animation === 'string') {
      return nft.animation;
    }
    
    // Check metadata locations
    if (nft.metadata) {
      console.log('Checking metadata:', nft.metadata);
      if (nft.metadata.image) return nft.metadata.image;
      if (nft.metadata.image_url) return nft.metadata.image_url;
      if (nft.metadata.animation_url) return nft.metadata.animation_url;
    }
    
    // Check raw metadata
    if (nft.raw && nft.raw.metadata) {
      console.log('Checking raw metadata:', nft.raw.metadata);
      if (nft.raw.metadata.image) return nft.raw.metadata.image;
      if (nft.raw.metadata.image_url) return nft.raw.metadata.image_url;
    }
    
    // Check other common locations
    if (nft.rawMetadata) {
      console.log('Checking rawMetadata:', nft.rawMetadata);
      if (nft.rawMetadata.image) return nft.rawMetadata.image;
      if (nft.rawMetadata.image_url) return nft.rawMetadata.image_url;
    }
    
    if (nft.thumbnail) {
      console.log('Found thumbnail:', nft.thumbnail);
      return nft.thumbnail;
    }
    
    // Check token URIs - they might contain image data
    if (nft.tokenUri && nft.tokenUri.gateway) {
      console.log('Found tokenUri gateway:', nft.tokenUri.gateway);
      return nft.tokenUri.gateway;
    }
    
    // If all else fails, try to generate an Alchemy NFT CDN URL if we have contract and token ID
    if (contractAddress && tokenId) {
      const alchemyUrl = `https://nft-cdn.alchemy.com/eth-mainnet/${contractAddress}/${tokenId}`;
      console.log('Generated Alchemy URL:', alchemyUrl);
      return alchemyUrl;
    }
    
    // If nothing found, return null
    console.warn('No image URL found for NFT:', nft);
    return null;
  };
  
  // Load media on mount or when nft changes
  useEffect(() => {
    // Reset state for new NFT
    setAttemptCount(0);
    setUrlsAttempted([]);
    setMedia({
      status: 'loading',
      url: null,
      type: 'image',
      fallbacksExhausted: false
    });
    
    console.log('NFTCard: Loading media for', nft?.name || nft?.title || 'unknown NFT');
    
    const imageUrl = findBestImageUrl(nft);
    console.log('NFTCard: Found image URL:', imageUrl);
    
    if (!imageUrl) {
      console.warn('NFTCard: No image URL found');
      setMedia({
        status: 'error',
        url: '/assets/placeholder-nft.svg',
        type: 'image',
        fallbacksExhausted: true
      });
      return;
    }
    
    const processedUrl = processUrl(imageUrl);
    const mediaType = getMediaType(imageUrl);
    
    // Set status as 'loaded' immediately to trigger rendering of the actual media element
    setMedia({
      status: 'loaded', 
      url: processedUrl,
      type: mediaType,
      fallbacksExhausted: false
    });
    
    // Cleanup function
    return () => {
      mountedRef.current = false;
    };
  }, [nft]);

  // After mount, set mounted ref to true
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  
  const handleMediaLoad = () => {
    if (!mountedRef.current) return;
    
    console.log(`Media loaded successfully: ${media.url}`);
    // We don't need to set the status to 'loaded' again - it causes a re-render loop
    // since we only render <img> when status is already 'loaded'
  };

  const handleMediaError = () => {
    if (!mountedRef.current) return;
    
    console.warn(`Error loading media (attempt ${attemptCount + 1}): ${media.url}`);
    
    // Add current URL to attempted list
    setUrlsAttempted(prev => [...prev, media.url]);
    
    // Increment attempt counter
    const newAttemptCount = attemptCount + 1;
    setAttemptCount(newAttemptCount);
    
    // Try next fallback strategy if we haven't exhausted them
    if (newAttemptCount < 3) {
      // For the first failure, try with a different format for Alchemy URLs
      if (media.url && media.url.includes('nft-cdn.alchemy.com')) {
        let fixedUrl;
        if (media.url.includes('/original')) {
          // Remove /original and try with /thumb
          fixedUrl = media.url.replace('/original', '/thumb');
        } else if (!media.url.includes('/thumb')) {
          // Add /original
          fixedUrl = `${media.url.includes('?') ? media.url.split('?')[0] : media.url}/original${media.url.includes('?') ? '?' + media.url.split('?')[1] : ''}`;
        }
        
        if (fixedUrl && fixedUrl !== media.url && !urlsAttempted.includes(fixedUrl)) {
          console.log(`Trying alternative Alchemy format: ${fixedUrl}`);
          setMedia({
            status: 'loading',
            url: fixedUrl,
            type: getMediaType(fixedUrl),
            fallbacksExhausted: false
          });
          return;
        }
      }
      
      // Try direct URL if we're using a proxy
      if (media.url && media.url.includes('/api/image-proxy')) {
        try {
          // Extract the original URL
          const originalUrl = new URL(media.url, window.location.origin).searchParams.get('url');
          if (originalUrl && !urlsAttempted.includes(originalUrl)) {
            console.log(`Trying direct URL: ${originalUrl}`);
            // For some URLs it's safer to try without the proxy
            if (originalUrl.includes('ipfs.io') || 
                originalUrl.includes('cloudflare-ipfs.com') ||
                originalUrl.includes('nftstorage.link')) {
              setMedia({
                status: 'loading',
                url: originalUrl,
                type: getMediaType(originalUrl),
                fallbacksExhausted: false
              });
              return;
            }
          }
        } catch (e) {
          console.error('Error extracting URL param:', e);
        }
      }
      
      // If we have the original URL, try adding more proxy layers
      const rawUrl = findBestImageUrl(nft);
      if (rawUrl && !urlsAttempted.includes(`/api/image-proxy?url=${encodeURIComponent(rawUrl)}`)) {
        const forcedProxyUrl = `/api/image-proxy?url=${encodeURIComponent(rawUrl)}`;
        console.log(`Trying forced proxy URL: ${forcedProxyUrl}`);
        setMedia({
          status: 'loading',
          url: forcedProxyUrl,
          type: getMediaType(rawUrl),
          fallbacksExhausted: false
        });
        return;
      }
    }
    
    // If we get here, all our strategies have failed
    console.error(`Failed to load image after ${newAttemptCount} attempts, using placeholder`);
    setMedia({
      status: 'error',
      url: `${window.location.origin}/assets/placeholder-nft.svg`,
      type: 'image',
      fallbacksExhausted: true
    });
  };
  
  const handleShowFriends = (e) => {
    e.preventDefault(); // Prevent link navigation
    e.stopPropagation(); // Prevent event bubbling
    setShowFriendsModal(true);
  };
  
  const handleCloseFriendsModal = () => {
    setShowFriendsModal(false);
  };
  
  // Enhanced check for user authentication across all environments
  // Check if user is authenticated with Farcaster OR through Mini App auth
  const userFid = profile?.fid || authProfile?.fid;
  const isAuthValid = isAuthenticated && !!authProfile;
  // Always show friends button if we have a contract address
  const showFriendsButton = contractAddress ? true : false;

  console.log('NFTCard auth state:', { 
    isAuthenticated, 
    hasAuthProfile: !!authProfile, 
    hasFarcasterProfile: !!profile,
    userFid,
    showFriendsButton 
  });
  
  return (
    <>
      <div className="nft-card" style={{ minHeight: '250px' }}>
        <Link to={`/nft/${contractAddress}/${tokenId}`} className="nft-link">
          <div className="nft-image" style={{ minHeight: '200px', position: 'relative' }}>
            {media.status === 'loading' && (
              <div className="nft-image-loading">
                <div className="loading-indicator"></div>
                <span>Loading...</span>
              </div>
            )}
            
            {media.type === 'image' && (
              <img
                src={media.url}
                alt={title}
                className={`nft-image-content ${media.status === 'loaded' ? 'loaded' : ''}`}
                onLoad={handleMediaLoad}
                onError={handleMediaError}
                loading="lazy"
                crossOrigin="anonymous"
                referrerPolicy="no-referrer"
                style={{ 
                  display: 'block', 
                  visibility: 'visible', 
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover'
                }}
              />
            )}
            
            {media.type === 'video' && (
              <video
                src={media.url}
                className="nft-video-content loaded"
                muted
                loop
                autoPlay
                playsInline
                onLoadedData={handleMediaLoad}
                onError={handleMediaError}
                crossOrigin="anonymous"
                style={{ display: 'block', visibility: 'visible' }}
              />
            )}
            
            {media.status === 'error' && (
              <div className="nft-image-error">
                <img 
                  src={`${window.location.origin}/assets/placeholder-nft.svg`}
                  alt={`${title} (unavailable)`}
                  className="nft-image-placeholder"
                />
              </div>
            )}
          </div>
          
          <div className="nft-details">
            <div className="nft-info">
              <h3 className="nft-name">{title}</h3>
              {collection && <p className="collection-name">{collection}</p>}
            </div>
            
            {/* Add Collection Friends button for Farcaster users */}
            {showFriendsButton && (
              <button 
                className="collection-friends-button" 
                onClick={handleShowFriends}
                title="Show friends who own this collection"
              >
                <svg 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg"
                  style={{
                    display: 'block',
                    fill: 'none',
                    stroke: 'currentColor'
                  }}
                >
                  <path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{fill: 'none', strokeWidth: 2}}/>
                  <path d="M9 11C11.2091 11 13 9.20914 13 7C13 4.79086 11.2091 3 9 3C6.79086 3 5 4.79086 5 7C5 9.20914 6.79086 11 9 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{fill: 'none', strokeWidth: 2}}/>
                  <path d="M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{fill: 'none', strokeWidth: 2}}/>
                  <path d="M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89318 18.7122 8.75608 18.1676 9.45769C17.623 10.1593 16.8604 10.6597 16 10.88" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{fill: 'none', strokeWidth: 2}}/>
                </svg>
              </button>
            )}
          </div>
        </Link>
      </div>
      
      {/* Render modal outside the NFT card container */}
      {showFriendsModal && (
        <CollectionFriendsModal
          isOpen={showFriendsModal}
          onClose={handleCloseFriendsModal}
          contractAddress={contractAddress}
          collectionName={collection}
        />
      )}
    </>
  );
};

export default NFTCard; 
