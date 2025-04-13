/**
 * Alchemy API Service
 * A robust implementation for fetching NFTs from Alchemy with fallback to Zapper
 */
import axios from 'axios';
import { CACHE_EXPIRATION_TIME } from '../../constants';

// Constants
const ALCHEMY_API_KEY = "-DhGb2lvitCWrrAmLnF5TZLl-N6l8Lak";
const CHAIN_ENDPOINTS = {
  eth: `https://eth-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}`,
  base: `https://base-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}`,
  polygon: `https://polygon-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}`,
  arbitrum: `https://arb-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}`,
  optimism: `https://opt-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}`,
};

// Cache implementation with TTL
const nftCache = new Map();
let lastCachePurge = Date.now();

// Helper to purge expired cache entries
const purgeCacheIfNeeded = () => {
  const now = Date.now();
  // Only purge at reasonable intervals
  if (now - lastCachePurge > CACHE_EXPIRATION_TIME / 2) {
    lastCachePurge = now;
    for (const [key, entry] of nftCache.entries()) {
      if (now - entry.timestamp > CACHE_EXPIRATION_TIME) {
        nftCache.delete(key);
      }
    }
  }
};

// Create Alchemy axios instance with proper headers
const alchemyAxios = axios.create({
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    // User-Agent headers cause issues in browser environments
    // 'User-Agent': 'GALL3RY/1.0 (https://gall3ry.vercel.app)'
  },
  timeout: 15000 // 15 second timeout
});

/**
 * Fetch NFTs for a wallet address from Alchemy API
 * @param {string} address - Ethereum address
 * @param {string} chain - Chain name (eth, base, etc.)
 * @param {object} options - Fetch options
 * @returns {Promise<Object>} - NFTs with pagination info
 */
export const fetchNFTsForAddress = async (address, chain = 'eth', options = {}) => {
  if (!address) {
    throw new Error('Address is required');
  }

  // Normalize the address
  const normalizedAddress = address.toLowerCase();
  
  // Default options
  const {
    pageSize = 100,
    pageKey = null,
    excludeSpam = true,
    bypassCache = false,
    includeMetadata = true,
  } = options;

  // Create cache key
  const cacheKey = `${normalizedAddress}:${chain}:${pageSize}:${pageKey}:${excludeSpam}:${includeMetadata}`;
  
  // Check cache first unless bypass requested
  if (!bypassCache) {
    purgeCacheIfNeeded();
    const cached = nftCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_EXPIRATION_TIME) {
      console.log(`Using cached NFTs for ${normalizedAddress} on ${chain}`);
      return cached.data;
    }
  }

  try {
    console.log(`Fetching NFTs for ${normalizedAddress} on ${chain} from Alchemy`);
    
    // Get the appropriate endpoint for the chain
    const baseUrl = CHAIN_ENDPOINTS[chain];
    if (!baseUrl) {
      throw new Error(`Unsupported chain: ${chain}`);
    }

    // Construct the URL with query parameters
    let url = `${baseUrl}/getNFTsForOwner?owner=${normalizedAddress}&withMetadata=${includeMetadata}&pageSize=${pageSize}`;
    
    // Add optional parameters
    if (pageKey) {
      url += `&pageKey=${encodeURIComponent(pageKey)}`;
    }
    
    if (excludeSpam) {
      url += '&excludeFilters[]=SPAM';
    }

    // Make the request
    const response = await alchemyAxios.get(url);
    
    // Check for error response
    if (!response.data) {
      throw new Error('Empty response from Alchemy API');
    }

    // Process the NFTs to match our app's expected format
    const processedData = processAlchemyResponse(response.data, chain);
    
    // Cache the result
    nftCache.set(cacheKey, {
      timestamp: Date.now(),
      data: processedData
    });

    return processedData;
  } catch (error) {
    console.error(`Error fetching NFTs from Alchemy for ${normalizedAddress} on ${chain}:`, error);
    throw error;
  }
};

/**
 * Process Alchemy API response to match our app's expected format
 * @param {object} response - Alchemy API response
 * @param {string} chain - Chain name
 * @returns {object} - Processed NFT data
 */
const processAlchemyResponse = (response, chain) => {
  const { ownedNfts, pageKey, totalCount } = response;
  
  // Map Alchemy NFTs to our expected format
  const processedNfts = ownedNfts.map(nft => {
    // Extract token ID and address
    const { tokenId, contract, metadata, title, description, balance } = nft;
    const contractAddress = contract.address;
    
    // Get media
    const media = extractMediaFromAlchemyNFT(nft);
    
    // Map to our app's expected format
    return {
      id: `${chain}:${contractAddress}-${tokenId}`,
      name: title || metadata?.name || `#${tokenId}`,
      description: description || metadata?.description,
      tokenId,
      contractAddress,
      network: chain,
      // Collection info
      collection: {
        name: metadata?.collection || contract.name || 'Unknown Collection',
        address: contractAddress,
        id: `${chain}:${contractAddress}`,
        network: chain
      },
      // Media and images
      imageUrl: media.imageUrl,
      mediasV2: media.mediasV2,
      mediasV3: media.mediasV3,
      // Balance and ownership
      balanceDecimal: parseFloat(balance),
      balance: parseInt(balance, 10),
      // Original data
      metadata: metadata,
      alchemyData: nft,
    };
  });

  return {
    nfts: processedNfts,
    pageKey,
    totalCount,
    hasMore: !!pageKey,
    chain
  };
};

/**
 * Extract media URLs from an Alchemy NFT
 * @param {object} nft - Alchemy NFT object
 * @returns {object} - Media URLs in our expected format
 */
const extractMediaFromAlchemyNFT = (nft) => {
  const { media, metadata } = nft;
  
  // Default result object
  const result = {
    imageUrl: null,
    mediasV2: [],
    mediasV3: {
      images: {
        edges: []
      },
      animations: {
        edges: []
      }
    }
  };
  
  // Extract from Alchemy media array
  if (media && media.length > 0) {
    // Find the first valid media
    const firstMedia = media.find(m => m.gateway && !m.gateway.includes('defaulticon'));
    if (firstMedia) {
      // Use gateway URL as it's already IPFS-resolved
      result.imageUrl = firstMedia.gateway;
      
      // Also add to mediasV2 format for compatibility
      result.mediasV2.push({
        original: firstMedia.gateway,
        originalUri: firstMedia.raw,
        url: firstMedia.gateway,
        mimeType: firstMedia.format || 'image/png'
      });
      
      // Add to mediasV3 format
      result.mediasV3.images.edges.push({
        node: {
          original: firstMedia.gateway,
          thumbnail: firstMedia.gateway,
          large: firstMedia.gateway
        }
      });
    }
  }
  
  // If no media found, try metadata.image
  if (!result.imageUrl && metadata && metadata.image) {
    result.imageUrl = metadata.image;
    
    // Also add to mediasV2 and mediasV3
    result.mediasV2.push({
      original: metadata.image,
      originalUri: metadata.image,
      url: metadata.image,
      mimeType: 'image/png' // Assume image/png if not specified
    });
    
    result.mediasV3.images.edges.push({
      node: {
        original: metadata.image,
        thumbnail: metadata.image,
        large: metadata.image
      }
    });
  }
  
  // Process animation_url if available
  if (metadata && metadata.animation_url) {
    result.mediasV3.animations.edges.push({
      node: {
        original: metadata.animation_url,
        thumbnail: result.imageUrl || metadata.image, // Use image as thumbnail for animation
        large: metadata.animation_url
      }
    });
  }
  
  return result;
};

/**
 * Batch fetch NFTs for multiple addresses
 * @param {Array<string>} addresses - Array of wallet addresses
 * @param {string} chain - Chain name
 * @param {object} options - Fetch options
 * @returns {Promise<Array>} - Combined array of NFTs
 */
export const batchFetchNFTs = async (addresses, chain = 'eth', options = {}) => {
  if (!addresses || !addresses.length) {
    return { nfts: [], hasMore: false };
  }
  
  try {
    // Fetch NFTs for each address in parallel
    const results = await Promise.all(
      addresses.map(address => 
        fetchNFTsForAddress(address, chain, options)
          .catch(error => {
            console.error(`Error fetching NFTs for ${address} on ${chain}:`, error);
            return { nfts: [], hasMore: false }; // Return empty result on error for this address
          })
      )
    );
    
    // Combine the results
    const combinedNfts = results.flatMap(result => result.nfts || []);
    const hasMore = results.some(result => result.hasMore);
    
    // Deduplicate NFTs by ID
    const uniqueNfts = Array.from(
      new Map(combinedNfts.map(nft => [nft.id, nft])).values()
    );
    
    return {
      nfts: uniqueNfts,
      hasMore,
      totalCount: uniqueNfts.length
    };
  } catch (error) {
    console.error(`Error in batch fetch for ${addresses.length} addresses:`, error);
    throw error;
  }
};

export default {
  fetchNFTsForAddress,
  batchFetchNFTs
}; 