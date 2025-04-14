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
    // Debug the incoming NFT data
    console.log(`Formatting NFT data for: ${nft.contract?.address}-${nft.tokenId}`, 
                JSON.stringify(nft).substring(0, 200) + '...');
    
    // Extract basic data
    const contractAddress = nft.contract?.address;
    const tokenId = nft.tokenId;
    const chain = nft.chain || 'eth';
    
    // Extract metadata from different possible sources in the API response
    const metadata = nft.tokenMetadata || nft.metadata || {};
    const title = nft.name || metadata?.name || `#${tokenId}`;
    const description = nft.description || metadata?.description || '';
    
    // Extract images with extensive fallbacks
    let imageUrl = '';
    let rawImageUrl = '';
    
    // Debug image extraction
    console.log(`Image extraction for ${contractAddress}-${tokenId}:`, {
      hasImage: !!nft.image,
      hasMedia: !!nft.media,
      mediaLength: nft.media?.length,
      gatewayImage: nft.image?.gateway,
      originalUrl: nft.image?.originalUrl,
      tokenUriGateway: nft.tokenUri?.gateway,
      metadataImage: metadata?.image
    });

    // First check if we have a direct image object with gateway URL (Alchemy v3 format)
    if (nft.image && nft.image.gateway) {
      imageUrl = nft.image.gateway; // Alchemy's optimized and cached URL
      rawImageUrl = nft.image.originalUrl || nft.image.raw || nft.image.url || '';
      console.log(`Using image.gateway URL: ${imageUrl}`);
    } 
    // Then check if image is a direct string
    else if (nft.image && typeof nft.image === 'string') {
      imageUrl = nft.image;
      rawImageUrl = nft.image;
      console.log(`Using direct image string: ${imageUrl}`);
    }
    // Then check media array from Alchemy
    else if (nft.media && nft.media.length > 0) {
      // Prefer gateway URLs from Alchemy as they're optimized and cached
      imageUrl = nft.media[0]?.gateway || nft.media[0]?.raw || nft.media[0]?.uri || '';
      rawImageUrl = nft.media[0]?.raw || nft.media[0]?.uri || imageUrl;
      console.log(`Using media[0] URL: ${imageUrl}`);
    } 
    // Check token URI from OpenSea or metadata
    else if (nft.tokenUri?.gateway) {
      imageUrl = nft.tokenUri.gateway;
      rawImageUrl = nft.tokenUri.raw || imageUrl;
      console.log(`Using tokenUri.gateway: ${imageUrl}`);
    }
    // Check raw metadata image field
    else if (metadata?.image) {
      imageUrl = metadata.image;
      rawImageUrl = metadata.image;
      console.log(`Using metadata.image: ${imageUrl}`);
    }
    
    // If no image URL found, check all other possible locations
    if (!imageUrl || imageUrl.includes('placeholder') || imageUrl.startsWith('data:')) {
      if (metadata?.image_url) {
        imageUrl = metadata.image_url;
        rawImageUrl = metadata.image_url;
        console.log(`Using metadata.image_url fallback: ${imageUrl}`);
      } else if (nft.contractMetadata?.openSea?.imageUrl) {
        // Use collection image as last resort
        imageUrl = nft.contractMetadata.openSea.imageUrl;
        rawImageUrl = imageUrl;
        console.log(`Using contractMetadata.openSea.imageUrl fallback: ${imageUrl}`);
      } else {
        // Default placeholder
        imageUrl = '/assets/placeholder-nft.svg';
        rawImageUrl = imageUrl;
        console.log(`No image found, using placeholder`);
      }
    }

    // Fix IPFS and Arweave URLs if needed
    if (imageUrl && imageUrl.startsWith('ipfs://')) {
      imageUrl = imageUrl.replace('ipfs://', 'https://ipfs.io/ipfs/');
      console.log(`Fixed IPFS URL: ${imageUrl}`);
    } else if (imageUrl && imageUrl.startsWith('ar://')) {
      imageUrl = imageUrl.replace('ar://', 'https://arweave.net/');
      console.log(`Fixed Arweave URL: ${imageUrl}`);
    }

    // Do the same for rawImageUrl
    if (rawImageUrl && rawImageUrl.startsWith('ipfs://')) {
      rawImageUrl = rawImageUrl.replace('ipfs://', 'https://ipfs.io/ipfs/');
    } else if (rawImageUrl && rawImageUrl.startsWith('ar://')) {
      rawImageUrl = rawImageUrl.replace('ar://', 'https://arweave.net/');
    }

    // Extract price and value data
    let estimatedValue = null;
    let floorPrice = null;

    // PRICE DATA EXTRACTION - Check all possible price sources
    
    // 1. Check Contract Metadata OpenSea
    if (nft.contractMetadata?.openSea?.floorPrice) {
      floorPrice = {
        value: nft.contractMetadata.openSea.floorPrice,
        currency: 'ETH',
        valueUsd: nft.contractMetadata.openSea.floorPrice * 3000 // Rough ETH price estimate
      };
      console.log(`Found OpenSea floor price: ${floorPrice.value} ETH`);
    }

    // 2. Check for floorPrice in the root
    if (nft.floorPrice && !floorPrice) {
      floorPrice = {
        value: nft.floorPrice,
        currency: 'ETH',
        valueUsd: nft.floorPrice * 3000 // Rough ETH price estimate
      };
      console.log(`Found root floor price: ${floorPrice.value} ETH`);
    }

    // 3. Check for contract.openSea directly
    if (nft.contract?.openSea?.floorPrice && !floorPrice) {
      floorPrice = {
        value: nft.contract.openSea.floorPrice,
        currency: 'ETH',
        valueUsd: nft.contract.openSea.floorPrice * 3000
      };
      console.log(`Found contract.openSea floor price: ${floorPrice.value} ETH`);
    }
    
    // Create estimated value object if we have floor price
    if (floorPrice) {
      estimatedValue = {
        value: floorPrice.value,
        valueUsd: floorPrice.valueUsd,
        denomination: {
          symbol: 'ETH'
        }
      };
    }
    
    // Format the final object
    const formattedNft = {
      id: `${chain}:${contractAddress}-${tokenId}`,
      name: title,
      description,
      tokenId,
      contractAddress,
      network: chain,
      collection: {
        name: nft.contract?.name || nft.contractMetadata?.name || 'Unknown Collection',
        address: contractAddress,
        id: `${chain}:${contractAddress}`,
        network: chain,
        floorPrice: floorPrice
      },
      imageUrl,
      rawImageUrl,
      // Price data
      estimatedValue,
      valueUsd: estimatedValue?.valueUsd,
      // Include metadata for completeness
      metadata,
      contractMetadata: nft.contractMetadata || {},
      // Keep original data for debug purposes
      alchemyData: process.env.NODE_ENV === 'development' ? nft : undefined
    };
    
    // Log the formatted NFT for debugging
    console.log(`Formatted NFT ${formattedNft.id}:`, {
      name: formattedNft.name,
      hasImage: !!formattedNft.imageUrl,
      imageUrl: formattedNft.imageUrl?.substring(0, 50) + '...',
      estimatedValue: formattedNft.estimatedValue,
      floorPrice: formattedNft.collection?.floorPrice
    });
    
    return formattedNft;
  } catch (error) {
    console.error('Error formatting NFT:', error);
    return null;
  }
};

/**
 * Fetch enhanced metadata for multiple NFTs in a batch
 * @param {Array<object>} nfts - Array of NFT objects with contract and tokenId
 * @param {string} chain - Chain name (eth, base, etc.)
 * @param {object} options - Additional options
 * @returns {Promise<Array<object>>} Enhanced NFT metadata
 */
export const getNFTMetadataBatch = async (nfts, chain = 'eth', options = {}) => {
  if (!nfts || !nfts.length) {
    console.warn('No NFTs provided to getNFTMetadataBatch');
    return [];
  }

  try {
    console.log(`Fetching enhanced metadata for ${nfts.length} NFTs using Alchemy batch API`);
    
    // Prepare tokens array for the batch request
    const tokens = nfts.map(nft => {
      const contractAddress = nft.contractAddress || nft.contract?.address;
      const tokenId = nft.tokenId || nft.id?.tokenId;
      
      if (!contractAddress || !tokenId) {
        console.warn('Missing contractAddress or tokenId for NFT:', 
          nft.id || JSON.stringify(nft).substring(0, 100) + '...');
        return null;
      }
      
      return {
        contractAddress,
        tokenId
      };
    }).filter(Boolean); // Filter out any null entries
    
    // If we have no valid tokens, return early
    if (!tokens.length) {
      console.warn('No valid tokens to fetch metadata for');
      return [];
    }
    
    // Process in smaller batches to avoid exceeding API limits
    const BATCH_SIZE = 100; // Alchemy's maximum batch size
    const enhancedNFTs = [];
    
    for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
      const batchTokens = tokens.slice(i, i + BATCH_SIZE);
      
      // Build API URL
      const url = `${API_BASE_URL}?endpoint=getNFTMetadataBatch&chain=${chain}`;
      
      // Make the batch request
      console.log(`Making batch request for ${batchTokens.length} NFTs (batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(tokens.length/BATCH_SIZE)})`);
      
      try {
        const response = await alchemyClient.post(url, {
          tokens: batchTokens,
          refreshCache: options.refreshCache || false
        });
        
        if (!response.data || !response.data.nfts || !Array.isArray(response.data.nfts)) {
          console.warn('Unexpected response format from Alchemy batch API:', 
            JSON.stringify(response.data).substring(0, 200) + '...');
          continue;
        }
        
        console.log(`Successfully received metadata for ${response.data.nfts.length} NFTs`);
        
        // Process and format the response
        const batchResults = response.data.nfts.map(formatNft);
        enhancedNFTs.push(...batchResults);
        
        // Add a small delay between batches to avoid rate limiting
        if (i + BATCH_SIZE < tokens.length) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      } catch (error) {
        console.error(`Error in batch ${Math.floor(i/BATCH_SIZE) + 1}:`, error);
        // Continue with next batch despite errors
      }
    }
    
    console.log(`Enhanced metadata fetched for ${enhancedNFTs.length}/${tokens.length} NFTs`);
    return enhancedNFTs;
  } catch (error) {
    console.error('Error fetching NFT metadata batch:', error);
    
    if (error.response && error.response.data) {
      console.error('Alchemy API error details:', error.response.data);
    }
    
    throw new Error(`Failed to fetch NFT metadata batch: ${error.message}`);
  }
};

/**
 * Enhance NFTs with additional metadata and price information
 * @param {Array<object>} nfts - Array of NFT objects to enhance
 * @param {string} chain - Chain name (eth, base, etc.)
 * @param {object} options - Additional options
 * @returns {Promise<Array<object>>} Enhanced NFTs with price data
 */
export const enhanceNFTsWithMetadata = async (nfts, chain = 'eth', options = {}) => {
  if (!nfts || nfts.length === 0) {
    return [];
  }
  
  try {
    console.log(`Enhancing ${nfts.length} NFTs with additional metadata`);
    
    // Get detailed metadata in batches
    const enhancedNFTs = await getNFTMetadataBatch(nfts, chain, {
      refreshCache: options.refreshCache || false
    });
    
    if (!enhancedNFTs || enhancedNFTs.length === 0) {
      console.warn('No enhanced NFTs returned from batch request');
      return nfts; // Return original NFTs if enhancement fails
    }
    
    // Create a map for efficient lookup
    const enhancedNFTMap = new Map();
    
    // Process each enhanced NFT
    enhancedNFTs.forEach(nft => {
      if (!nft || !nft.id) {
        console.warn('Invalid enhanced NFT or missing ID:', nft);
        return;
      }
      
      // Debug price data
      if (nft.estimatedValue || nft.valueUsd || nft.balanceUSD || 
          (nft.collection && nft.collection.floorPrice)) {
        console.log(`Price data found for ${nft.id}:`, {
          estimatedValue: nft.estimatedValue,
          valueUsd: nft.valueUsd,
          balanceUSD: nft.balanceUSD,
          collectionFloorPrice: nft.collection?.floorPrice
        });
      }
      
      enhancedNFTMap.set(nft.id, nft);
    });
    
    // Merge the enhanced data with the original NFTs
    const mergedNFTs = nfts.map(nft => {
      // Get normalized ID for matching
      const normalizedId = nft.id || 
        `${chain}:${nft.contractAddress || nft.contract?.address}-${nft.tokenId}`;
      
      // Find the enhanced version
      const enhancedNFT = enhancedNFTMap.get(normalizedId);
      
      if (enhancedNFT) {
        // Merge with original, prioritizing enhanced data for most fields
        const merged = {
          ...nft,
          ...enhancedNFT,
          // Preserve the original fields that might be better than enhanced
          ownerAddress: nft.ownerAddress || enhancedNFT.ownerAddress,
          ownerAddresses: nft.ownerAddresses || enhancedNFT.ownerAddresses,
        };
        
        // Special handling for image URL - only use enhanced if it's better
        if (!merged.imageUrl || merged.imageUrl.includes('placeholder')) {
          merged.imageUrl = enhancedNFT.imageUrl;
        }
        
        // Debug data for merged NFT
        console.log(`Enhanced NFT ${normalizedId}:`, {
          name: merged.name,
          hasImage: !!merged.imageUrl,
          hasRawImage: !!merged.rawImageUrl,
          estimatedValue: merged.estimatedValue,
          floorPrice: merged.collection?.floorPrice
        });
        
        return merged;
      }
      
      return nft;
    });
    
    return mergedNFTs;
  } catch (error) {
    console.error('Error enhancing NFTs with metadata:', error);
    // Return original NFTs if enhancement fails
    return nfts;
  }
};

// Create a proper service object
const alchemyService = {
  fetchNFTsForAddress: getNFTsForOwner,
  getNFTsForOwner,
  batchFetchNFTs
};

export default alchemyService; 