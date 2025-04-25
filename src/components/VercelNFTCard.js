import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '@farcaster/auth-kit';
import '../styles/nft-unified.css';
import CollectionFriendsModal from './CollectionFriendsModal';
import { createPortal } from 'react-dom';

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
const VercelNFTCard = ({ nft, virtualized = false }) => {
  const { isAuthenticated } = useAuth();
  const { profile } = useProfile();
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [debugMediaUrl, setDebugMediaUrl] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState('image'); // 'image', 'video', or 'unsupported'
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [modalContractAddress, setModalContractAddress] = useState(null);
  const [modalNetwork, setModalNetwork] = useState('eth'); // Add state for network
  const cardRef = useRef(null);
  
  // EMERGENCY FIX: Global override for Alien Frens images
  useEffect(() => {
    // Only run this once when component mounts
    // Create a more comprehensive global fix for all images
    const fixAlienFrensImages = () => {
      console.log('Applying comprehensive Alien Frens image fix');
      
      // 1. Override the Image.prototype.src setter
      const originalImageSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
      
      Object.defineProperty(HTMLImageElement.prototype, 'src', {
        get: originalImageSrc.get,
        set: function(url) {
          // Check if this is an alienfrens.mypinata.cloud URL
          if (typeof url === 'string' && url.includes('alienfrens.mypinata.cloud/ipfs/')) {
            console.log('GLOBAL FIX: Intercepted Alien Frens URL', url);
            
            // Extract the IPFS hash
            const ipfsMatch = url.match(/\/ipfs\/([^/?#]+)/);
            if (ipfsMatch && ipfsMatch[1]) {
              const ipfsHash = ipfsMatch[1];
              // Try multiple alternative gateways
              // Use direct gateway rather than proxy to bypass any issues with the proxy
              const fixedUrl = `https://dweb.link/ipfs/${ipfsHash}`;
              console.log('GLOBAL FIX: Redirecting to', fixedUrl);
              
              // Apply the fixed URL
              originalImageSrc.set.call(this, fixedUrl);
              return;
            }
          }
          
          // Default behavior for other URLs
          originalImageSrc.set.call(this, url);
        }
      });
      
      // 2. Find and fix any already created images with Alien Frens URLs
      setTimeout(() => {
        try {
          const allImages = document.querySelectorAll('img');
          let fixedCount = 0;
          
          allImages.forEach(img => {
            const currentSrc = img.getAttribute('src');
            if (currentSrc && currentSrc.includes('alienfrens.mypinata.cloud/ipfs/')) {
              const ipfsMatch = currentSrc.match(/\/ipfs\/([^/?#]+)/);
              if (ipfsMatch && ipfsMatch[1]) {
                const ipfsHash = ipfsMatch[1];
                // Try multiple alternative gateways
                const newSrc = `https://dweb.link/ipfs/${ipfsHash}`;
                console.log(`DIRECT FIX: Replacing existing image src from ${currentSrc} to ${newSrc}`);
                
                // Create a replacement image
                const newImg = new Image();
                newImg.onload = function() {
                  console.log('Replacement image loaded successfully:', newSrc);
                  img.src = newSrc;  // This will use our overridden setter
                  fixedCount++;
                };
                newImg.onerror = function() {
                  console.error('Replacement image failed to load:', newSrc);
                  // Try an alternative gateway as fallback
                  const fallbackSrc = `https://ipfs.io/ipfs/${ipfsHash}`;
                  console.log('Trying fallback source:', fallbackSrc);
                  img.src = fallbackSrc;
                };
                
                // Start loading the replacement image
                newImg.src = newSrc;
              }
            }
          });
          
          if (fixedCount > 0) {
            console.log(`Fixed ${fixedCount} existing Alien Frens images on the page`);
          }
        } catch (e) {
          console.error('Error while fixing existing images:', e);
        }
      }, 1000); // Wait for 1 second to allow the DOM to stabilize
      
      // 3. Add a MutationObserver to catch dynamically added images
      try {
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
              mutation.addedNodes.forEach((node) => {
                // Check if the added node is an image
                if (node.nodeName === 'IMG') {
                  const src = node.getAttribute('src');
                  if (src && src.includes('alienfrens.mypinata.cloud/ipfs/')) {
                    const ipfsMatch = src.match(/\/ipfs\/([^/?#]+)/);
                    if (ipfsMatch && ipfsMatch[1]) {
                      const ipfsHash = ipfsMatch[1];
                      const newSrc = `https://dweb.link/ipfs/${ipfsHash}`;
                      console.log(`OBSERVER FIX: Setting new image src to ${newSrc}`);
                      node.src = newSrc; // This will use our overridden setter
                    }
                  }
                }
                
                // Also check child nodes for images
                if (node.querySelectorAll) {
                  const images = node.querySelectorAll('img');
                  images.forEach(img => {
                    const src = img.getAttribute('src');
                    if (src && src.includes('alienfrens.mypinata.cloud/ipfs/')) {
                      const ipfsMatch = src.match(/\/ipfs\/([^/?#]+)/);
                      if (ipfsMatch && ipfsMatch[1]) {
                        const ipfsHash = ipfsMatch[1];
                        const newSrc = `https://dweb.link/ipfs/${ipfsHash}`;
                        console.log(`OBSERVER FIX: Setting child image src to ${newSrc}`);
                        img.src = newSrc; // This will use our overridden setter
                      }
                    }
                  });
                }
              });
            }
          });
        });
        
        // Start observing
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
        
        console.log('Image mutation observer started to catch dynamic Alien Frens images');
      } catch (e) {
        console.error('Error setting up mutation observer:', e);
      }
    };
    
    // Apply the fix
    fixAlienFrensImages();
    
    // Also add a debug function to the window object for manual fixing
    window.fixAlienFrensImages = () => {
      console.log('Manually triggered Alien Frens fix');
      
      // Find all images that might be problematic
      const images = document.querySelectorAll('img');
      let count = 0;
      
      images.forEach(img => {
        // Check for error state or src containing alienfrens.mypinata.cloud
        if (img.src && img.src.includes('alienfrens.mypinata.cloud/ipfs/')) {
          const ipfsMatch = img.src.match(/\/ipfs\/([^/?#]+)/);
          if (ipfsMatch && ipfsMatch[1]) {
            const ipfsHash = ipfsMatch[1];
            // Try a different gateway directly
            const newSrc = `https://nftstorage.link/ipfs/${ipfsHash}`;
            console.log(`MANUAL FIX: Changing image from ${img.src} to ${newSrc}`);
            img.src = newSrc;
            count++;
          }
        }
      });
      
      return `Fixed ${count} images`;
    };

    // Cleanup: restore original behavior when component unmounts
    return () => {
      // Restore original Image.prototype.src
      try {
        Object.defineProperty(HTMLImageElement.prototype, 'src', originalImageSrc);
      } catch (e) {
        console.error('Error in cleanup:', e);
      }
    };
  }, []);

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
                   // Handle direct floorPrice values from Alchemy API v3
                   nft?.collection?.floorPrice || 
                   // Handle possible root level floorPrice
                   nft?.floorPrice || 
                   null;
  const valueEth = floorPrice?.value || 
                   nft?.floorPrice?.value || 
                   // If we have a direct numeric floor price value
                   (typeof valueUsd === 'number' ? valueUsd : null) ||
                   // Rough ETH conversion if only USD is available
                   (valueUsd && typeof valueUsd !== 'number' ? (valueUsd / 2000) : null);
  
  // Format the value for display - show USD values in ETH format with 4 decimal places
  const formattedValue = useMemo(() => {
    // Handle different types of floor price data
    if (valueUsd !== null && valueUsd !== undefined) {
      const numericValue = typeof valueUsd === 'number' ? valueUsd : parseFloat(valueUsd);
      if (!isNaN(numericValue)) {
        return `${numericValue.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} ETH`;
      }
    } 
    
    if (valueEth !== null && valueEth !== undefined) {
      const numericValue = typeof valueEth === 'number' ? valueEth : parseFloat(valueEth);
      if (!isNaN(numericValue)) {
        return `${numericValue.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} ETH`;
      }
    }
    
    return null;
  }, [valueUsd, valueEth]);
  
  // Log value data for debugging (only in dev and only for first few NFTs)
  useEffect(() => {
    // Debug more NFTs to see what's happening
    if (nft?.contract?.address === "0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d" || // BAYC
        nft?.contract?.address === "0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d" || // Azuki
        nft?.collection?.name?.includes("AlfaFrens") || 
        nft?.collection?.name?.includes("AlienFrens") || 
        title.includes('#1') || 
        title.includes('#2')) {
      console.log(`Full NFT data for ${title}:`, {
        nft,
        valueUsd,
        valueEth,
        formattedValue,
        type: {
          valueUsd: typeof valueUsd,
          valueEth: typeof valueEth,
        },
        rawCollection: nft?.collection,
        contract: nft?.contract,
        floorPriceExists: !!formattedValue,
        paths: {
          collectionFloorPriceUsd: nft?.collection?.floorPrice?.valueUsd,
          directFloorPriceUsd: nft?.floorPrice?.valueUsd,
          openSeaFloorPrice: nft?.contractMetadata?.openSea?.floorPrice,
          openSeaMetadataFloorPrice: nft?.contract?.openSeaMetadata?.floorPrice,
          directCollectionFloorPrice: nft?.collection?.floorPrice,
          directNftFloorPrice: nft?.floorPrice,
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

  // Memoize the media type function to avoid dependency warnings
  const getMediaType = useMemo(() => (url) => {
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
  }, [nft]); // Include nft in dependencies

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
      
      // Special case handling for problematic IPFS URLs
      // Check for known problematic domains like alienfrens.mypinata.cloud
      if (foundUrl && foundUrl.includes('alienfrens.mypinata.cloud/ipfs/')) {
        console.log('Found alienfrens.mypinata.cloud URL, applying special fix');
        
        // Extract the IPFS hash
        const ipfsMatch = foundUrl.match(/\/ipfs\/([^/?#]+)/);
        if (ipfsMatch && ipfsMatch[1]) {
          const ipfsHash = ipfsMatch[1];
          // Use a different gateway that has better access
          foundUrl = `https://ipfs.io/ipfs/${ipfsHash}`;
          source = "alienfrens-fix";
          console.log(`Converted problematic URL to: ${foundUrl}`);
        }
      }
      
      return { url: foundUrl, source };
    };

    // Generate the safest URL for production
    const getProxyUrl = (url) => {
      if (!url) {
        console.log("No URL to proxy, using placeholder");
        return "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIiB2aWV3Qm94PSIwIDAgMzAwIDMwMCI+PHJlY3Qgd2lkdGg9IjMwMCIgaGVpZ2h0PSIzMDAiIGZpbGw9IiNmMGYwZjAiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjE4IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNjY2Ij5JbWFnZSB1bmF2YWlsYWJsZTwvdGV4dD48L3N2Zz4=";
      }
      
      // Special case for Alchemy CDN URLs - ensure proper format and add API key
      if (url.includes('nft-cdn.alchemy.com')) {
        // Check if URL already has /original or /thumb format
        const needsFormat = !url.includes('/original') && !url.includes('/thumb');
        let formattedUrl = url;
        
        if (needsFormat) {
          // Add /original for better image quality
          formattedUrl = `${url}/original`;
          console.log(`Added format specifier to Alchemy URL: ${formattedUrl}`);
        }
        
        // Add API key if not present
        const apiKey = process.env.REACT_APP_ALCHEMY_API_KEY || '-DhGb2lvitCWrrAmLnF5TZLl-N6l8Lak';
        if (!formattedUrl.includes('apiKey=') && apiKey) {
          formattedUrl = `${formattedUrl}${formattedUrl.includes('?') ? '&' : '?'}apiKey=${apiKey}`;
          console.log("Added API key to Alchemy URL");
        }
        
        // Important change: For Alchemy URLs, always use the image proxy to avoid CORS issues
        const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(formattedUrl)}`;
        console.log(`Proxying Alchemy URL through: ${proxyUrl}`);
        return proxyUrl;
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
  const placeholderUrl = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f0f0f0'/%3E%3Ctext x='50' y='50' font-family='Arial' font-size='14' text-anchor='middle' alignment-baseline='middle' fill='%23999999'%3ENFT%3C/text%3E%3C/svg%3E";
  
  // Log more detailed debugging info including NFT collection & ID
  useEffect(() => {
    console.log(`NFT ${title} (${nft?.collection_name || 'Unknown Collection'}) ID: ${nft?.tokenId || nft?.token_id || 'Unknown'}`);
    console.log(`Using media URL: ${mediaUrl} (type: ${mediaType})`);
    console.log(`Original URL: ${debugMediaUrl}`);
    console.log(`Loading state: ${mediaLoaded ? 'Loaded' : 'Loading'}, Error state: ${mediaError ? 'Error' : 'No Error'}`);
  }, [mediaUrl, mediaLoaded, mediaError, title, mediaType, debugMediaUrl, nft]);
  
  // Handle media load success
  const handleMediaLoad = () => {
    console.log(`Media loaded successfully: ${mediaUrl}`);
    setMediaLoaded(true);
    setMediaError(false);
    
    // Debug - check to make sure our card element exists
    if (cardRef.current) {
      console.log("Card element exists, applying visibility fix");
      // Force element repaint and ensure visibility
      cardRef.current.style.opacity = '0.99';
      cardRef.current.style.display = 'block';
      // Force image to be visible directly
      const imgElement = cardRef.current.querySelector('.nft-image, .nft-video');
      if (imgElement) {
        imgElement.style.opacity = '1';
        imgElement.style.visibility = 'visible';
        console.log("Applied direct visibility fix to media element");
      }
      // Final repaint trigger
      setTimeout(() => {
        if (cardRef.current) cardRef.current.style.opacity = '1';
      }, 10);
    } else {
      console.warn("Card ref is null, couldn't apply visibility fix");
    }
  };
  
  // Handle media load error
  const handleMediaError = () => {
    console.log(`Media load error: ${mediaUrl}`);
    setMediaError(true);
    setMediaLoaded(true); // Consider it "loaded" but with error
    
    // Special case for Alien Frens (high priority fix)
    if (debugMediaUrl && debugMediaUrl.includes('alienfrens.mypinata.cloud/ipfs/')) {
      console.log('Detected failing Alien Frens URL, applying emergency fix');
      const ipfsMatch = debugMediaUrl.match(/\/ipfs\/([^/?#]+)/);
      if (ipfsMatch && ipfsMatch[1]) {
        const ipfsHash = ipfsMatch[1];
        // Try multiple alternative gateways in order of reliability
        const newUrl = `https://dweb.link/ipfs/${ipfsHash}`;
        console.log(`Applying Alien Frens emergency fix, using: ${newUrl}`);
        setDebugMediaUrl(newUrl);
        const proxiedUrl = `/api/image-proxy?url=${encodeURIComponent(newUrl)}`;
        setMediaUrl(proxiedUrl);
        setMediaError(false);
        return;
      }
    }
    
    // Check if this is an IPFS URL that we can try to fix
    const ipfsPatterns = [
      { pattern: /ipfs:\/\/([^/]+)/, replacement: 'https://cloudflare-ipfs.com/ipfs/$1' },
      { pattern: /https:\/\/[^/]+\.mypinata\.cloud\/ipfs\/([^/]+)/, replacement: 'https://ipfs.io/ipfs/$1' },
      { pattern: /https:\/\/gateway\.pinata\.cloud\/ipfs\/([^/]+)/, replacement: 'https://ipfs.io/ipfs/$1' },
      { pattern: /https:\/\/cloudflare-ipfs\.com\/ipfs\/([^/]+)/, replacement: 'https://ipfs.io/ipfs/$1' },
      { pattern: /https:\/\/ipfs\.io\/ipfs\/([^/]+)/, replacement: 'https://dweb.link/ipfs/$1' }
    ];
    
    // Try to find a pattern match to create an alternative URL
    for (const { pattern, replacement } of ipfsPatterns) {
      if (debugMediaUrl && pattern.test(debugMediaUrl)) {
        const newUrl = debugMediaUrl.replace(pattern, replacement);
        console.log(`Attempting fallback for IPFS media: ${newUrl}`);
        
        // Update the media URL to the new fallback
        setDebugMediaUrl(newUrl);
        
        // Use API proxy for the new URL
        const proxiedUrl = `/api/image-proxy?url=${encodeURIComponent(newUrl)}`;
        setMediaUrl(proxiedUrl);
        
        // Reset error state to trigger a new load attempt
        setMediaError(false);
        return;
      }
    }
    
    // Check if this is a regular URL with a 403/404 error - if so, try our proxy
    if (debugMediaUrl && debugMediaUrl.startsWith('http') && !mediaUrl.includes('/api/image-proxy')) {
      console.log('Attempting to use image proxy as fallback');
      const proxiedUrl = `/api/image-proxy?url=${encodeURIComponent(debugMediaUrl)}`;
      setMediaUrl(proxiedUrl);
      setMediaError(false);
      return;
    }
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
    
    // Extract network/chain information from NFT data
    const network = nft?.chain || nft?.network || nft?.chainId || 
                   (nft?.id && nft.id.includes(':') ? nft.id.split(':')[0] : null) || 'eth';
    
    // Set the network in state
    setModalNetwork(network);
    
    // Add debug logging to see the NFT data structure
    console.log('DEBUG NFT DATA BEFORE OPENING MODAL:', {
      nft,
      collectionName: collection,
      contractAddress,
      network,
      hasContractAddress: !!contractAddress,
      contractPaths: {
        'nft?.contract?.address': nft?.contract?.address,
        'nft?.contractAddress': nft?.contractAddress,
        'nft?.contract_address': nft?.contract_address,
        'nft?.id?.split': nft?.id ? nft.id.split(':') : null,
        'raw id': nft?.id,
        'chain/network info': `${nft?.chain || 'undefined'}/${nft?.network || 'undefined'}/${nft?.chainId || 'undefined'}`
      }
    });
    
    if (!contractAddress) {
      console.error('Cannot open collection friends modal - missing contract address', nft);
      
      // Try to extract a contract address from the NFT raw data
      let extractedAddress;
      
      // Try common properties where contract address might be found
      if (nft?.contract?.address) {
        extractedAddress = nft.contract.address;
      } else if (nft?.contractAddress) {
        extractedAddress = nft.contractAddress;
      } else if (nft?.token?.contractAddress) {
        extractedAddress = nft.token.contractAddress;
      } else if (nft?.tokenMetadata?.contractAddress) {
        extractedAddress = nft.tokenMetadata.contractAddress;
      } else if (nft?.contract_address) {
        extractedAddress = nft.contract_address;
      } else if (nft?.id && typeof nft.id === 'string' && nft.id.includes(':')) {
        // Try to extract from ID format like "eth:0x1234:789"
        const parts = nft.id.split(':');
        if (parts.length >= 3) {
          extractedAddress = parts[2];
        }
      } else if (nft?.metadata?.contract?.address) {
        extractedAddress = nft.metadata.contract.address;
      }
      
      if (extractedAddress) {
        console.log(`Found alternative contract address: ${extractedAddress}`);
        // Store the found address
        setModalContractAddress(extractedAddress);
        // Continue with the extracted address
        setShowFriendsModal(true);
      } else {
        console.error('No contract address found. Cannot open friends modal.');
        // You could show an error message to the user here
        return;
      }
    } else {
      // Store the known contract address
      setModalContractAddress(contractAddress);
      setShowFriendsModal(true);
    }
  };
  
  const handleCloseFriendsModal = () => {
    console.log('Closing modal...');
    // Force immediate update to ensure the modal closes
    setShowFriendsModal(false);
    console.log('Modal state after close:', false);
    
    // Make sure we restore body scrolling
    document.body.style.overflow = 'auto';
    document.body.style.position = 'static';
    document.body.classList.remove('modal-open');
    
    // Delay to ensure DOM updates fully processed
    setTimeout(() => {
      console.log('Restoring scrolling via setTimeout');
      document.body.style.overflow = 'auto';
      document.body.style.position = 'static';
      window.scrollTo(window.scrollX, window.scrollY); // Trigger reflow
    }, 100);
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
  
  // Check if we have a contract address to show friends button
  const showFriendsButton = contractAddress ? true : false;
  
  // Handle modal click - stop propagation
  const handleModalClick = (e) => {
    e.stopPropagation();
    e.preventDefault(); // Prevent any default behavior
  };
  
  // Add missing handleCardClick function
  const handleCardClick = (e) => {
    // Prevent propagation if we have friends modal open
    if (showFriendsModal) {
      e.stopPropagation();
    }
    // Card click handling - can be expanded later if needed
  };
  
  // Render the NFT card
  return (
    <div 
      ref={cardRef}
      className="vercel-nft-card" 
      onClick={handleCardClick}
      style={{ 
        position: 'relative',
        opacity: 1, // Force opacity
        visibility: 'visible', // Force visibility
        display: 'flex',
        flexDirection: 'column',
        border: mediaError ? '1px solid #ffcccc' : undefined // Highlight cards with errors
      }}
    >
      {/* Media container */}
      <div className="nft-media-container" style={{ opacity: 1, visibility: 'visible' }}>
        {/* Always render the media element regardless of loading state for better UX */}
        {mediaType === 'image' && (
          <img
            src={mediaUrl || placeholderUrl}
            alt={title || 'NFT'}
            className="nft-image"
            onLoad={handleMediaLoad}
            onError={handleMediaError}
            style={{ 
              display: 'block',
              objectFit: 'cover',
              width: '100%',
              height: '100%',
              opacity: mediaLoaded && !mediaError ? 1 : 0,
              visibility: mediaLoaded && !mediaError ? 'visible' : 'hidden',
              transition: 'opacity 0.3s ease-in',
              position: 'absolute',
              top: 0,
              left: 0
            }}
          />
        )}
        
        {mediaType === 'video' && (
          <video
            src={mediaUrl}
            className="nft-video"
            autoPlay={false}
            loop
            muted
            playsInline
            controls={false}
            onLoadedData={handleMediaLoad}
            onError={handleMediaError}
            style={{ 
              display: 'block',
              objectFit: 'cover',
              width: '100%',
              height: '100%',
              opacity: mediaLoaded && !mediaError ? 1 : 0,
              visibility: mediaLoaded && !mediaError ? 'visible' : 'hidden'
            }}
          />
        )}
        
        {/* Loading indicator - show when not loaded and no error */}
        {(!mediaLoaded && !mediaError) && (
          <div className="nft-media-loader" style={{ 
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
            <div className="loading-indicator" style={{
              width: '30px',
              height: '30px',
              border: '3px solid rgba(0, 0, 0, 0.1)',
              borderTopColor: '#7c3aed',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
            <style>{spinKeyframes}</style>
          </div>
        )}
        
        {/* Error state - show placeholder when there's an error */}
        {mediaError && (
          <div className="nft-media-error" style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f8fafc',
            zIndex: 2,
            flexDirection: 'column',
            padding: '10px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '24px', marginBottom: '8px', color: '#aaa' }}>🖼️</div>
            <div style={{ fontSize: '14px', color: '#888' }}>Image unavailable</div>
          </div>
        )}
      </div>
      
      {/* NFT Info */}
      <div className="nft-info-container">
        <p className="nft-name">{title || 'Unnamed NFT'}</p>
        <p className="nft-collection">
          {collection || nft?.collection_name || 'Unknown Collection'}
        </p>
        
        {/* Show the Collection Friends button if user is authenticated with Farcaster */}
        {(isAuthenticated || profile?.fid) && contractAddress && (
          <div className="collection-friends-button" onClick={handleShowFriends}>
            <svg className="friends-icon" viewBox="0 0 24 24" fill="#6c5ce7">
              <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </div>
        )}
      </div>
      
      {/* Collection Friends Modal */}
      {showFriendsModal && modalContractAddress && createPortal(
        <div className="modal-overlay" onClick={handleModalClick}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <CollectionFriendsModal 
              contractAddress={modalContractAddress}
              network={modalNetwork}
              onClose={handleCloseFriendsModal} 
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

// Optimize VercelNFTCard with React.memo to prevent unnecessary rerenders in virtualized list
export default React.memo(VercelNFTCard, (prevProps, nextProps) => {
  // Only rerender if the NFT has changed
  // This significantly improves performance in virtualized lists
  return prevProps.nft?.uniqueId === nextProps.nft?.uniqueId;
}); 