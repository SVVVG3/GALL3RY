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
  
  // IMPORTANT: ALWAYS proxy Alchemy URLs
  if (url.includes('nft-cdn.alchemy.com') || url.includes('alchemy.com')) {
    return true;
  }
  
  // Always proxy these URLs that are known to cause CORS issues
  const knownProblematicServices = [
    'nft-cdn.alchemy.com',
    'nftstorage.link',
    'cloudflare-ipfs',
    'cf-ipfs.com',
    'ipfs.io'
  ];
  
  // If URL contains a problematic service, proxy it
  for (const service of knownProblematicServices) {
    if (url.includes(service)) return true;
  }
  
  // For other URLs, proxy those that are likely to have CORS issues (images from external domains)
  return !url.includes('data:image');
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
    
    // Check if the URL needs proxying
    if (!needsProxy(absoluteUrl)) {
      return absoluteUrl;
    }
    
    // For Alchemy NFT CDN URLs, use a more robust approach with Cloudinary
    if (absoluteUrl.includes('nft-cdn.alchemy.com')) {
      // Get the path portion after the domain
      const urlParts = absoluteUrl.split('nft-cdn.alchemy.com/');
      if (urlParts.length === 2) {
        // E.g., if URL is https://nft-cdn.alchemy.com/eth-mainnet/123456,
        // we'll use the path "eth-mainnet/123456"
        const path = urlParts[1];
        // Use Cloudinary's fetch capabilities
        return `https://res.cloudinary.com/demo/image/fetch/f_auto,q_auto/https://nft-cdn.alchemy.com/${path}`;
      }
    }
    
    // For IPFS URLs, try to use a reliable gateway directly
    if (absoluteUrl.includes('ipfs') || absoluteUrl.includes('gateway.pinata') || 
        absoluteUrl.includes('cloudflare-ipfs')) {
      const ipfsUrl = getReliableIpfsUrl(absoluteUrl);
      if (ipfsUrl !== absoluteUrl) {
        return ipfsUrl; // We successfully transformed to a reliable gateway
      }
    }
    
    // For all other URLs, use images.weserv.nl with proper options
    // See: https://images.weserv.nl/docs/
    return `https://images.weserv.nl/?n=-1&url=${encodeURIComponent(absoluteUrl)}`;
  } catch (error) {
    console.error('Error in getProxiedUrl:', error);
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