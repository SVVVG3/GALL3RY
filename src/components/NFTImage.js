import React, { useState, useEffect } from 'react';

/**
 * NFTImage component that displays an NFT image with loading and error states
 * @param {Object} props
 * @param {string} props.src - The image URL
 * @param {string} props.alt - Alt text for the image
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.fallbackSrc - Fallback image URL if main image fails
 * @param {boolean} props.isPlaceholder - Whether to show a placeholder
 */
const NFTImage = ({ 
  src, 
  alt = 'NFT Image', 
  className = '', 
  fallbackSrc = 'https://placehold.co/400x400?text=NFT',
  isPlaceholder = false
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);

  // Process the image URL to handle IPFS and potential CORS issues
  const processImageUrl = (url) => {
    if (!url) return null;
    
    // Log original URL for debugging
    console.log('Processing image URL:', url);
    
    // Handle IPFS URLs - use multiple gateways for better reliability
    if (url.startsWith('ipfs://')) {
      // Use a more reliable IPFS gateway
      return url.replace('ipfs://', 'https://ipfs.io/ipfs/');
    }
    
    // Handle Arweave URLs
    if (url.startsWith('ar://')) {
      return url.replace('ar://', 'https://arweave.net/');
    }
    
    // Handle relative URLs that might be missing the protocol
    if (url.startsWith('//')) {
      return `https:${url}`;
    }
    
    // Fix Google Storage URLs that may have CORS issues
    if (url.includes('storage.googleapis.com')) {
      // Try to use a CORS proxy or direct URL depending on what's in your network tab
      // If you're seeing successful requests to storage.googleapis.com, then we need to 
      // fix how the image is being used rather than the URL itself
      console.log('Found Google Storage URL, using direct:', url);
      return url;
    }
    
    // Fix CORS issues with direct image URLs by using an image proxy
    if (url.includes('i.seadn.io') || url.includes('openseauserdata.com')) {
      console.log('Using proxy for OpenSea URL:', url);
      return url; // Keep as is since we see these loading in your network tab
    }
    
    // Fix Art Blocks URLs that are failing
    if (url.includes('generator.artblocks.io') && !url.includes('https://')) {
      return `https://${url.replace(/^https?:\/\//, '')}`;
    }
    
    // Sometimes URLs come back with encoding issues
    if (url.includes('%')) {
      try {
        // Try to decode the URL if it's encoded
        url = decodeURIComponent(url);
      } catch (e) {
        console.warn('Failed to decode URL:', url);
      }
    }
    
    // Fix common image CDN issues by removing size parameters
    if (url.includes('warpcast.com') && url.includes('size=')) {
      url = url.replace(/([?&])size=\d+/, '$1size=600');
    }
    
    console.log('Processed URL:', url);
    return url;
  };

  // Handle source changes or processing
  useEffect(() => {
    if (isPlaceholder) {
      setIsLoading(false);
      setHasError(false);
      return;
    }
    
    // Reset states when src changes
    if (src) {
      console.log('NFTImage processing URL:', src);
      setIsLoading(true);
      setHasError(false);
      const processedUrl = processImageUrl(src);
      console.log('NFTImage processed URL:', processedUrl);
      setCurrentSrc(processedUrl);
    } else {
      console.log('NFTImage received empty src');
      setHasError(true);
    }
  }, [src, isPlaceholder]);

  // Handle image load success
  const handleLoad = () => {
    console.log('NFTImage loaded successfully:', currentSrc);
    setIsLoading(false);
    setHasError(false);
  };

  // Handle image load error with fallback
  const handleError = () => {
    console.log('NFTImage load error for:', currentSrc);
    setIsLoading(false);
    
    // Start with the original URL for logging
    const originalSrc = src || '';
    
    // Try different fallback strategies
    if (currentSrc !== fallbackSrc) {
      console.log(`Image load failed for: ${currentSrc}. Trying fallback.`);
      
      // Special handling for Art Blocks URLs that might be failing
      if (originalSrc.includes('artblocks.io') || originalSrc.includes('generator.artblocks')) {
        // Try an alternative Art Blocks URL format
        const artBlocksId = originalSrc.split('/').pop();
        if (artBlocksId) {
          const altArtBlocksUrl = `https://artblocks-mainnet.s3.amazonaws.com/${artBlocksId.replace(/\.\w+$/, '')}.png`;
          console.log(`Trying alternative Art Blocks URL: ${altArtBlocksUrl}`);
          setCurrentSrc(altArtBlocksUrl);
          return;
        }
      }
      
      // Try using the fallback URL
      setCurrentSrc(fallbackSrc);
    } else if (originalSrc && originalSrc.startsWith('ipfs://')) {
      // If the original was IPFS, try a different gateway
      console.log(`Fallback failed. Trying alternate IPFS gateway for: ${originalSrc}`);
      const altIpfsGateway = originalSrc.replace('ipfs://', 'https://ipfs.io/ipfs/');
      setCurrentSrc(altIpfsGateway);
    } else if (originalSrc && originalSrc.includes('ipfs.io')) {
      // If already using ipfs.io, try a different gateway
      console.log(`IPFS gateway failed. Trying Cloudflare IPFS gateway.`);
      const altIpfsGateway = originalSrc.replace('https://ipfs.io/ipfs/', 'https://cloudflare-ipfs.com/ipfs/');
      setCurrentSrc(altIpfsGateway);
    } else if (originalSrc && !originalSrc.includes('placehold.co')) {
      // Last attempt: Try to fix URL by using an image proxy service
      console.log(`Trying image proxy for: ${originalSrc}`);
      // Use imgproxy.net or a similar service (you may need to set up your own)
      const encodedUrl = encodeURIComponent(originalSrc);
      setCurrentSrc(`https://images.weserv.nl/?url=${encodedUrl}&default=fallback`);
    } else {
      // Finally give up and show the error state
      console.log(`All image loading attempts failed for: ${originalSrc}`);
      setHasError(true);
    }
  };

  // Placeholder for when no image is available
  if (isPlaceholder) {
    return (
      <div className={`relative bg-gray-100 rounded-lg overflow-hidden ${className}`}>
        <div className="absolute inset-0 flex items-center justify-center text-gray-400">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative rounded-lg overflow-hidden ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
        </div>
      )}
      
      {hasError ? (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
      ) : (
        <img
          src={currentSrc}
          alt={alt}
          className={`w-full h-full object-cover ${isLoading ? 'opacity-0' : 'opacity-100'}`}
          onLoad={handleLoad}
          onError={handleError}
        />
      )}
    </div>
  );
};

export default NFTImage; 