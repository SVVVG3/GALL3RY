import React, { useState, useEffect, useCallback, useMemo } from 'react';

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
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [debugMediaUrl, setDebugMediaUrl] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState('image'); // 'image', 'video', or 'unsupported'
  
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
  
  // Format the value for display - always prioritize ETH with 4 decimal places
  const formattedValue = useMemo(() => {
    if (valueEth) {
      return `${parseFloat(valueEth).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} ETH`;
    } else if (valueUsd) {
      // Convert USD to ETH (rough estimate) and format with 4 decimal places
      const estimatedEth = valueUsd / 2000; // Rough conversion
      return `${parseFloat(estimatedEth).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} ETH`;
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
  
  return (
    <div className="nft-card" style={{ 
      minHeight: '250px', 
      display: 'flex', 
      flexDirection: 'column',
      border: '1px solid #eee',
      borderRadius: '8px',
      overflow: 'hidden',
      backgroundColor: '#fff',
      position: 'relative' // Add explicit position for proper z-indexing
    }}>
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
        zIndex: 4 // Below the media
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
        </div>
      </div>
    </div>
  );
};

export default VercelNFTCard; 