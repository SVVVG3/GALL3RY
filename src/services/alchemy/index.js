/**
 * Alchemy API Service
 * A robust implementation for fetching NFTs from Alchemy using the NFT API v2
 * See documentation: https://docs.alchemy.com/reference/nft-api-quickstart
 */
import axios from 'axios';
import { CACHE_EXPIRATION_TIME } from '../../constants';

// Constants
// Use the API proxy endpoint instead of direct Alchemy API calls
// Always use relative URL to work in both development and production
const API_BASE_URL = '/api/alchemy';

const CHAIN_ENDPOINTS = {
  eth: 'eth',
  base: 'base',
  polygon: 'polygon',
  arbitrum: 'arbitrum',
  optimism: 'optimism',
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
    console.log(`Using API base URL: ${API_BASE_URL}`);
    
    // Get the appropriate chain value
    const chainValue = CHAIN_ENDPOINTS[chain];
    if (!chainValue) {
      throw new Error(`Unsupported chain: ${chain}`);
    }

    // Construct the URL with query parameters for the v2 API format
    let url = `${API_BASE_URL}?chain=${chainValue}&endpoint=getNFTsForOwner&owner=${normalizedAddress}`;
    
    // Add parameters with correct names for v2 API
    if (includeMetadata) {
      url += `&withMetadata=true`;
    }
    
    if (pageSize) {
      url += `&pageSize=${pageSize}`;
    }
    
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
  
  if (!ownedNfts || !Array.isArray(ownedNfts)) {
    console.error('Invalid Alchemy API response format:', response);
    return {
      nfts: [],
      pageKey: null,
      totalCount: 0,
      hasMore: false,
      chain
    };
  }
  
  // Log for debugging
  console.log(`Processing ${ownedNfts.length} NFTs from Alchemy API (${chain})`);
  console.log('Sample NFT response:', ownedNfts[0]);
  
  // Map Alchemy NFTs to our expected format
  const processedNfts = ownedNfts.map(nft => {
    try {
      // Extract token ID and address from v2 API format
      const contractAddress = nft.contract?.address;
      const tokenId = nft.id?.tokenId || nft.tokenId;
      const metadata = nft.metadata || {};
      const title = nft.title || metadata?.name;
      const description = nft.description || metadata?.description;
      const balance = nft.balance || "1";
      
      // Handle media from v2 API format
      const media = extractMediaFromAlchemyNFT(nft);
      
      // Get contract metadata (important for floor price)
      const contractMetadata = nft.contractMetadata || {};
      
      // Map to our app's expected format
      return {
        id: `${chain}:${contractAddress}-${tokenId}`,
        name: title || `#${tokenId}`,
        description: description,
        tokenId,
        contractAddress,
        network: chain,
        // Collection info
        collection: {
          name: metadata?.collection || nft.contract?.name || 'Unknown Collection',
          address: contractAddress,
          id: `${chain}:${contractAddress}`,
          network: chain,
          floorPrice: contractMetadata?.openSea?.floorPrice || null
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
        contractMetadata: contractMetadata,
        alchemyData: nft,
      };
    } catch (err) {
      console.error('Error processing NFT from Alchemy:', err, nft);
      return null;
    }
  }).filter(Boolean); // Filter out any null values from errors

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
  try {
    // Handle both v2 and v3 API formats
    const metadata = nft.metadata || {};
    // V2 API has media array, V3 has media object
    const media = Array.isArray(nft.media) ? nft.media : [nft.media].filter(Boolean);
    
    // For debugging media data
    console.log(`Extracting media for NFT: ${nft.title || nft.metadata?.name || nft.id?.tokenId}`, {
      hasMedia: !!nft.media,
      mediaArrayLength: Array.isArray(nft.media) ? nft.media.length : 'not array',
      firstMediaItem: Array.isArray(nft.media) && nft.media.length > 0 ? nft.media[0] : nft.media,
      metadataImage: nft.metadata?.image
    });
    
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
      const firstMedia = media.find(m => m && m.gateway && !m.gateway.includes('defaulticon'));
      if (firstMedia) {
        // Use gateway URL as it's already IPFS-resolved
        result.imageUrl = firstMedia.gateway;
        
        // Also add to mediasV2 format for compatibility
        result.mediasV2.push({
          original: firstMedia.gateway,
          originalUri: firstMedia.raw || firstMedia.gateway,
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
    
    // If no media found, try metadata.image from either format
    if (!result.imageUrl) {
      let imageUrl = null;
      
      // Check various possible image locations in the response
      if (metadata && metadata.image) {
        imageUrl = metadata.image;
      } else if (nft.tokenUri && nft.tokenUri.gateway) {
        imageUrl = nft.tokenUri.gateway;
      } else if (nft.image && nft.image.gateway) {
        imageUrl = nft.image.gateway;
      }
      
      if (imageUrl) {
        result.imageUrl = imageUrl;
        
        // Also add to mediasV2 and mediasV3
        result.mediasV2.push({
          original: imageUrl,
          originalUri: imageUrl,
          url: imageUrl,
          mimeType: 'image/png' // Assume image/png if not specified
        });
        
        result.mediasV3.images.edges.push({
          node: {
            original: imageUrl,
            thumbnail: imageUrl,
            large: imageUrl
          }
        });
      }
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
  } catch (err) {
    console.error('Error extracting media from NFT:', err);
    // Return empty result on error
    return {
      imageUrl: null,
      mediasV2: [],
      mediasV3: { images: { edges: [] }, animations: { edges: [] } }
    };
  }
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