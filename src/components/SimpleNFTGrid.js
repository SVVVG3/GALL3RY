import React, { useState, useCallback, useEffect, useMemo } from 'react';
import '../styles/NFTGrid.css';
import { Link } from 'react-router-dom';

/**
 * Potentially routes an image through a CORS proxy if needed
 * @param {string} url - The original image URL 
 * @returns {string} - URL potentially routed through proxy
 */
const getCORSProxyUrl = (url) => {
  if (!url) return '';
  
  // Check if we should use a proxy
  const needsProxy = 
    url.includes('nft-cdn.alchemy.com') || 
    url.includes('i.seadn.io') ||
    url.includes('cloudflare-ipfs.com') ||
    url.includes('ipfs.io') ||
    url.startsWith('ipfs://');
  
  if (needsProxy) {
    // Use our internal image proxy
    return `/api/image-proxy?url=${encodeURIComponent(url)}`;
  }
  
  return url;
};

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
    hasTokenMetadata: !!(nft.tokenMetadata || nft.tokenURI)
  });
  
  // PRIORITY 1: Alchemy structured image object from API response example
  if (nft.image && typeof nft.image === 'object') {
    // Try cached URL first (most reliable from Alchemy API)
    if (nft.image.cachedUrl) {
      imageUrl = nft.image.cachedUrl;
      console.log('Using cached URL:', imageUrl);
    } 
    // Try PNG URL (good for SVG conversions)
    else if (nft.image.pngUrl) {
      imageUrl = nft.image.pngUrl;
      console.log('Using PNG URL:', imageUrl);
    }
    // Try thumbnail (good for performance)
    else if (nft.image.thumbnailUrl) {
      imageUrl = nft.image.thumbnailUrl;
      console.log('Using thumbnail URL:', imageUrl);
    }
    // Finally try original
    else if (nft.image.originalUrl) {
      imageUrl = nft.image.originalUrl;
      console.log('Using original URL:', imageUrl);
    }
    // Try gateway URL
    else if (nft.image.gateway) {
      imageUrl = nft.image.gateway;
      console.log('Using gateway URL:', imageUrl);
    }
  }
  
  // PRIORITY 2: Direct image URL (if string)
  else if (typeof nft.image === 'string') {
    imageUrl = nft.image;
    console.log('Using direct image string:', imageUrl);
  }
  
  // PRIORITY 3: Animation URLs for NFTs that are videos or GIFs
  if (!imageUrl && nft.animation) {
    if (nft.animation.cachedUrl) {
      imageUrl = nft.animation.cachedUrl;
      console.log('Using animation cached URL:', imageUrl);
    }
  }
  else if (!imageUrl && nft.animation_url) {
    imageUrl = nft.animation_url;
    console.log('Using animation URL:', imageUrl);
  }
  
  // PRIORITY 4: Try raw metadata structures based on the Alchemy API response
  if (!imageUrl && nft.raw) {
    // Try the new raw.metadata structure from Alchemy API
    if (nft.raw.metadata) {
      const metadata = nft.raw.metadata;
      imageUrl = metadata.image || metadata.image_url || metadata.image_data || '';
      if (imageUrl) console.log('Found image in raw.metadata:', imageUrl);
    }
  }
  
  // PRIORITY 5: Try media array 
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
  
  // PRIORITY 6: Try metadata
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
  
  // Use a fallback placeholder if no image found
  if (!imageUrl) {
    imageUrl = `/placeholder.png`; // Use relative path that works on both dev/prod
    console.log('Using fallback placeholder - no image URL found');
    return imageUrl;
  }
  
  // Handle IPFS URLs
  if (imageUrl && imageUrl.startsWith('ipfs://')) {
    const ipfsHash = imageUrl.replace('ipfs://', '');
    // Use our image proxy to handle IPFS URLs
    imageUrl = `/api/image-proxy?url=${encodeURIComponent(`ipfs://${ipfsHash}`)}`;
    console.log('Converted IPFS URL through proxy:', imageUrl);
    return imageUrl;
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
  
  // Special handling for NFT CDN URLs 
  if (imageUrl && imageUrl.includes('nft-cdn.alchemy.com')) {
    // Add format if needed
    if (!imageUrl.includes('/original') && !imageUrl.includes('/thumb') && 
        !imageUrl.includes('.jpg') && !imageUrl.includes('.png') && 
        !imageUrl.includes('?')) {
      imageUrl = `${imageUrl}/original`;
      console.log('Added format to Alchemy CDN URL:', imageUrl);
    }
    
    // Use our image proxy for Alchemy CDN URLs
    imageUrl = `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
    console.log('Using proxy for Alchemy CDN URL:', imageUrl);
    return imageUrl;
  }
  
  // IPFS URLs and other problematic URLs need proxying
  if (imageUrl.includes('/ipfs/') || 
      imageUrl.includes('ipfs.io') || 
      imageUrl.includes('gateway.pinata.cloud') || 
      imageUrl.includes('ipfs.infura.io') || 
      imageUrl.includes('ipfs.fleek.co') ||
      imageUrl.includes('i.seadn.io')) {
    
    // Route through our image proxy
    imageUrl = `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
    console.log('Using proxy for potentially CORS-restricted URL:', imageUrl);
    return imageUrl;
  }
  
  // Default - return the URL directly
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
    isLoading: true,
    currentUrl: null,
    attemptCount: 0
  });
  
  // Get primary image URL
  const primaryImageUrl = getImageUrl(nft);
  
  // Track the current URL being used
  const [currentImageUrl, setCurrentImageUrl] = useState(primaryImageUrl);
  
  // Get the NFT title
  const nftTitle = nft.metadata?.name || nft.name || `NFT #${nft.token_id || nft.tokenId}`;
  
  // Get contract address from various possible locations
  const contractAddress = nft.contract_address || 
                          nft.contractAddress || 
                          (nft.contract && nft.contract.address) || 
                          getContractAddress(nft);
  
  // Get token ID from various possible locations
  const tokenId = nft.token_id || nft.tokenId || getTokenId(nft);

  // Generate fallback URLs for different image formats - simplify this to focus on formats rather than gateways
  const generateFallbackUrls = useCallback((baseUrl) => {
    if (!baseUrl) return [];
    
    let urls = [baseUrl]; // Start with the original URL
    
    // If the URL is not already using our proxy and it's an external URL that might have CORS issues,
    // add a proxied version as a fallback
    if (!baseUrl.startsWith('/api/image-proxy') && 
        !baseUrl.startsWith('/') && 
        !baseUrl.startsWith('data:')) {
      urls.push(`/api/image-proxy?url=${encodeURIComponent(baseUrl)}`);
    }
    
    // Add placeholder as final fallback
    urls.push('/placeholder.png');
    
    // Ensure no duplicates
    return [...new Set(urls)];
  }, []);

  // Try all fallbacks in sequence
  useEffect(() => {
    if (!primaryImageUrl) {
      setImageState({
        loaded: false, 
        error: true,
        isLoading: false,
        currentUrl: null,
        attemptCount: 0
      });
      return;
    }
    
    // Reset state when primary URL changes
    setImageState({
      loaded: false,
      error: false,
      isLoading: true,
      currentUrl: primaryImageUrl,
      attemptCount: 0
    });
    
    // Initialize with the primary URL
    setCurrentImageUrl(primaryImageUrl);
    
    // Generate fallback URLs
    const fallbackUrls = generateFallbackUrls(primaryImageUrl);
    console.log(`Generated ${fallbackUrls.length} fallback URLs for ${nftTitle}:`, fallbackUrls);
    
    // Track active attempts and timeouts for cleanup
    let isActive = true;
    let timeoutId = null;
    
    // Function to try loading an image with exponential backoff
    const tryLoadImage = (url, attemptIndex) => {
      // Add delay for retries to avoid rate limiting
      const delayMs = attemptIndex === 0 ? 0 : Math.min(1000 * Math.pow(1.5, attemptIndex - 1), 5000);
      
      console.log(`Attempt ${attemptIndex+1}/${fallbackUrls.length}: Loading ${url} for ${nftTitle}${delayMs > 0 ? ` (delayed ${delayMs}ms)` : ''}`);
      
      // Clear any existing timeout
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      // Use timeout for delay (even for first attempt for consistency)
      timeoutId = setTimeout(() => {
        if (!isActive) return;
        
        const img = new Image();
        
        // Set a timeout to catch hanging requests - reduced for better UX
        const loadTimeoutId = setTimeout(() => {
          // Image is taking too long to load, consider it failed and move to next
          if (img.complete) return; // Already completed
          
          console.error(`⏱️ Image load timeout for ${url}`);
          img.src = ''; // Cancel the current request

          // Try next fallback if available
          if (attemptIndex < fallbackUrls.length - 1) {
            tryLoadImage(fallbackUrls[attemptIndex + 1], attemptIndex + 1);
          } else {
            // All fallbacks failed - use placeholder
            const origin = typeof window !== 'undefined' ? window.location.origin : '';
            setImageState({
              loaded: true, // Set to true to avoid showing loading state
              error: true,
              isLoading: false,
              currentUrl: `${origin}/placeholder.png`,
              attemptCount: attemptIndex + 1
            });
            setCurrentImageUrl(`${origin}/placeholder.png`);
          }
        }, 7000); // 7 second timeout for image loading
        
        img.onload = () => {
          if (!isActive) return;
          
          clearTimeout(loadTimeoutId);
          console.log(`✅ Successfully loaded image ${url} for ${nftTitle}`);
          setImageState({
            loaded: true,
            error: false,
            isLoading: false,
            currentUrl: url,
            attemptCount: attemptIndex + 1
          });
          setCurrentImageUrl(url);
        };
        
        img.onerror = () => {
          if (!isActive) return;
          
          clearTimeout(loadTimeoutId);
          console.error(`❌ Failed to load image ${url} for ${nftTitle}`);
          
          // Try next fallback if available
          if (attemptIndex < fallbackUrls.length - 1) {
            tryLoadImage(fallbackUrls[attemptIndex + 1], attemptIndex + 1);
          } else {
            // All fallbacks failed - use placeholder
            const origin = typeof window !== 'undefined' ? window.location.origin : '';
            setImageState({
              loaded: true, // Set to true to avoid showing loading state
              error: true,
              isLoading: false,
              currentUrl: `${origin}/placeholder.png`,
              attemptCount: attemptIndex + 1
            });
            setCurrentImageUrl(`${origin}/placeholder.png`);
          }
        };
        
        // Always set crossOrigin for external URLs to avoid CORS issues
        // This is important - we need to tell the browser to use CORS for these requests
        if (!url.startsWith('/') && !url.startsWith('data:')) {
          img.crossOrigin = 'anonymous';
        }
        
        img.src = url;
      }, delayMs);
    };
    
    // Start trying with the first URL
    if (fallbackUrls.length > 0) {
      tryLoadImage(fallbackUrls[0], 0);
    }
    
    // Cleanup function
    return () => {
      isActive = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [primaryImageUrl, nftTitle, generateFallbackUrls]);

  return (
    <div className="nft-card-container">
      <Link to={`/nft/${contractAddress}/${tokenId}`} className="nft-link">
        <div className="nft-image-container">
          {!imageState.error && (
            <img
              src={currentImageUrl}
              alt={nftTitle}
              className={`nft-image ${imageState.loaded ? 'loaded' : 'loading'}`}
              onError={(e) => {
                console.error(`Image load error for ${currentImageUrl}`);
                // Set fallback image directly
                e.target.src = '/placeholder.png';
                e.target.className = 'nft-image fallback';
              }}
              loading="lazy"
              crossOrigin="anonymous" 
              referrerPolicy="no-referrer" // Add this to prevent referrer issues
            />
          )}
          {imageState.isLoading && !imageState.loaded && !imageState.error && (
            <div className="nft-image-placeholder">
              Loading image...
            </div>
          )}
          {imageState.error && (
            <div className="nft-image-error">
              <img 
                src="/placeholder.png"
                alt={`${nftTitle} (unavailable)`}
                className="nft-image fallback"
              />
            </div>
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