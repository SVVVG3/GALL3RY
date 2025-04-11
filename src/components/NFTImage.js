import React, { useState, useEffect, useMemo } from 'react';
import './NFTImage.css';

const NFTImage = ({ nft, height = 300, usePlaceholder = true, src, alt, className }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  
  // Determine network from contract address if not provided
  const determineNetwork = (address) => {
    // Common network prefixes
    if (address && address.startsWith('0x7f5')) return 'optimism';
    if (address && address.startsWith('0x42161')) return 'arbitrum';
    if (address && address.startsWith('0x89')) return 'polygon';
    if (address && address.startsWith('0x2105')) return 'base';
    return 'ethereum'; // Default to ethereum
  };
  
  const generateImageUrl = useMemo(() => {
    // If direct src is provided, use that
    if (src) return src;
    
    if (!nft) return null;
    
    // Use our new proxy endpoint to avoid CORS issues
    if (nft.contractAddress && nft.tokenId) {
      const network = nft.network || determineNetwork(nft.contractAddress);
      return `/api/nft-image/${network}/${nft.contractAddress}/${nft.tokenId}`;
    }
    
    // Fallback to the direct image URL if available
    return nft.media?.[0]?.gateway || nft.media?.[0]?.raw;
  }, [nft, src]);
  
  // Reset states when nft changes
  useEffect(() => {
    setLoading(true);
    setError(false);
  }, [nft, src]);

  const handleLoad = () => {
    setLoading(false);
    setError(false);
  };

  const handleError = () => {
    setLoading(false);
    setError(true);
  };

  // Generate a placeholder color based on address
  const generateColor = (address) => {
    if (!address) return '#e0e0e0';
    const hash = address.slice(2, 8);
    return `#${hash}`;
  };

  // Generate the NFT placeholder
  const renderPlaceholder = () => {
    const addressColor = generateColor(nft?.contractAddress || nft?.collection?.address);
    const collectionSymbol = nft?.name?.substring(0, 2) || 'NFT';
    
    return (
      <div 
        className="nft-placeholder" 
        style={{ 
          backgroundColor: addressColor,
          height: height,
          width: '100%'
        }}
      >
        <span className="placeholder-text">{collectionSymbol}</span>
      </div>
    );
  };

  return (
    <div className={`nft-image-container ${loading ? 'loading' : ''} ${className || ''}`} style={{ height: `${height}px` }}>
      {loading && <div className="nft-loading-spinner"></div>}
      
      {generateImageUrl && !error && (
        <img
          src={generateImageUrl}
          alt={alt || nft?.name || 'NFT'}
          className={`nft-image ${loading ? 'loading' : ''}`}
          onLoad={handleLoad}
          onError={handleError}
          loading="lazy"
        />
      )}
      
      {(error || !generateImageUrl) && usePlaceholder && renderPlaceholder()}
    </div>
  );
};

export default NFTImage; 