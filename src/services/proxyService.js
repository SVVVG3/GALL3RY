/**
 * Proxy Service for handling CORS issues with NFT images
 * Provides reliable image loading by selecting optimal proxy strategy
 */

// List of reliable IPFS gateways
const IPFS_GATEWAYS = [
  'https://cf-ipfs.com/ipfs/',
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
  if (!url) return url;

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
 * Determine if a URL is likely to have CORS issues
 * @param {string} url - URL to check
 * @returns {boolean} True if URL will likely have CORS issues
 */
export const needsProxy = (url) => {
  if (!url) return false;
  if (url.startsWith('data:')) return false;
  if (url.startsWith('/')) return false;
  
  // These services typically have CORS headers set correctly
  const knownGoodServices = [
    'nft-cdn.alchemy.com',
    'cloudflare-ipfs.com',
    'cf-ipfs.com',
    'nftstorage.link',
    'infura-ipfs.io',
    'gateway.pinata.cloud'
  ];
  
  // Skip proxying for URLs from known good services
  for (const service of knownGoodServices) {
    if (url.includes(service)) return false;
  }
  
  return true;
};

/**
 * Get a proxied URL to avoid CORS issues
 * @param {string} url - Original URL
 * @returns {string} Proxied URL or original if proxying not needed
 */
export const getProxiedUrl = (url) => {
  // Skip proxying in some cases
  if (!url) return '';
  if (url.startsWith('data:')) return url;
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  
  try {
    // First, make the URL absolute
    const absoluteUrl = url.startsWith('http') 
      ? url 
      : `https://${url.replace(/^\/\//, '')}`;
    
    // Skip proxying for known good services
    if (!needsProxy(absoluteUrl)) {
      return absoluteUrl;
    }
    
    // Use our proxy service
    const proxyUrl = process.env.REACT_APP_PROXY_URL || 'https://proxy.gall3ry.co/';
    return `${proxyUrl}?url=${encodeURIComponent(absoluteUrl)}`;
  } catch (error) {
    return url;
  }
};

/**
 * Attempts multiple strategies to get a working image URL
 * @param {string} url - Original image URL
 * @returns {Promise<string>} URL that works
 */
export const getBestImageUrl = async (url) => {
  if (!url) return '';
  
  // If this is an IPFS URL, use a reliable gateway
  if (url.includes('ipfs://') || url.includes('/ipfs/')) {
    return getReliableIpfsUrl(url);
  }
  
  // If URL likely needs proxy, use our proxy service
  if (needsProxy(url)) {
    return getProxiedUrl(url);
  }
  
  // Otherwise, use the original URL
  return url;
};

export default {
  getReliableIpfsUrl,
  getProxiedUrl,
  getBestImageUrl,
  needsProxy
}; 