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

  console.log('getReliableIpfsUrl called with:', url);

  // Handle ipfs:// protocol
  if (url.startsWith('ipfs://')) {
    const gatewayUrl = IPFS_GATEWAYS[0] + url.substring(7);
    console.log('IPFS URL transformed to:', gatewayUrl);
    return gatewayUrl;
  }

  // Handle ipfs hash formats: ipfs/QmHash or /ipfs/QmHash
  const ipfsHashMatch = url.match(/(?:\/ipfs\/|ipfs\/)([a-zA-Z0-9]+.*)/);
  if (ipfsHashMatch) {
    const gatewayUrl = IPFS_GATEWAYS[0] + ipfsHashMatch[1];
    console.log('IPFS hash URL transformed to:', gatewayUrl);
    return gatewayUrl;
  }

  return url;
};

/**
 * Get the URL for our internal image proxy
 * @param {string} url - URL to proxy
 * @returns {string} Proxied URL using our own proxy service
 */
export const getProxiedUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  
  try {
    console.log('getProxiedUrl called with:', url);
    
    // For IPFS URLs, use IPFS gateway
    if (url.includes('ipfs://')) {
      return getReliableIpfsUrl(url);
    }
    
    // Make sure URL is absolute
    const absoluteUrl = url.startsWith('http') 
      ? url 
      : `https://${url.replace(/^\/\//, '')}`;
    
    // Use our own proxy endpoint instead of corsproxy.io
    const proxiedUrl = `/api/image-proxy?url=${encodeURIComponent(absoluteUrl)}`;
    console.log('URL proxied to:', proxiedUrl);
    return proxiedUrl;
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
  
  console.log('getBestImageUrl called with:', url);
  
  // If it's a data URL, use it directly
  if (url.startsWith('data:')) {
    console.log('Using data URL directly');
    return url;
  }
  
  // If it's a local path, use it directly
  if (url.startsWith('/') && !url.startsWith('//')) {
    console.log('Using local path directly:', url);
    return url;
  }
  
  // Otherwise, proxy the URL
  const finalUrl = getProxiedUrl(url);
  console.log('Final best URL:', finalUrl);
  return finalUrl;
};

export default {
  getReliableIpfsUrl,
  getProxiedUrl,
  getBestImageUrl
}; 