/**
 * Proxy Service for handling CORS issues with NFT images
 * Provides reliable image loading by selecting optimal proxy strategy
 */

// List of reliable IPFS gateways
const IPFS_GATEWAYS = [
  'https://cloudflare-ipfs.com/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://gateway.pinata.cloud/ipfs/'
];

/**
 * Get an IPFS URL through a reliable gateway
 * @param {string} url - Original IPFS URL
 * @returns {string} Transformed URL using reliable gateway
 */
export const getReliableIpfsUrl = (url) => {
  if (!url) return '';

  // Handle ipfs:// protocol
  if (url.startsWith('ipfs://')) {
    return IPFS_GATEWAYS[0] + url.substring(7);
  }

  // Handle ipfs hash formats: ipfs/QmHash or /ipfs/QmHash
  const ipfsHashMatch = url.match(/(?:\/ipfs\/|ipfs\/)([a-zA-Z0-9]+.*)/);
  if (ipfsHashMatch) {
    return IPFS_GATEWAYS[0] + ipfsHashMatch[1];
  }

  return url;
};

/**
 * Simple proxy service using corsproxy.io which is free and reliable
 * @param {string} url - URL to proxy
 * @returns {string} Proxied URL
 */
export const getProxiedUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  
  try {
    // For IPFS URLs, use IPFS gateway
    if (url.includes('ipfs://')) {
      return getReliableIpfsUrl(url);
    }
    
    // Make sure URL is absolute
    const absoluteUrl = url.startsWith('http') 
      ? url 
      : `https://${url.replace(/^\/\//, '')}`;
    
    // Use corsproxy.io as a simple reliable proxy
    return `https://corsproxy.io/?${encodeURIComponent(absoluteUrl)}`;
  } catch (error) {
    console.error('Error creating proxy URL:', error);
    return url;
  }
};

/**
 * Get the best URL for an image, applying proxying as needed
 * @param {string} url - Original image URL
 * @returns {string} Best URL to use
 */
export const getBestImageUrl = (url) => {
  if (!url) return '';
  
  // If it's a data URL, use it directly
  if (url.startsWith('data:')) return url;
  
  // If it's a local path, use it directly
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  
  // Otherwise, proxy the URL
  return getProxiedUrl(url);
};

export default {
  getReliableIpfsUrl,
  getProxiedUrl,
  getBestImageUrl
}; 