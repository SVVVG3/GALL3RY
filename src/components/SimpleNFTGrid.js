import React, { useState, useCallback, useEffect, useMemo } from 'react';
import '../styles/NFTGrid.css';

/**
 * Get a safe image URL from the NFT data
 * @param {Object} nft - The NFT data object
 * @returns {string} - A valid image URL or empty string if none found
 */
const getImageUrl = (nft) => {
  if (!nft) return '';
  
  let imageUrl = '';
  
  // Debug the NFT structure to see what we're working with
  console.log('Processing NFT for image:', {
    id: nft.id,
    name: nft.name,
    contentType: nft.image && nft.image.contentType,
    hasImage: !!nft.image,
    hasAnimationUrl: !!(nft.animation && nft.animation.cachedUrl)
  });
  
  // PRIORITY 1: Alchemy's cached URLs (most reliable)
  if (nft.image) {
    // Prefer cached and CDN URLs from Alchemy as they're most reliable
    if (nft.image.cachedUrl) {
      imageUrl = nft.image.cachedUrl;
      console.log('Using Alchemy cached URL:', imageUrl);
    } 
    // Next try thumbnail (good for performance)
    else if (nft.image.thumbnailUrl) {
      imageUrl = nft.image.thumbnailUrl;
      console.log('Using Alchemy thumbnail URL:', imageUrl);
    }
    // For SVGs, the PNG conversion is often helpful
    else if (nft.image.pngUrl) {
      imageUrl = nft.image.pngUrl;
      console.log('Using Alchemy PNG URL:', imageUrl);
    }
    // Finally try original
    else if (nft.image.originalUrl) {
      imageUrl = nft.image.originalUrl;
      console.log('Using original URL:', imageUrl);
    }
  }
  
  // PRIORITY 2: Animation URLs for NFTs that are videos or GIFs
  if (!imageUrl && nft.animation && nft.animation.cachedUrl) {
    imageUrl = nft.animation.cachedUrl;
    console.log('Using animation cached URL:', imageUrl);
  }
  
  // PRIORITY 3: Try media array (Alchemy format)
  if (!imageUrl && nft.media && Array.isArray(nft.media) && nft.media.length > 0) {
    // Try to find the best media format (gateway is usually more reliable)
    const mediaItem = nft.media.find(m => m.gateway) || 
                      nft.media.find(m => m.raw) ||
                      nft.media.find(m => m.uri) ||
                      nft.media.find(m => m.thumbnail) ||
                      nft.media[0];
    
    if (mediaItem) {
      imageUrl = mediaItem.gateway || mediaItem.raw || mediaItem.uri || mediaItem.thumbnail || '';
      console.log('Found media array item:', imageUrl);
    }
  }
  
  // PRIORITY 4: Direct image property string
  if (!imageUrl && typeof nft.image === 'string') {
    imageUrl = nft.image;
    console.log('Using direct image string property:', imageUrl);
  }
  
  // PRIORITY 5: Try raw metadata
  if (!imageUrl && nft.raw && nft.raw.metadata) {
    const metadata = nft.raw.metadata;
    imageUrl = metadata.image || metadata.image_url || metadata.animation_url || '';
    console.log('Found image in raw metadata:', imageUrl);
  }
  
  // PRIORITY 6: Legacy/fallback checks
  if (!imageUrl) {
    // Try other possible locations
    if (nft.rawMetadata) {
      imageUrl = nft.rawMetadata.image || 
                nft.rawMetadata.image_url || 
                nft.rawMetadata.animation_url || '';
      if (imageUrl) console.log('Found image in rawMetadata:', imageUrl);
    }
    
    // Try direct properties
    if (!imageUrl) {
      imageUrl = nft.image_url || 
                nft.thumbnail || 
                nft.animation_url || '';
      if (imageUrl) console.log('Found image in direct properties:', imageUrl);
    }
  }
  
  // Check if imageUrl is an object (like in the error logs), and extract the URL from it
  if (imageUrl && typeof imageUrl === 'object') {
    console.log('Image URL is an object, extracting string URL:', imageUrl);
    // Try multiple possible properties where the URL might be
    imageUrl = imageUrl.url || imageUrl.gateway || imageUrl.originalUrl || 
              imageUrl.thumbnailUrl || imageUrl.pngUrl || imageUrl.cachedUrl || '';
  }
  
  // Ensure imageUrl is a string
  if (typeof imageUrl !== 'string') {
    console.warn('Invalid imageUrl type:', typeof imageUrl, imageUrl);
    return '';
  }
  
  // Handle IPFS URLs - be smarter about gateway selection
  if (imageUrl && imageUrl.startsWith('ipfs://')) {
    const ipfsHash = imageUrl.replace('ipfs://', '');
    // Start with ipfs.io as primary gateway, but our retry logic will try others
    imageUrl = `https://ipfs.io/ipfs/${ipfsHash}`;
    console.log('Converted IPFS URL:', imageUrl);
  }
  
  // Handle Arweave URLs
  if (imageUrl && imageUrl.startsWith('ar://')) {
    imageUrl = imageUrl.replace('ar://', 'https://arweave.net/');
    console.log('Converted Arweave URL:', imageUrl);
  }
  
  // Handle HTTP URLs - ensure they are HTTPS
  if (imageUrl && imageUrl.startsWith('http://')) {
    imageUrl = imageUrl.replace('http://', 'https://');
    console.log('Converted HTTP to HTTPS:', imageUrl);
  }
  
  // Use a fallback placeholder if no image found
  if (!imageUrl) {
    imageUrl = 'https://placehold.co/600x400/ddd/333?text=No+Image';
    console.log('Using fallback placeholder - no image URL found');
  }
  
  return imageUrl;
};

/**
 * NFT Card Component
 * Displays an individual NFT with image and metadata
 */
const NFTCard = React.memo(({ nft, style }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  
  const imageUrl = getImageUrl(nft);
  const title = getNftTitle(nft);
  const collection = getCollectionName(nft);
  const floorPrice = getFloorPrice(nft);
  const contractAddress = getContractAddress(nft);
  const tokenId = getTokenId(nft);
  
  // Add detailed logging for floor price debugging
  console.log(`NFT Card ${title} - Floor Price Data:`, {
    floorPrice,
    hasContractMetadata: !!nft.contractMetadata,
    hasOpenSeaMetadata: !!(nft.contract && nft.contract.openSeaMetadata),
    networkType: nft.network || 'unknown',
    id: nft.id
  });
  
  // Create OpenSea URL based on network
  let openSeaUrl = `https://opensea.io/assets/ethereum/${contractAddress}/${tokenId}`;
  
  // Adjust OpenSea URL based on network
  if (nft.network === 'polygon' || (nft.id && nft.id.startsWith('polygon:'))) {
    openSeaUrl = `https://opensea.io/assets/matic/${contractAddress}/${tokenId}`;
  } else if (nft.network === 'base' || (nft.id && nft.id.startsWith('base:'))) {
    openSeaUrl = `https://opensea.io/assets/base/${contractAddress}/${tokenId}`;
  }
  
  // Reset state when NFT changes
  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
    setRetryCount(0);
  }, [nft.id, nft.tokenId]);
  
  // Debug NFT image loading issues
  useEffect(() => {
    console.log(`NFT ${title} (${tokenId}) image status:`, { 
      imageUrl, 
      imageLoaded, 
      imageError,
      retryCount
    });
  }, [imageLoaded, imageError, title, tokenId, imageUrl, retryCount]);
  
  // Handle image loading events
  const handleImageLoad = () => {
    console.log(`Image loaded successfully: ${title}`);
    setImageLoaded(true);
    setImageError(false);
  };
  
  // List of IPFS gateways to try in sequence
  const IPFS_GATEWAYS = [
    'https://ipfs.io/ipfs/',
    'https://gateway.ipfs.io/ipfs/',
    'https://dweb.link/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://gateway.pinata.cloud/ipfs/'
  ];
  
  const handleImageError = () => {
    console.error(`Image failed to load: ${title}, URL: ${imageUrl}, retry: ${retryCount}`);
    
    // Check if this is an IPFS URL that can be tried with different gateways
    const isIpfsUrl = imageUrl.includes('/ipfs/');
    
    if (isIpfsUrl) {
      // Extract the IPFS hash from the URL
      let ipfsHash = '';
      for (const gateway of IPFS_GATEWAYS) {
        if (imageUrl.includes(gateway)) {
          ipfsHash = imageUrl.replace(gateway, '');
          break;
        }
      }
      
      if (!ipfsHash && imageUrl.includes('/ipfs/')) {
        // Get hash from general format
        const parts = imageUrl.split('/ipfs/');
        if (parts.length > 1) {
          ipfsHash = parts[1];
        }
      }
      
      // If we have a valid IPFS hash, try the next gateway
      if (ipfsHash && retryCount < IPFS_GATEWAYS.length) {
        setRetryCount(retryCount + 1);
        console.log(`IPFS retry #${retryCount + 1}: Switching gateway for ${title}`);
        return;
      }
    }
    
    // If not IPFS or we've tried all gateways, try our proxy as last resort
    if (retryCount === IPFS_GATEWAYS.length || (!isIpfsUrl && retryCount === 0)) {
      setRetryCount(IPFS_GATEWAYS.length + 1); // Set to proxy retry
      console.log(`Retry with proxy: ${title}`);
      return;
    }
    
    // If proxy failed or all retries exhausted, give up
    if (retryCount > IPFS_GATEWAYS.length) {
      setImageError(true);
      console.error(`All retries failed for ${title}`);
      return;
    }
  };
  
  // Determine which URL to use based on retry state
  let displayUrl = imageUrl;
  
  // Handle IPFS gateway retries
  if (retryCount > 0 && retryCount <= IPFS_GATEWAYS.length) {
    // Extract the IPFS hash from original URL
    let ipfsHash = '';
    
    for (const gateway of IPFS_GATEWAYS) {
      if (imageUrl.includes(gateway)) {
        ipfsHash = imageUrl.replace(gateway, '');
        break;
      }
    }
    
    if (!ipfsHash && imageUrl.includes('/ipfs/')) {
      // Get hash from general format
      const parts = imageUrl.split('/ipfs/');
      if (parts.length > 1) {
        ipfsHash = parts[1];
      }
    }
    
    if (ipfsHash) {
      // Use the gateway for the current retry count
      const gatewayIndex = (retryCount - 1) % IPFS_GATEWAYS.length;
      displayUrl = `${IPFS_GATEWAYS[gatewayIndex]}${ipfsHash}`;
    }
  }
  // If we've tried all IPFS gateways or it's not an IPFS URL, try our proxy
  else if (retryCount > IPFS_GATEWAYS.length) {
    displayUrl = `/api/image-proxy?url=${encodeURIComponent(imageUrl)}&t=${Date.now()}`;
  }
  
  return (
    <div className="nft-card-container" style={style}>
      <div className="nft-item">
        <a 
          href={openSeaUrl} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="nft-link"
        >
          <div className="nft-image-container">
            {!imageLoaded && !imageError && (
              <div className="nft-image-placeholder">
                <span>Loading...</span>
              </div>
            )}
            
            {imageError ? (
              <div className="nft-image-error">
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="3" y="3" width="18" height="18" rx="2" stroke="#999999" strokeWidth="2" />
                  <path d="M12 8v4m0 4h.01" stroke="#999999" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <p className="error-text">Unable to load image</p>
              </div>
            ) : (
              <>
                <div 
                  className={`nft-bg-image ${imageLoaded ? 'loaded' : ''}`} 
                  style={{ backgroundImage: `url(${displayUrl})` }}
                ></div>
                <img
                  src={displayUrl}
                  alt={title || 'NFT'}
                  className={`nft-image ${imageLoaded ? 'loaded' : ''}`}
                  onLoad={handleImageLoad}
                  onError={handleImageError}
                  crossOrigin="anonymous"
                  referrerPolicy="no-referrer"
                />
              </>
            )}
          </div>
          
          <div className="nft-info">
            <h3 className="nft-title">{title || 'Untitled NFT'}</h3>
            {collection && <p className="nft-collection">{collection}</p>}
            {floorPrice ? (
              <p className="nft-price">{floorPrice}</p>
            ) : (
              <p className="nft-price-unavailable">Floor price unavailable</p>
            )}
          </div>
        </a>
      </div>
    </div>
  );
});

/**
 * Simplified NFT Grid component 
 */
const SimpleNFTGrid = ({ nfts = [], isLoading = false }) => {
  if (isLoading && (!nfts || nfts.length === 0)) {
    return (
      <div className="nft-grid-loader">
        <div className="loader"></div>
        <p>Loading NFTs...</p>
      </div>
    );
  }

  if (!nfts || nfts.length === 0) {
    return (
      <div className="nft-grid-empty">
        <p className="nft-grid-no-results">No NFTs found</p>
      </div>
    );
  }

  return (
    <div className="nft-grid-container">
      <div className="fallback-grid">
        {nfts.map((nft, index) => (
          <NFTCard 
            key={getNftKey(nft) || index} 
            nft={nft} 
          />
        ))}
      </div>
    </div>
  );
};

// Utility functions to handle NFT data
const getNftTitle = (nft) => {
  if (!nft) return '';
  
  // Try various possible title locations in NFT metadata
  if (nft.title) {
    return nft.title;
  }
  
  if (nft.metadata && nft.metadata.name) {
    return nft.metadata.name;
  }
  
  if (nft.name) {
    return nft.name;
  }
  
  if (nft.rawMetadata && nft.rawMetadata.name) {
    return nft.rawMetadata.name;
  }
  
  // Fall back to "Token #ID" format
  if (nft.tokenId) {
    return `Token #${nft.tokenId}`;
  }
  
  if (nft.token_id) {
    return `Token #${nft.token_id}`;
  }
  
  return 'Unnamed NFT';
};

const getCollectionName = (nft) => {
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

const getFloorPrice = (nft) => {
  if (!nft) return '';
  
  // Debug floor price - log key paths
  console.log('NFT floor price debug:', {
    title: getNftTitle(nft),
    hasContract: !!nft.contract,
    hasOpenSeaMetadata: !!(nft.contract && nft.contract.openSeaMetadata),
    openSeaMetadataFloorPrice: nft.contract && nft.contract.openSeaMetadata ? nft.contract.openSeaMetadata.floorPrice : null
  });
  
  // Try different price locations depending on the data source
  let price = null;
  let currency = 'ETH';
  
  // Primary location based on Alchemy API response example
  if (nft.contract && nft.contract.openSeaMetadata && nft.contract.openSeaMetadata.floorPrice !== undefined) {
    price = nft.contract.openSeaMetadata.floorPrice;
    console.log(`Found floor price in contract.openSeaMetadata: ${price}`);
  }
  // Fallback to other possible locations for backward compatibility
  else if (nft.contractMetadata && nft.contractMetadata.openSea && nft.contractMetadata.openSea.floorPrice) {
    price = nft.contractMetadata.openSea.floorPrice;
    console.log(`Found floor price in contractMetadata.openSea: ${price}`);
  }
  // Check for floor price in collection data
  else if (nft.collection && nft.collection.floorPrice) {
    price = nft.collection.floorPrice;
    console.log(`Found floor price in collection: ${price}`);
  }
  // Check for direct floor_price property
  else if (nft.floor_price) {
    price = nft.floor_price;
    console.log(`Found direct floor_price: ${price}`);
  }
  
  // Determine currency based on network
  if (nft.network === 'polygon' || (nft.id && typeof nft.id === 'string' && nft.id.startsWith('polygon:'))) {
    currency = 'MATIC';
  } else if (nft.network === 'base' || (nft.id && typeof nft.id === 'string' && nft.id.startsWith('base:'))) {
    currency = 'ETH';
  }
  
  // Handle the price value
  if (price !== null && price !== undefined) {
    // Don't show price if it's 0
    if (price === 0 || price === '0') {
      return '';
    }
    
    // If it's a valid number
    if (!isNaN(parseFloat(price))) {
      return `Floor: ${parseFloat(price).toFixed(4)} ${currency}`;
    }
    
    // If it's anything else, return it as is
    return `Floor: ${price} ${currency}`;
  }
  
  return '';
};

const getContractAddress = (nft) => {
  if (!nft) return '';

  // Try to get contract address from various possible locations
  if (nft.contract && nft.contract.address) {
    return nft.contract.address;
  }
  
  if (nft.contractAddress) {
    return nft.contractAddress;
  }
  
  if (nft.id && nft.id.contractAddress) {
    return nft.id.contractAddress;
  }
  
  if (nft.token_address) {
    return nft.token_address;
  }
  
  if (nft.contract && nft.contract.id) {
    return nft.contract.id;
  }
  
  if (nft.address) {
    return nft.address;
  }
  
  // If we can't find a contract address, return an empty string
  return '';
};

const getTokenId = (nft) => {
  if (!nft) return '';
  
  if (nft.tokenId) {
    return nft.tokenId;
  }
  
  if (nft.id && nft.id.tokenId) {
    return nft.id.tokenId;
  }
  
  if (nft.token_id) {
    return nft.token_id;
  }
  
  return '';
};

const getNftKey = (nft) => {
  if (!nft) return '';
  
  const contract = getContractAddress(nft);
  const tokenId = getTokenId(nft);
  return `${contract}-${tokenId}`;
};

export default SimpleNFTGrid; 