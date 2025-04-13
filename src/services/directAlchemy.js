/**
 * Direct Alchemy Service
 * Simple implementation that directly follows the Alchemy NFT API v3 documentation
 * Optimized for Vercel deployments
 */
import axios from 'axios';

// API base URL - use relative path for compatibility with Vercel deployments
const API_BASE_URL = '/api/alchemy';

// Create axios instance with proper configuration
const alchemyClient = axios.create({
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
  timeout: 15000 // 15 second timeout
});

// Add a response interceptor for better error handling
alchemyClient.interceptors.response.use(
  response => response,
  error => {
    console.error('Alchemy API error:', error.message);
    
    // Check if we have a response with error data
    if (error.response) {
      console.error('Error response:', error.response.status, error.response.data);
      
      // Customize error message based on status code
      if (error.response.status === 401) {
        error.message = 'Alchemy API authentication failed. Please check your API key.';
      } else if (error.response.status === 429) {
        error.message = 'Alchemy API rate limit exceeded. Please try again later.';
      } else if (error.response.status >= 500) {
        error.message = 'Alchemy API server error. Please try again later.';
      }
    } else if (error.request) {
      // Request was made but no response received
      error.message = 'No response from Alchemy API. Please check your network connection.';
    }
    
    return Promise.reject(error);
  }
);

/**
 * Fetch all NFTs for a wallet address
 * @param {string} owner - Wallet address to get NFTs for
 * @param {string} chain - Chain name (eth, base, etc.)
 * @param {object} options - Additional options
 * @returns {Promise<object>} NFT data
 */
export const getNFTsForOwner = async (owner, chain = 'eth', options = {}) => {
  if (!owner) {
    throw new Error('Owner address is required');
  }

  try {
    console.log(`Fetching NFTs for owner ${owner} using direct Alchemy service (v3)`);
    
    // Build API URL with parameters for v3 API
    let url = `${API_BASE_URL}?endpoint=getNFTsForOwner&owner=${owner}`;
    
    // Add withMetadata parameter if needed
    if (options.withMetadata !== false) {
      url += '&withMetadata=true';
    }
    
    // Add optional parameters
    if (options.pageKey) {
      url += `&pageKey=${encodeURIComponent(options.pageKey)}`;
    }
    
    if (options.pageSize) {
      url += `&pageSize=${options.pageSize}`;
    }
    
    if (options.contractAddresses && Array.isArray(options.contractAddresses)) {
      options.contractAddresses.forEach(address => {
        url += `&contractAddresses[]=${address}`;
      });
    }
    
    if (options.excludeSpam) {
      url += '&excludeFilters[]=SPAM';
    }
    
    // Add chain parameter if specified
    if (chain) {
      url += `&chain=${chain}`;
    }
    
    console.log(`Direct Alchemy v3 request URL: ${url}`);
    
    // Make the API request
    const response = await alchemyClient.get(url);
    
    // Process the response
    const data = response.data;
    
    // Simple validation
    if (!data || (data.ownedNfts && !Array.isArray(data.ownedNfts))) {
      console.warn('Unexpected response from Alchemy API:', data);
    }
    
    // Format the response to match our expected structure
    return {
      nfts: (data.ownedNfts || []).map(formatNft),
      pageKey: data.pageKey || null,
      totalCount: data.totalCount || 0,
      hasMore: !!data.pageKey,
      chain: chain || 'eth'
    };
  } catch (error) {
    console.error(`Error fetching NFTs from Alchemy:`, error);
    
    // Check if we got a valid error response
    if (error.response && error.response.data) {
      console.error('Alchemy API error details:', error.response.data);
    }
    
    // Rethrow the error with a friendly message
    throw new Error(`Failed to fetch NFTs: ${error.message}`);
  }
};

/**
 * Fetch NFTs for multiple addresses
 * @param {Array<string>} addresses - Array of wallet addresses
 * @param {string} chain - Chain to fetch from
 * @param {object} options - Additional options
 * @returns {Promise<object>} Combined NFT data
 */
export const batchFetchNFTs = async (addresses, chain = 'eth', options = {}) => {
  if (!addresses || !addresses.length) {
    return { nfts: [], hasMore: false, totalCount: 0 };
  }
  
  try {
    console.log(`Fetching NFTs for ${addresses.length} addresses using direct Alchemy service`);
    
    // Create a copy of options with chain included
    const requestOptions = {
      ...options,
      chain,
    };
    
    // Process addresses in smaller batches to avoid overwhelming the API
    const batchSize = 3; // Process 3 addresses at a time to limit concurrency
    let allNfts = [];
    let hasMore = false;
    
    for (let i = 0; i < addresses.length; i += batchSize) {
      const chunk = addresses.slice(i, i + batchSize);
      const chunkPromises = chunk.map(address => 
        getNFTsForOwner(address, chain, requestOptions)
          .catch(error => {
            console.error(`Error fetching NFTs for address ${address}:`, error);
            // Continue with other addresses even if one fails
            return { nfts: [], hasMore: false, totalCount: 0 };
          })
      );
      
      // Wait for all fetches in this batch to complete
      const results = await Promise.all(chunkPromises);
      
      // Combine results from this batch
      results.forEach(result => {
        if (result.nfts && result.nfts.length > 0) {
          allNfts = [...allNfts, ...result.nfts];
          hasMore = hasMore || result.hasMore;
        }
      });
      
      // Add a small delay between batches to avoid rate limiting
      if (i + batchSize < addresses.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }
    
    // Deduplicate NFTs by ID
    const uniqueNfts = Array.from(
      new Map(allNfts.map(nft => [nft.id, nft])).values()
    );
    
    console.log(`Combined result: ${uniqueNfts.length} unique NFTs from ${addresses.length} addresses`);
    
    return {
      nfts: uniqueNfts,
      hasMore,
      totalCount: uniqueNfts.length
    };
  } catch (error) {
    console.error(`Error in batch fetch:`, error);
    throw error;
  }
};

/**
 * Format NFT data to match our expected structure
 * @param {object} nft - NFT data from Alchemy
 * @returns {object} Formatted NFT data
 */
const formatNft = (nft) => {
  try {
    // v3 API has different structure
    const contractAddress = nft.contract?.address;
    const tokenId = nft.tokenId;
    const metadata = nft.tokenMetadata || nft.metadata || {};
    const title = nft.name || metadata?.name || `#${tokenId}`;
    const description = nft.description || metadata?.description || '';
    const chain = nft.chain || 'eth';
    
    // Extract media from v3 structure with fallbacks
    let imageUrl = '';
    
    // First check for image object
    if (nft.image) {
      imageUrl = typeof nft.image === 'object' ? nft.image.gateway || nft.image.url : nft.image;
    } 
    // Then check media array
    else if (nft.media && nft.media.length > 0) {
      imageUrl = nft.media[0]?.gateway || '';
    } 
    // Finally check metadata
    else if (metadata?.image) {
      imageUrl = metadata.image;
    }
    
    // Extract contract metadata
    const contractMetadata = nft.contractMetadata || {};
    
    return {
      id: `${chain}:${contractAddress}-${tokenId}`,
      name: title,
      description,
      tokenId,
      contractAddress,
      network: chain,
      collection: {
        name: nft.contract?.name || contractMetadata?.name || metadata?.collection || 'Unknown Collection',
        address: contractAddress,
        id: `${chain}:${contractAddress}`,
        network: chain,
        floorPrice: contractMetadata?.openSea?.floorPrice || null
      },
      imageUrl,
      // Include metadata for completeness
      metadata,
      contractMetadata,
      // Original data for debugging
      alchemyData: process.env.NODE_ENV === 'development' ? nft : undefined
    };
  } catch (error) {
    console.error('Error formatting NFT:', error);
    return null;
  }
};

// Create a proper service object
const alchemyService = {
  fetchNFTsForAddress: getNFTsForOwner,
  getNFTsForOwner,
  batchFetchNFTs
};

export default alchemyService; 