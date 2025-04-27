import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '@farcaster/auth-kit';
import CollectionFriendsModal from './CollectionFriendsModal';
import { getProxiedUrl, getReliableIpfsUrl, getBestImageUrl } from '../services/proxyService';
import '../styles/nft-unified.css';
import { formatAddress, shortenAddress } from '../utils/formatters';
import { FaExternalLinkAlt, FaPlay } from 'react-icons/fa';
import alchemyService from '../services/alchemyService';
import { SUPPORTED_CHAINS } from '../services/alchemyService';

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
  const { isAuthenticated, profile } = useAuth();
  const [imageUrl, setImageUrl] = useState('');
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [isSvg, setIsSvg] = useState(false);
  const [videoType, setVideoType] = useState(null);
  const [hasMedia, setHasMedia] = useState(false);
  
  // Handle null or invalid NFT data
  if (!nft) {
    console.error('NFTCard received null or undefined NFT');
    return null;
  }
  
  // Log NFT data for debugging
  console.log('Rendering NFT card for:', nft.name || 'Unnamed NFT');
  
  // Extract NFT details
  const name = nft?.title || nft?.name || nft?.tokenId && `#${nft.tokenId}` || 'Unnamed NFT';
  const collection = nft?.collectionName || nft?.collection?.name || nft?.contract?.name || '';
  // Don't extract floorPrice here as it's handled below
  const contractAddress = nft?.contract?.address || '';
  const tokenId = nft?.tokenId || nft?.token_id;
  
  // Determine the blockchain network from multiple possible sources
  // Look for any properties that might indicate what chain/network the NFT is on
  const chainId = nft?.chainId || nft?.contract?.chainId || nft?.chain;
  let detectedNetwork = nft?.contract?.chain || nft?.network;
  
  // If we have a chainId but no explicit network name, try to map it
  if (!detectedNetwork && chainId) {
    detectedNetwork = getNetworkFromChainId(chainId);
  }
  
  // Default to Ethereum if we couldn't determine the network
  const network = detectedNetwork || 'eth';
  
  // Debug logging for network information
  console.log('NFTCard - Network information:', {
    nftId: name,
    contractAddress,
    contractChain: nft?.contract?.chain,
    chainId,
    detectedNetwork,
    resolvedNetwork: network,
    fullContract: nft?.contract || 'No contract data'
  });
  
  // Get floor price if available
  let floorPrice = null;
  try {
    if (nft?.floorPrice?.formatted) {
      floorPrice = nft.floorPrice.formatted;
    } else if (nft?.floor_price) {
      floorPrice = nft.floor_price;
    } else if (nft?.collection?.floorPrice?.value || nft?.floorPrice?.value) {
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
            setVideoType('video');
          } else if (bestUrl.match(/\.(mp3|wav|ogg)($|\?)/i) || bestUrl.includes('audio/')) {
            setVideoType('audio');
          } else if (bestUrl.match(/\.svg($|\?)/i) || bestUrl.includes('image/svg+xml')) {
            setIsSvg(true);
          } else {
            setVideoType('image');
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
        {videoType === 'video' ? (
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
        ) : videoType === 'svg' ? (
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
        setVideoType('svg');
      }
    }
  }, [imageUrl]);
  
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
        {videoType === 'video' ? (
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
        ) : videoType === 'svg' ? (
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
      </div>
          
      {/* NFT info section */}
      <div style={{ 
        padding: '16px',
        paddingBottom: '12px',
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
              maxWidth: '100%'
            }} title={collection}>
              {collection}
            </p>
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
        
        {/* Friends Holding Button - Always show if user is authenticated */}
        {isAuthenticated && profile && collection && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            padding: '3px 0',
            marginTop: '6px',
            marginBottom: '14px'
          }}>
            <button 
              className="collection-friends-button"
              onClick={(e) => {
                e.stopPropagation();
                handleShowFriends(e);
              }}
              style={{
                background: '#8b5cf6',
                border: 'none',
                borderRadius: '6px',
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '500',
                color: 'white',
                transition: 'all 0.2s ease',
                boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#7c3aed'}
              onMouseOut={(e) => e.currentTarget.style.background = '#8b5cf6'}
              aria-label="View collection friends"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '4px' }}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
              Friends Holding
            </button>
          </div>
        )}
      </div>
      
      {/* Friends Modal */}
      {collection && (
        <CollectionFriendsModal
          isOpen={showFriendsModal}
          onClose={handleCloseModal}
          collectionAddress={contractAddress}
          collectionName={collection}
          network={network}
        />
      )}
    </div>
  );
};

// Helper function to get network from chainId or other identifiers
const getNetworkFromChainId = (chainId) => {
  if (!chainId) return 'eth';
  
  // Convert numeric chainId to string
  const chainIdStr = String(chainId).toLowerCase();
  
  // Map common chainIds to network names
  const chainMap = {
    '1': 'eth',
    '137': 'polygon',
    '10': 'optimism',
    '42161': 'arbitrum',
    '8453': 'base',
    '7777777': 'zora'
  };
  
  // Check if it's one of the numeric chain IDs
  if (chainMap[chainIdStr]) {
    return chainMap[chainIdStr];
  }
  
  // If not numeric, check if it's already a valid network name
  const validNetworks = ['eth', 'ethereum', 'polygon', 'matic', 'arbitrum', 'arb', 'optimism', 'opt', 'base', 'zora'];
  if (validNetworks.includes(chainIdStr)) {
    // Map to standardized network name
    const networkMap = {
      'ethereum': 'eth',
      'matic': 'polygon',
      'arb': 'arbitrum',
      'opt': 'optimism'
    };
    return networkMap[chainIdStr] || chainIdStr;
  }
  
  // Default to eth if nothing matched
  return 'eth';
};

export default NFTCard; 