import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

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
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [debugImageUrl, setDebugImageUrl] = useState('');
  
  // Extract NFT details with fallbacks
  const title = nft?.metadata?.name || nft?.name || nft?.title || `NFT #${nft?.tokenId || nft?.token_id || ''}`;
  const collection = nft?.collection?.name || nft?.collection_name || nft?.contractMetadata?.name || '';
  
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

  // Function to find best image URL with fallbacks
  const getImageUrl = () => {
    let foundUrl = "";
    let source = "";
    
    // Dump the entire image object for debugging
    if (nft?.image) {
      console.log("NFT image object:", JSON.stringify(nft.image, null, 2));
    }
    
    // First try Alchemy's media array format
    if (nft?.media && Array.isArray(nft.media) && nft.media.length > 0) {
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
    if (!foundUrl && nft?.image_url) {
      foundUrl = nft.image_url;
      source = "image_url";
    }
    
    if (!foundUrl && typeof nft?.image === 'string') {
      foundUrl = nft.image;
      source = "image string";
    }
    
    // Try Alchemy's image object format
    if (!foundUrl && nft?.image && typeof nft.image === 'object') {
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
    if (!foundUrl && nft?.metadata?.image) {
      foundUrl = nft.metadata.image;
      source = "metadata.image";
    }
    
    // Last resort - direct Alchemy CDN
    if (!foundUrl && contractAddress && tokenId) {
      foundUrl = `https://nft-cdn.alchemy.com/eth-mainnet/${contractAddress}/${tokenId}`;
      source = "alchemy direct";
    }
    
    console.log(`Image URL found from ${source}: ${foundUrl}`);
    setDebugImageUrl(foundUrl); // Store for debugging
    
    return foundUrl;
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
  
  // Find the actual URL to use
  const imageUrl = getProxyUrl(getImageUrl());
  
  // Safety fallback for placeholders
  const placeholderUrl = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIiB2aWV3Qm94PSIwIDAgMzAwIDMwMCI+PHJlY3Qgd2lkdGg9IjMwMCIgaGVpZ2h0PSIzMDAiIGZpbGw9IiNmMGYwZjAiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNjY2Ij5JbWFnZSB1bmF2YWlsYWJsZTwvdGV4dD48L3N2Zz4=";
  
  // Log the final URL being used
  useEffect(() => {
    console.log(`NFT ${title}: Using final image URL: ${imageUrl}`);
    console.log(`Loading state: ${imageLoaded ? 'Loaded' : 'Loading'}, Error state: ${imageError ? 'Error' : 'No Error'}`);
  }, [imageUrl, imageLoaded, imageError, title]);
  
  // Handle image load success
  const handleImageLoad = () => {
    console.log(`Image loaded successfully: ${imageUrl}`);
    setImageLoaded(true);
    setImageError(false);
  };
  
  // Handle image load error
  const handleImageError = () => {
    console.log(`Image load error: ${imageUrl}`);
    setImageError(true);
    setImageLoaded(true); // Consider it "loaded" but with error
  };
  
  return (
    <div className="nft-card" style={{ 
      minHeight: '250px', 
      display: 'flex', 
      flexDirection: 'column',
      border: '1px solid #eee',
      borderRadius: '8px',
      overflow: 'hidden',
      backgroundColor: '#fff'
    }}>
      <Link to={`/nft/${contractAddress}/${tokenId}`} className="nft-link" style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: '100%',
        textDecoration: 'none',
        color: 'inherit'
      }}>
        <div className="nft-image" style={{ 
          position: 'relative', 
          width: '100%',
          paddingBottom: '100%', // 1:1 aspect ratio
          backgroundColor: '#f5f5f5',
          flexShrink: 0
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
            zIndex: 5,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis'
          }}>
            Debug URL: {debugImageUrl}
          </div>
          
          {/* Always render image - this is the main display */}
          <img
            src={imageUrl}
            alt={title}
            className="nft-image-content"
            onLoad={handleImageLoad}
            onError={handleImageError}
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
              zIndex: 1,
              // Simple CSS reset to override any global styles
              margin: 0,
              padding: 0,
              border: 'none',
              fontFamily: 'inherit'
            }}
          />
          
          {/* Loading indicator - only shown while loading */}
          {!imageLoaded && !imageError && (
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
              zIndex: imageLoaded ? 0 : 2
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
          {imageError && (
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
              zIndex: 2
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
        
        <div className="nft-details" style={{ padding: '12px' }}>
          <div className="nft-info">
            <h3 style={{ 
              margin: '0 0 4px 0',
              fontSize: '16px',
              fontWeight: 600,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontFamily: 'Arial, sans-serif' // Override Comic Sans
            }}>{title}</h3>
            {collection && (
              <p style={{
                margin: 0,
                fontSize: '14px',
                color: '#666',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                fontFamily: 'Arial, sans-serif' // Override Comic Sans
              }}>{collection}</p>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
};

export default VercelNFTCard; 