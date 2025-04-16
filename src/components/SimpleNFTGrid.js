import React, { useState, useCallback, useEffect, useMemo } from 'react';
import '../styles/NFTGrid.css';
import { Link } from 'react-router-dom';

/**
 * Get a safe image URL from the NFT data
 * @param {Object} nft - The NFT data object
 * @returns {string} - A valid image URL or empty string if none found
 */
const getImageUrl = (nft) => {
  if (!nft) return '';
  
  let imageUrl = '';
  
  // Debug the NFT structure
  console.log('Processing NFT for image:', {
    id: nft.id,
    name: nft.name || nft.title,
    hasImage: !!nft.image,
    imageType: nft.image ? typeof nft.image : 'undefined',
    hasMetadata: !!nft.metadata,
    hasTokenMetadata: !!(nft.tokenMetadata || nft.tokenURI),
    hasMediaArray: !!(nft.media && Array.isArray(nft.media))
  });
  
  // PRIORITY 1: Direct image URL (if string)
  if (typeof nft.image === 'string') {
    imageUrl = nft.image;
    console.log('Using direct image string:', imageUrl);
  }
  
  // PRIORITY 2: Structured image object with URLs
  else if (nft.image && typeof nft.image === 'object') {
    // Try cached URL first (most reliable)
    if (nft.image.cachedUrl) {
      imageUrl = nft.image.cachedUrl;
      console.log('Using cached URL:', imageUrl);
    } 
    // Next try thumbnail (good for performance)
    else if (nft.image.thumbnailUrl) {
      imageUrl = nft.image.thumbnailUrl;
      console.log('Using thumbnail URL:', imageUrl);
    }
    // For SVGs, the PNG conversion is often helpful
    else if (nft.image.pngUrl) {
      imageUrl = nft.image.pngUrl;
      console.log('Using PNG URL:', imageUrl);
    }
    // Finally try original
    else if (nft.image.originalUrl || nft.image.url) {
      imageUrl = nft.image.originalUrl || nft.image.url;
      console.log('Using original URL:', imageUrl);
    }
  }
  
  // PRIORITY 3: Animation URLs for NFTs that are videos or GIFs
  if (!imageUrl && nft.animation_url) {
    imageUrl = nft.animation_url;
    console.log('Using animation URL:', imageUrl);
  }
  else if (!imageUrl && nft.animation && nft.animation.cachedUrl) {
    imageUrl = nft.animation.cachedUrl;
    console.log('Using animation cached URL:', imageUrl);
  }
  
  // PRIORITY 4: Try media array 
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
  
  // PRIORITY 5: Try metadata
  if (!imageUrl && nft.metadata) {
    // Try image properties in metadata
    if (nft.metadata.image) {
      imageUrl = nft.metadata.image;
      console.log('Found image in metadata:', imageUrl);
    } 
    else if (nft.metadata.image_url) {
      imageUrl = nft.metadata.image_url;
      console.log('Found image_url in metadata:', imageUrl);
    }
    else if (nft.metadata.animation_url) {
      imageUrl = nft.metadata.animation_url;
      console.log('Found animation_url in metadata:', imageUrl);
    }
  }
  
  // PRIORITY 6: Try raw metadata
  if (!imageUrl && nft.raw && nft.raw.metadata) {
    const metadata = nft.raw.metadata;
    imageUrl = metadata.image || metadata.image_url || metadata.animation_url || '';
    console.log('Found image in raw metadata:', imageUrl);
  }
  
  // PRIORITY 7: Legacy/fallback checks
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
  
  // Ensure imageUrl is a string
  if (typeof imageUrl !== 'string') {
    if (imageUrl && typeof imageUrl === 'object') {
      console.log('Image URL is an object, extracting string URL:', imageUrl);
      // Try multiple possible properties where the URL might be
      imageUrl = imageUrl.url || imageUrl.gateway || imageUrl.originalUrl || 
                imageUrl.thumbnailUrl || imageUrl.pngUrl || imageUrl.cachedUrl || '';
    } else {
      console.warn('Invalid imageUrl type:', typeof imageUrl, imageUrl);
      imageUrl = '';
    }
  }
  
  // Handle IPFS URLs
  if (imageUrl && imageUrl.startsWith('ipfs://')) {
    const ipfsHash = imageUrl.replace('ipfs://', '');
    // Try Cloudflare IPFS gateway (often more reliable)
    imageUrl = `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`;
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
    imageUrl = 'https://placehold.co/600x600/eee/999?text=No+Image';
    console.log('Using fallback placeholder - no image URL found');
  }
  
  return imageUrl;
};

/**
 * NFT Card Component
 * Displays an individual NFT with image and metadata
 */
const NFTCard = ({ nft }) => {
  const [imageState, setImageState] = useState({
    loaded: false,
    error: false,
    isLoading: true
  });
  
  // Extract image URL using our utility function
  const imageUrl = getImageUrl(nft);
  
  // Get the NFT title
  const nftTitle = nft.metadata?.name || nft.name || `NFT #${nft.token_id || nft.tokenId}`;
  
  // Get contract address from various possible locations
  const contractAddress = nft.contract_address || 
                          nft.contractAddress || 
                          (nft.contract && nft.contract.address) || 
                          getContractAddress(nft);
  
  // Get token ID from various possible locations
  const tokenId = nft.token_id || nft.tokenId || getTokenId(nft);

  useEffect(() => {
    // Reset state when NFT changes
    setImageState({
      loaded: false,
      error: false,
      isLoading: true
    });
    
    // Preload image
    if (imageUrl) {
      const img = new Image();
      img.src = imageUrl;
      
      img.onload = () => {
        setImageState({
          loaded: true,
          error: false,
          isLoading: false
        });
      };
      
      img.onerror = () => {
        setImageState({
          loaded: false,
          error: true,
          isLoading: false
        });
        console.error("Failed to load image", imageUrl);
      };
    }
  }, [imageUrl, nft]);

  // Debugging NFT data
  console.log('NFT Data:', {
    title: nftTitle,
    imageUrl,
    contractAddress,
    tokenId,
    hasMetadata: !!nft.metadata,
    rawNft: nft
  });

  return (
    <div className="nft-card-container">
      <Link to={`/nft/${contractAddress}/${tokenId}`} className="nft-link">
        <div className="nft-image-container">
          {imageUrl && !imageState.error && (
            <img
              src={imageUrl}
              alt={nftTitle}
              className={`nft-image ${imageState.loaded ? 'loaded' : ''}`}
            />
          )}
          {imageState.isLoading && !imageState.error && (
            <div className="nft-image-placeholder">Loading...</div>
          )}
          {imageState.error && (
            <div className="nft-image-error">Failed to load</div>
          )}
        </div>
        <div className="nft-info">
          <h3 className="nft-title">{nftTitle}</h3>
          {nft.collection_name && (
            <p className="nft-collection">{nft.collection_name}</p>
          )}
        </div>
      </Link>
    </div>
  );
};

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
      <div className="nft-grid">
        {nfts.map((nft, index) => {
          // Ensure collection_name is set on the nft object if not already present
          if (!nft.collection_name) {
            nft.collection_name = getCollectionName(nft);
          }
          
          return (
            <NFTCard 
              key={getNftKey(nft) || index} 
              nft={nft}
            />
          );
        })}
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