import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '@farcaster/auth-kit';
import '../styles/modal.css';
import '../styles/CollectionFriendsModal.css';

// Define keyframes for spinner animation
const spinKeyframes = `
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

/**
 * VercelNFTCard - Production-optimized NFT card component
 * Specifically designed for Vercel deployment to solve image loading issues
 */
const VercelNFTCard = ({ nft }) => {
  const { isAuthenticated } = useAuth();
  const { profile } = useProfile();
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [debugMediaUrl, setDebugMediaUrl] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState('image'); // 'image', 'video', or 'unsupported'
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  
  // Friends modal states
  const [isLoadingFriends, setIsLoadingFriends] = useState(true);
  const [friendsError, setFriendsError] = useState(null);
  const [friends, setFriends] = useState([]);
  const [totalFriends, setTotalFriends] = useState(0);
  const [usingMockData, setUsingMockData] = useState(false);
  
  // Extract NFT details with fallbacks
  const rawTitle = nft?.metadata?.name || nft?.name || nft?.title || `#${nft?.tokenId || nft?.token_id || ''}`;
  
  // Clean the title by removing "NFT" prefix
  const title = rawTitle.replace(/^NFT\s+#/i, '#');
  const collection = nft?.collection?.name || nft?.collection_name || nft?.contractMetadata?.name || '';
  
  // Extract NFT value information with fallbacks
  const floorPrice = nft?.collection?.floorPrice;
  const valueUsd = floorPrice?.valueUsd || 
                   nft?.floorPrice?.valueUsd || 
                   nft?.contractMetadata?.openSea?.floorPrice || 
                   nft?.contract?.openSeaMetadata?.floorPrice || 
                   null;
  const valueEth = floorPrice?.value || 
                   nft?.floorPrice?.value || 
                   (valueUsd ? (valueUsd / 2000) : null); // Rough ETH conversion if only USD is available
  
  // Format the value for display - show USD values in ETH format with 4 decimal places
  const formattedValue = useMemo(() => {
    if (valueUsd) {
      // For all values, use fixed format with 4 decimal places
      // Don't convert, just display as ETH (this is what the user wants)
      return `${parseFloat(valueUsd).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} ETH`;
    } else if (valueEth) {
      // If we actually have ETH values, use those directly
      return `${parseFloat(valueEth).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} ETH`;
    }
    return null;
  }, [valueUsd, valueEth]);
  
  // Log value data for debugging (only in dev and only for first few NFTs)
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' && title.includes('NFT #1') || title.includes('NFT #2')) {
      console.log(`Value data for ${title}:`, {
        valueUsd,
        valueEth,
        formattedValue,
        paths: {
          collectionFloorPriceUsd: nft?.collection?.floorPrice?.valueUsd,
          directFloorPriceUsd: nft?.floorPrice?.valueUsd,
          openSeaFloorPrice: nft?.contractMetadata?.openSea?.floorPrice,
          openSeaMetadataFloorPrice: nft?.contract?.openSeaMetadata?.floorPrice,
          collectionFloorPriceEth: nft?.collection?.floorPrice?.value,
          directFloorPriceEth: nft?.floorPrice?.value
        }
      });
    }
  }, [title, nft, valueUsd, valueEth, formattedValue]);
  
  // Get contract address and token ID
  const contractAddress = 
    nft?.contract?.address || 
    nft?.contractAddress || 
    nft?.contract_address || 
    (nft?.id?.split && nft?.id?.includes(':') ? nft?.id?.split(':')[2] : '');
  
  const tokenId = 
    nft?.tokenId || 
    nft?.token_id || 
    (nft?.id?.split && nft?.id?.includes(':') ? nft?.id?.split(':')[3] : '');

  // Detect media type based on URL or metadata
  const getMediaType = (url) => {
    if (!url) return 'image';
    
    // Check file extension in URL
    if (url.match(/\.(mp4|webm|mov)($|\?)/i)) {
      return 'video';
    }
    
    if (url.match(/\.(mp3|wav|ogg)($|\?)/i)) {
      return 'audio';
    }
    
    // Check NFT metadata for animation or video indicators
    if (nft?.metadata?.animation_type === 'video' || 
        nft?.animation_type === 'video' ||
        (nft?.metadata?.properties?.category === 'video')) {
      return 'video';
    }
    
    // Default to image
    return 'image';
  };

  // Use useEffect to get and set the image URL only once per NFT change
  useEffect(() => {
    // Function to find best media URL with fallbacks
    const getMediaUrl = () => {
      let foundUrl = "";
      let source = "";
      
      // First try animation URL for video content
      if (nft?.animation_url) {
        foundUrl = nft.animation_url;
        source = "animation_url";
      } 
      // Then try metadata animation URL
      else if (nft?.metadata?.animation_url) {
        foundUrl = nft.metadata.animation_url;
        source = "metadata.animation_url";
      }
      // Then try Alchemy's media array format
      else if (nft?.media && Array.isArray(nft.media) && nft.media.length > 0) {
        const mediaItem = nft.media[0];
        console.log("Found media array item:", mediaItem);
        if (mediaItem.gateway) {
          foundUrl = mediaItem.gateway;
          source = "media.gateway";
        } else if (mediaItem.raw) {
          foundUrl = mediaItem.raw;
          source = "media.raw";
        }
      }
      // Try direct image URL strings
      else if (nft?.image_url) {
        foundUrl = nft.image_url;
        source = "image_url";
      }
      else if (typeof nft?.image === 'string') {
        foundUrl = nft.image;
        source = "image string";
      }
      // Try Alchemy's image object format
      else if (nft?.image && typeof nft.image === 'object') {
        console.log("Looking in image object");
        if (nft.image.cachedUrl) {
          foundUrl = nft.image.cachedUrl;
          source = "image.cachedUrl";
        } else if (nft.image.originalUrl) {
          foundUrl = nft.image.originalUrl;
          source = "image.originalUrl";
        } else if (nft.image.gateway) {
          foundUrl = nft.image.gateway;
          source = "image.gateway";
        } else if (nft.image.url) {
          foundUrl = nft.image.url;
          source = "image.url";
        }
      }
      // Try metadata
      else if (nft?.metadata?.image) {
        foundUrl = nft.metadata.image;
        source = "metadata.image";
      }
      // Last resort - direct Alchemy CDN
      else if (contractAddress && tokenId) {
        foundUrl = `https://nft-cdn.alchemy.com/eth-mainnet/${contractAddress}/${tokenId}`;
        source = "alchemy direct";
      }
      
      console.log(`Media URL found from ${source}: ${foundUrl}`);
      return { url: foundUrl, source };
    };

    // Generate the safest URL for production
    const getProxyUrl = (url) => {
      if (!url) {
        console.log("No URL to proxy, using placeholder");
        return "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIiB2aWV3Qm94PSIwIDAgMzAwIDMwMCI+PHJlY3Qgd2lkdGg9IjMwMCIgaGVpZ2h0PSIzMDAiIGZpbGw9IiNmMGYwZjAiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNjY2Ij5JbWFnZSB1bmF2YWlsYWJsZTwvdGV4dD48L3N2Zz4=";
      }
      
      // Special case for Alchemy CDN URLs - use direct URL with API key
      if (url.includes('nft-cdn.alchemy.com')) {
        const apiKey = process.env.REACT_APP_ALCHEMY_API_KEY || '-DhGb2lvitCWrrAmLnF5TZLl-N6l8Lak';
        if (!url.includes('apiKey=') && apiKey) {
          const urlWithKey = `${url}${url.includes('?') ? '&' : '?'}apiKey=${apiKey}`;
          console.log("Using direct Alchemy URL with API key");
          return urlWithKey;
        }
      }
      
      // Always use API proxy for external images
      if (url.startsWith('http') || url.startsWith('ipfs://')) {
        const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(url)}`;
        console.log(`Proxying through: ${proxyUrl}`);
        return proxyUrl;
      }
      
      return url;
    };

    // Get the media URL and save it to state
    const { url } = getMediaUrl();
    setDebugMediaUrl(url);
    
    // Set the media type based on URL or metadata
    const type = getMediaType(url);
    setMediaType(type);
    
    // Get the proxied URL
    const proxiedUrl = getProxyUrl(url);
    setMediaUrl(proxiedUrl);
    
    // Reset loading state when NFT changes
    setMediaLoaded(false);
    setMediaError(false);
    
  }, [nft, contractAddress, tokenId, getMediaType]); // Added getMediaType to dependency array
  
  // Safety fallback for placeholders
  const placeholderUrl = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIiB2aWV3Qm94PSIwIDAgMzAwIDMwMCI+PHJlY3Qgd2lkdGg9IjMwMCIgaGVpZ2h0PSIzMDAiIGZpbGw9IiNmMGYwZjAiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNjY2Ij5JbWFnZSB1bmF2YWlsYWJsZTwvdGV4dD48L3N2Zz4=";
  
  // Log the final URL being used
  useEffect(() => {
    console.log(`NFT ${title}: Using final media URL: ${mediaUrl} (type: ${mediaType})`);
    console.log(`Loading state: ${mediaLoaded ? 'Loaded' : 'Loading'}, Error state: ${mediaError ? 'Error' : 'No Error'}`);
  }, [mediaUrl, mediaLoaded, mediaError, title, mediaType]);
  
  // Handle media load success
  const handleMediaLoad = () => {
    console.log(`Media loaded successfully: ${mediaUrl}`);
    setMediaLoaded(true);
    setMediaError(false);
  };
  
  // Handle media load error
  const handleMediaError = () => {
    console.log(`Media load error: ${mediaUrl}`);
    setMediaError(true);
    setMediaLoaded(true); // Consider it "loaded" but with error
  };
  
  // New useEffect to debug the DOM and fix rendering issues
  useEffect(() => {
    if (mediaLoaded) {
      // Wait a short time after load to check the DOM
      const checkTimer = setTimeout(() => {
        try {
          // Find all media elements in this component
          const mediaElements = document.querySelectorAll('.nft-image-content, .nft-video-content, .nft-audio-content');
          
          // Force fix any hidden elements
          mediaElements.forEach(el => {
            const computedStyle = window.getComputedStyle(el);
            const isHidden = computedStyle.display === 'none' || 
                            computedStyle.visibility === 'hidden' || 
                            computedStyle.opacity === '0';
            
            if (isHidden) {
              console.warn('Found hidden media element, forcing display:', el);
              el.style.cssText = `
                display: block !important;
                visibility: visible !important;
                opacity: 1 !important;
                z-index: 999 !important;
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                height: 100% !important;
              `;
            }
          });
        } catch (e) {
          console.error('Error checking media elements:', e);
        }
      }, 500);
      
      return () => clearTimeout(checkTimer);
    }
  }, [mediaLoaded]);
  
  // Handle showing friends modal
  const handleShowFriends = (e) => {
    e.preventDefault(); // Prevent link navigation
    e.stopPropagation(); // Prevent event bubbling
    setShowFriendsModal(true);
    
    // Fetch friends data when modal is opened
    if (contractAddress && profile?.fid) {
      fetchCollectionFriends();
    }
  };
  
  const handleCloseFriendsModal = () => {
    setShowFriendsModal(false);
  };
  
  // Close modal when user hits escape key
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape' && showFriendsModal) {
        handleCloseFriendsModal();
      }
    };

    window.addEventListener('keydown', handleEscKey);
    return () => {
      window.removeEventListener('keydown', handleEscKey);
    };
  }, [showFriendsModal]);
  
  // Generate mock friends data for fallback
  const generateMockFriends = useCallback(() => {
    const names = [
      "Alex", "Jordan", "Taylor", "Morgan", "Casey", 
      "Riley", "Avery", "Quinn", "Rowan", "Skyler"
    ];
    
    return Array.from({ length: 8 }, (_, i) => ({
      id: `mock-${i}`,
      username: `${names[i % names.length].toLowerCase()}${100 + i}`,
      displayName: names[i % names.length],
      pfp: null, // No profile picture for mock data
      fid: 1000 + i
    }));
  }, []);
  
  // Fetch collection friends from multiple API endpoints with retries
  const fetchCollectionFriends = async () => {
    if (!contractAddress || !profile?.fid) return;
    
    setIsLoadingFriends(true);
    setFriendsError(null);
    setUsingMockData(false);

    try {
      // Try primary API endpoint first
      const apiUrl = `/api/collection-friends?contractAddress=${contractAddress}&fid=${profile.fid}`;
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      
      const data = await response.json();
      setFriends(data.friends || []);
      setTotalFriends(data.total || data.friends?.length || 0);
      setIsLoadingFriends(false);
    } catch (error) {
      console.error("Error fetching collection friends from primary API:", error);
      
      try {
        // Try secondary API endpoint
        const backupApiUrl = `/api/collection-friends-backup?contractAddress=${contractAddress}&fid=${profile.fid}`;
        const backupResponse = await fetch(backupApiUrl);
        
        if (!backupResponse.ok) {
          throw new Error(`Backup API returned ${backupResponse.status}`);
        }
        
        const backupData = await backupResponse.json();
        setFriends(backupData.friends || []);
        setTotalFriends(backupData.total || backupData.friends?.length || 0);
        setIsLoadingFriends(false);
      } catch (backupError) {
        console.error("Error fetching from backup API:", backupError);
        
        // Use mock data as last resort
        console.log("Using mock data as fallback");
        const mockFriends = generateMockFriends();
        setFriends(mockFriends);
        setTotalFriends(mockFriends.length);
        setUsingMockData(true);
        setIsLoadingFriends(false);
      }
    }
  };
  
  // Prevent click events from bubbling up and closing the modal unexpectedly
  const handleModalClick = (e) => {
    e.stopPropagation();
    e.preventDefault(); // Prevent any default behavior
  };
  
  // Check if user is authenticated with Farcaster
  const showFriendsButton = isAuthenticated && profile?.fid && contractAddress;
  
  // Add missing handleCardClick function
  const handleCardClick = (e) => {
    // Prevent propagation if we have friends modal open
    if (showFriendsModal) {
      e.stopPropagation();
    }
    // Card click handling - can be expanded later if needed
  };
  
  return (
    <div className="nft-card vercel-nft-card" onClick={handleCardClick}>
      {/* NFT Media Container - OUTSIDE the Link to prevent click capturing */}
      <div className="nft-media-container" style={{ 
        position: 'relative', 
        width: '100%',
        paddingBottom: '100%', // 1:1 aspect ratio
        backgroundColor: '#f5f5f5',
        flexShrink: 0,
        zIndex: 5 // Ensure media is above other elements
      }}>
        {/* Debug info - remove in production */}
        <div style={{
          position: 'absolute',
          bottom: '0',
          left: '0',
          right: '0',
          backgroundColor: 'rgba(0,0,0,0.7)',
          color: 'white',
          fontSize: '9px',
          padding: '2px 4px',
          zIndex: 6, // Above the media
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis'
        }}>
          Debug URL: {debugMediaUrl} (Type: {mediaType})
        </div>
        
        {/* Render appropriate media type based on content */}
        {mediaType === 'image' && (
          <img
            src={mediaUrl}
            alt={title}
            className="nft-image-content"
            onLoad={handleMediaLoad}
            onError={handleMediaError}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              visibility: 'visible',
              opacity: 1,
              zIndex: 5, // Ensure it's visible
              margin: 0,
              padding: 0,
              border: 'none',
              fontFamily: 'inherit'
            }}
          />
        )}
        
        {mediaType === 'video' && (
          <video
            src={mediaUrl}
            className="nft-video-content"
            onLoadedData={handleMediaLoad}
            onError={handleMediaError}
            autoPlay
            loop
            muted
            playsInline
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
              visibility: 'visible',
              opacity: 1,
              zIndex: 5, // Ensure it's visible
              margin: 0,
              padding: 0,
              border: 'none'
            }}
          />
        )}
        
        {mediaType === 'audio' && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f0f0f0',
            zIndex: 5 // Ensure it's visible
          }}>
            <audio
              src={mediaUrl}
              className="nft-audio-content"
              onLoadedData={handleMediaLoad}
              onError={handleMediaError}
              controls
              style={{
                width: '90%',
                maxWidth: '250px',
                zIndex: 5 // Ensure it's visible
              }}
            />
          </div>
        )}
        
        {/* Loading indicator - only shown while loading */}
        {!mediaLoaded && !mediaError && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f5f5f5',
            zIndex: mediaLoaded ? 0 : 6 // Above the media while loading
          }}>
            <div style={{
              width: '30px',
              height: '30px',
              border: '3px solid rgba(0, 0, 0, 0.1)',
              borderTopColor: '#7c3aed',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
            <style dangerouslySetInnerHTML={{ __html: spinKeyframes }} />
          </div>
        )}
        
        {/* Error fallback - only shown on error */}
        {mediaError && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f5f5f5',
            zIndex: 6 // Above everything
          }}>
            <img 
              src={placeholderUrl}
              alt={`${title} (unavailable)`}
              style={{
                width: '80%',
                height: '80%',
                objectFit: 'contain'
              }}
            />
          </div>
        )}
      </div>
      
      {/* NFT Info - Replaced Link with a regular div */}
      <div className="nft-info-container" style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        flex: 1,
        color: 'inherit',
        zIndex: 4, // Below the media
        position: 'relative' // Add position relative for friends button positioning
      }}>
        <div className="nft-details" style={{ padding: '12px', zIndex: 4 }}>
          <div className="nft-info">
            <h3 style={{ 
              margin: '0 0 4px 0',
              fontSize: '16px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontFamily: 'Arial, sans-serif'
            }}>{title}</h3>
            {collection && (
              <p style={{
                margin: 0,
                marginBottom: formattedValue ? '2px' : '0',
                fontSize: '14px',
                color: '#666',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                fontFamily: 'Arial, sans-serif'
              }}>{collection}</p>
            )}
            {formattedValue && (
              <p style={{
                margin: 0,
                fontSize: '14px',
                color: '#4CAF50', // Green color for value
                fontWeight: 500,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                fontFamily: 'Arial, sans-serif'
              }}>
                {formattedValue}
              </p>
            )}
          </div>
          
          {/* Add Collection Friends button for Farcaster users */}
          {showFriendsButton && (
            <button 
              className="collection-friends-button" 
              onClick={handleShowFriends}
              title="Show friends who own this collection"
              style={{
                position: 'absolute',
                bottom: '8px',
                right: '8px',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: 'rgba(97, 0, 255, 0.2)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#6100ff',
                transition: 'all 0.2s ease',
                zIndex: 5,
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M17 21V19C17 17.9391 16.5786 16.9217 15.8284 16.1716C15.0783 15.4214 14.0609 15 13 15H5C3.93913 15 2.92172 15.4214 2.17157 16.1716C1.42143 16.9217 1 17.9391 1 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M9 11C11.2091 11 13 9.20914 13 7C13 4.79086 11.2091 3 9 3C6.79086 3 5 4.79086 5 7C5 9.20914 6.79086 11 9 11Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M23 21V19C22.9993 18.1137 22.7044 17.2528 22.1614 16.5523C21.6184 15.8519 20.8581 15.3516 20 15.13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M16 3.13C16.8604 3.35031 17.623 3.85071 18.1676 4.55232C18.7122 5.25392 19.0078 6.11683 19.0078 7.005C19.0078 7.89318 18.7122 8.75608 18.1676 9.45769C17.623 10.1593 16.8604 10.6597 16 10.88" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
        </div>
      </div>
      
      {/* Collection Friends Modal - integrated directly into the card */}
      {showFriendsModal && (
        <div 
          className="collection-friends-overlay"
          onClick={handleCloseFriendsModal}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10000,
            backdropFilter: 'blur(4px)'
          }}
        >
          <div 
            className="collection-friends-modal"
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: '#ffffff',
              maxWidth: '350px',
              width: '90%',
              borderRadius: '12px',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '80vh',
              position: 'relative',
              zIndex: 10001,
              overflow: 'hidden',
              color: '#333'
            }}
          >
            <div className="modal-header" style={{
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              padding: '16px 20px',
              borderBottom: '1px solid #eee'
            }}>
              <h2 className="modal-title" style={{
                margin: 0,
                fontSize: '1.1rem',
                fontWeight: 600,
                color: '#333'
              }}>
                {collection ? `${collection} Owners` : 'Collection Owners'}
              </h2>
              <button 
                className="modal-close" 
                onClick={handleCloseFriendsModal}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1.5rem',
                  lineHeight: 1,
                  padding: '5px',
                  margin: '-5px',
                  color: '#666'
                }}
              >×</button>
            </div>
            
            <div className="collection-friends-content" style={{
              padding: '16px',
              overflowY: 'auto',
              maxHeight: 'calc(80vh - 70px)',
              flex: 1,
              backgroundColor: '#ffffff'
            }}>
              {usingMockData && (
                <div className="mock-data-notice" style={{
                  backgroundColor: '#f0f8ff',
                  border: '1px solid #bad6ff',
                  borderRadius: '8px',
                  padding: '10px 15px',
                  marginBottom: '20px'
                }}>
                  <p style={{color: '#3473e0', fontSize: '14px', margin: 0}}>
                    Using sample data for demonstration.
                  </p>
                </div>
              )}
              
              <div className="collection-info" style={{marginBottom: '20px'}}>
                <p style={{textAlign: 'center', fontSize: '14px', color: '#333'}}>
                  {totalFriends > 0 
                    ? `${totalFriends} friends own NFTs from this collection` 
                    : 'No friends found with NFTs from this collection'}
                </p>
              </div>
              
              {isLoadingFriends ? (
                <div className="loading-container" style={{
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  minHeight: '100px'
                }}>
                  <div className="loading-spinner" style={{
                    border: '4px solid rgba(0, 0, 0, 0.1)',
                    borderRadius: '50%',
                    borderTop: '4px solid #3772ff',
                    width: '30px',
                    height: '30px',
                    animation: 'spin 1s linear infinite',
                    marginBottom: '16px'
                  }}></div>
                  <p style={{color: '#333'}}>Loading friends...</p>
                </div>
              ) : friendsError && !usingMockData ? (
                <div className="error-message" style={{
                  backgroundColor: '#fff2f0',
                  border: '1px solid #ffccc7',
                  borderRadius: '8px',
                  padding: '15px',
                  margin: '20px 0',
                  textAlign: 'center'
                }}>
                  <p style={{color: '#333'}}>Error loading collection friends</p>
                  <button 
                    onClick={() => window.location.reload()}
                    style={{
                      backgroundColor: '#3772ff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '8px 16px',
                      marginTop: '10px',
                      cursor: 'pointer',
                      fontWeight: 500
                    }}
                  >
                    Retry
                  </button>
                </div>
              ) : friends.length === 0 ? (
                <div className="no-results" style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  minHeight: '100px',
                  color: '#666',
                  textAlign: 'center',
                  padding: '20px'
                }}>
                  <p>No friends found with NFTs from this collection.</p>
                </div>
              ) : (
                <div className="friends-list" style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  {friends.map(friend => (
                    <a 
                      key={friend.id || friend.fid} 
                      href={`https://warpcast.com/${friend.username}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="friend-item"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        padding: '12px',
                        borderRadius: '8px',
                        backgroundColor: '#f9f9f9',
                        transition: 'background-color 0.2s',
                        textDecoration: 'none',
                        color: '#333',
                        marginBottom: '8px'
                      }}
                    >
                      <div className="friend-avatar" style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        overflow: 'hidden',
                        marginRight: '12px',
                        backgroundColor: '#e5e5e5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {friend.pfp ? (
                          <img 
                            src={friend.pfp} 
                            alt={friend.displayName}
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover'
                            }}
                          />
                        ) : (
                          <div className="avatar-placeholder" style={{
                            color: '#666',
                            fontSize: '14px',
                            fontWeight: 'bold'
                          }}>
                            {friend.displayName?.charAt(0) || friend.username?.charAt(0) || '?'}
                          </div>
                        )}
                      </div>
                      <div className="friend-info" style={{flex: 1}}>
                        <div className="friend-name" style={{
                          fontSize: '14px',
                          fontWeight: 500,
                          marginBottom: '2px'
                        }}>
                          {friend.displayName || friend.username}
                        </div>
                        <div className="friend-username" style={{
                          fontSize: '12px',
                          color: '#666'
                        }}>
                          @{friend.username}
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VercelNFTCard; 