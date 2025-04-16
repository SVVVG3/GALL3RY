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
    image: nft.image,
    media: nft.media,
    tokenId: nft.tokenId || nft.token_id,
    network: nft.network
  });
  
  // First, check if the NFT has an image object (from NFTContext processing)
  if (nft.image && typeof nft.image === 'object') {
    imageUrl = nft.image.url || nft.image.gateway || nft.image.originalUrl || 
               nft.image.thumbnailUrl || nft.image.pngUrl || nft.image.cachedUrl || '';
    console.log('Found image object:', imageUrl);
  }
  
  // Check for media array (Alchemy format)
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
      
      // Check for format - Alchemy sometimes provides format data
      if (mediaItem.format && (
          mediaItem.format.toLowerCase() === 'gif' || 
          mediaItem.format.toLowerCase() === 'mp4' ||
          mediaItem.format.toLowerCase() === 'svg' ||
          mediaItem.format.toLowerCase() === 'webp'
      )) {
        console.log(`Special media format detected: ${mediaItem.format}`);
      }
    }
  }
  
  // Try rawMetadata (Alchemy format)
  if (!imageUrl && nft.rawMetadata) {
    imageUrl = nft.rawMetadata.image || 
               nft.rawMetadata.image_url || 
               nft.rawMetadata.image_uri || 
               nft.rawMetadata.animation_url ||
               nft.rawMetadata.image_data || 
               '';
    if (imageUrl) console.log('Found image in rawMetadata:', imageUrl);
  }
  
  // Try metadata (OpenSea format)
  if (!imageUrl && nft.metadata) {
    try {
      // If metadata is a string, try to parse it as JSON
      const metadata = typeof nft.metadata === 'string' 
        ? JSON.parse(nft.metadata) 
        : nft.metadata;
        
      imageUrl = metadata?.image || 
                 metadata?.image_url || 
                 metadata?.animation_url ||
                 metadata?.image_uri || 
                 metadata?.image_data || 
                 '';
      if (imageUrl) console.log('Found image in metadata:', imageUrl);
    } catch (e) {
      console.error('Error parsing NFT metadata', e);
    }
  }
  
  // Try direct properties (OpenSea format)
  if (!imageUrl) {
    imageUrl = nft.image_url || 
               nft.image || 
               nft.image_preview_url || 
               nft.thumbnail || 
               nft.animation_url ||  // Animation URLs for GIFs
               '';
    if (imageUrl) console.log('Found image in direct properties:', imageUrl);
  }
  
  // Special handling for cachedUrl, thumbnailUrl, pngUrl from Alchemy
  if (!imageUrl && (nft.cachedUrl || nft.thumbnailUrl || nft.pngUrl)) {
    imageUrl = nft.cachedUrl || nft.thumbnailUrl || nft.pngUrl || '';
    console.log('Found Alchemy URL:', imageUrl);
  }
  
  // Check for token URI direct property
  if (!imageUrl && nft.tokenUri) {
    // tokenUri is sometimes a direct link to the image
    if (nft.tokenUri.gateway && typeof nft.tokenUri.gateway === 'string') {
      if (nft.tokenUri.gateway.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i)) {
        imageUrl = nft.tokenUri.gateway;
        console.log('Using tokenUri.gateway as image URL:', imageUrl);
      }
    } else if (typeof nft.tokenUri === 'string' && nft.tokenUri.match(/\.(jpg|jpeg|png|gif|svg|webp)$/i)) {
      imageUrl = nft.tokenUri;
      console.log('Using tokenUri as image URL:', imageUrl);
    }
  }
  
  // Handle special cases from the console log
  if (!imageUrl && nft.id && typeof nft.id === 'string') {
    const idParts = nft.id.split(':');
    
    if (idParts.length > 1) {
      const network = idParts[0];
      const tokenData = idParts[1];
      
      // Based on console output, we need specific handlers for certain networks
      if (network === 'base') {
        // For Base NFTs, try the fallback mock image
        imageUrl = `https://placehold.co/600x400/222/fff?text=${encodeURIComponent(nft.name || 'Base NFT')}`;
      } else if (network === 'polygon') {
        // For Polygon NFTs, try the fallback mock image 
        imageUrl = `https://placehold.co/600x400/624/fff?text=${encodeURIComponent(nft.name || 'Polygon NFT')}`;
      }
    }
  }
  
  // Fallback for SHIB NFTs seen in the console
  if (!imageUrl && nft.name && nft.name.includes('SHIB NFT')) {
    imageUrl = `https://placehold.co/600x400/db6/222?text=${encodeURIComponent(nft.name)}`;
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
  
  // Handle IPFS URLs - try multiple gateways
  if (imageUrl && imageUrl.startsWith('ipfs://')) {
    // Use a more reliable IPFS gateway - try a combination of gateways for better success
    const ipfsHash = imageUrl.replace('ipfs://', '');
    imageUrl = `https://ipfs.io/ipfs/${ipfsHash}`; // Primary gateway
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
      retryCount,
      floorPrice,
      collection
    });
  }, [imageLoaded, imageError, title, tokenId, imageUrl, retryCount, floorPrice, collection]);
  
  // Handle image loading events
  const handleImageLoad = () => {
    console.log(`Image loaded successfully: ${title}`);
    setImageLoaded(true);
    setImageError(false);
  };
  
  const handleImageError = () => {
    console.error(`Image failed to load: ${title}, URL: ${imageUrl}`);
    
    // Enhanced retry logic with multiple fallback strategies
    if (retryCount === 0 && imageUrl && !imageUrl.includes('placehold.co')) {
      // First retry with our proxy
      setRetryCount(1);
      console.log(`Retry #1: Using image proxy for ${title}`);
    } 
    else if (retryCount === 1 && imageUrl && !imageUrl.includes('placehold.co')) {
      // Second retry with cloudflare IPFS gateway if it's an IPFS URL
      if (imageUrl.includes('ipfs.io/ipfs/')) {
        setRetryCount(2);
        console.log(`Retry #2: Switching to Cloudflare IPFS gateway for ${title}`);
      } else {
        // If not IPFS, go straight to final retry attempt
        setRetryCount(3);
        console.log(`Skipping IPFS retry, moving to final retry for ${title}`);
      }
    }
    else if (retryCount === 2 && imageUrl && !imageUrl.includes('placehold.co')) {
      // Third retry with Pinata IPFS gateway if previous failed
      setRetryCount(3);
      console.log(`Retry #3: Switching to Pinata IPFS gateway for ${title}`);
    }
    else {
      // Give up after multiple retries
      setImageError(true);
      console.error(`All retries failed for ${title}`);
    }
  };
  
  // Determine which URL to use based on retry state
  let displayUrl = imageUrl;
  
  if (retryCount === 1 && !imageUrl.includes('placehold.co')) {
    // First retry - use our proxy
    displayUrl = `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
  } 
  else if (retryCount === 2 && imageUrl.includes('ipfs.io/ipfs/')) {
    // Second retry - use Cloudflare IPFS gateway if it's an IPFS URL
    const ipfsHash = imageUrl.replace('https://ipfs.io/ipfs/', '');
    displayUrl = `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`;
  } 
  else if (retryCount === 3 && imageUrl.includes('ipfs.io/ipfs/')) {
    // Third retry - try Pinata gateway
    const ipfsHash = imageUrl.replace('https://ipfs.io/ipfs/', '');
    displayUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;
  }
  else if (retryCount === 3 && !imageUrl.includes('ipfs.io/ipfs/')) {
    // Third retry for non-IPFS - try the proxy again with cache buster
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
  
  // Debug floor price - log the possible locations to check
  console.log('Checking floor price for:', {
    title: getNftTitle(nft),
    hasContractMetadata: !!nft.contractMetadata,
    hasCollection: !!nft.collection,
    hasFloorPrice: !!nft.floor_price,
    hasOpenSea: !!(nft.contractMetadata && nft.contractMetadata.openSea),
    hasContract: !!nft.contract
  });
  
  // Try different price locations depending on the data source
  let price = null;
  let currency = 'ETH';
  
  // Check for OpenSea floor price in contractMetadata
  if (nft.contractMetadata && nft.contractMetadata.openSea && nft.contractMetadata.openSea.floorPrice) {
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
  // Check for pricing in contract object
  else if (nft.contract && nft.contract.openSea && nft.contract.openSea.floorPrice) {
    price = nft.contract.openSea.floorPrice;
    console.log(`Found floor price in contract.openSea: ${price}`);
  }
  // Check in rawMetadata for OpenSea data (sometimes appears here)
  else if (nft.rawMetadata && nft.rawMetadata.opensea && nft.rawMetadata.opensea.floor_price) {
    price = nft.rawMetadata.opensea.floor_price;
    console.log(`Found floor price in rawMetadata.opensea: ${price}`);
  }
  // Check in metadata if it contains OpenSea data
  else if (nft.metadata) {
    let metadata = nft.metadata;
    if (typeof metadata === 'string') {
      try {
        metadata = JSON.parse(metadata);
      } catch (e) {
        console.error('Error parsing metadata for floor price:', e);
      }
    }
    
    if (metadata && metadata.opensea && metadata.opensea.floor_price) {
      price = metadata.opensea.floor_price;
      console.log(`Found floor price in parsed metadata: ${price}`);
    }
  }
  
  // Determine currency based on network
  if (nft.network === 'polygon' || (nft.id && typeof nft.id === 'string' && nft.id.startsWith('polygon:'))) {
    currency = 'MATIC';
  } else if (nft.network === 'base' || (nft.id && typeof nft.id === 'string' && nft.id.startsWith('base:'))) {
    currency = 'ETH';
  }
  
  // Adjust NaN price
  if (price && isNaN(parseFloat(price))) {
    console.log(`Invalid price format: ${price}`);
    return '';
  }
  
  // Format price if available
  if (price) {
    // Convert to a readable format (4 decimals)
    return `Floor: ${parseFloat(price).toFixed(4)} ${currency}`;
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