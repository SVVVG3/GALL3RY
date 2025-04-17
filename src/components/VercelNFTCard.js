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
    // First try media array (Alchemy format)
    if (nft?.media && Array.isArray(nft.media) && nft.media.length > 0) {
      const mediaItem = nft.media[0];
      if (mediaItem.gateway) return mediaItem.gateway;
      if (mediaItem.raw) return mediaItem.raw;
    }
    
    // Then try standard image fields
    if (nft?.image_url) return nft.image_url;
    if (typeof nft?.image === 'string') return nft.image;
    
    // Try image object
    if (nft?.image && typeof nft.image === 'object') {
      if (nft.image.cachedUrl) return nft.image.cachedUrl;
      if (nft.image.originalUrl) return nft.image.originalUrl;
      if (nft.image.gateway) return nft.image.gateway;
    }
    
    // Try metadata
    if (nft?.metadata?.image) return nft.metadata.image;
    
    // Last resort - use Alchemy CDN directly if we have contract and token ID
    if (contractAddress && tokenId) {
      return `https://nft-cdn.alchemy.com/eth-mainnet/${contractAddress}/${tokenId}`;
    }
    
    return "";
  };

  // Generate the safest URL for production
  const getProxyUrl = (url) => {
    if (!url) return "#placeholder-nft-svg"; // Use inline SVG reference
    
    // Always use API proxy for external images
    if (url.startsWith('http') || url.startsWith('ipfs://')) {
      return `/api/image-proxy?url=${encodeURIComponent(url)}`;
    }
    
    return url;
  };
  
  // Find the actual URL to use
  const imageUrl = getProxyUrl(getImageUrl());
  
  // Safety fallback for placeholders - reference inline SVG
  const placeholderUrl = "#placeholder-nft-svg";
  
  return (
    <div className="nft-card" style={{ minHeight: '250px', display: 'flex', flexDirection: 'column' }}>
      <Link to={`/nft/${contractAddress}/${tokenId}`} className="nft-link" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className="nft-image" style={{ 
          position: 'relative', 
          minHeight: '200px', 
          backgroundColor: '#f5f5f5',
          flexGrow: 1
        }}>
          {/* Always render image */}
          <img
            src={imageUrl}
            alt={title}
            className="nft-image-content"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
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
              zIndex: 1
            }}
          />
          
          {/* Loading indicator - shown until image loads or errors */}
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
              zIndex: 2
            }}>
              <div style={{
                width: '30px',
                height: '30px',
                border: '3px solid rgba(0, 0, 0, 0.1)',
                borderTopColor: '#7c3aed',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></div>
              {/* Add style tag with keyframes animation */}
              <style dangerouslySetInnerHTML={{ __html: spinKeyframes }} />
            </div>
          )}
          
          {/* Fallback for errors */}
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
              textOverflow: 'ellipsis'
            }}>{title}</h3>
            {collection && (
              <p style={{
                margin: 0,
                fontSize: '14px',
                color: '#666',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>{collection}</p>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
};

export default VercelNFTCard; 