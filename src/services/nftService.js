import { proxyFetch } from './proxyService';

// API configuration
const API_BASE_URL = 'https://api.opensea.io/api/v1';
const DEFAULT_LIMIT = 20;

/**
 * Fetch a collection's NFTs with pagination support
 * @param {string} collectionSlug - The collection slug identifier
 * @param {Object} options - Additional fetch options
 * @param {number} options.limit - Number of items per page
 * @param {string} options.cursor - Pagination cursor
 * @returns {Promise<Object>} Collection assets and metadata
 */
export const fetchCollectionNFTs = async (collectionSlug, options = {}) => {
  if (!collectionSlug) {
    throw new Error('Collection slug is required');
  }
  
  const limit = options.limit || DEFAULT_LIMIT;
  const cursor = options.cursor || null;
  
  try {
    // Fetch collection metadata
    const collectionResponse = await proxyFetch(
      `${API_BASE_URL}/collection/${collectionSlug}`
    );
    
    if (!collectionResponse.ok) {
      throw new Error(`Failed to fetch collection: ${collectionResponse.status}`);
    }
    
    const collectionData = await collectionResponse.json();
    
    // Fetch assets in the collection
    let assetsUrl = `${API_BASE_URL}/assets?collection=${collectionSlug}&limit=${limit}`;
    if (cursor) {
      assetsUrl += `&cursor=${cursor}`;
    }
    
    const assetsResponse = await proxyFetch(assetsUrl);
    
    if (!assetsResponse.ok) {
      throw new Error(`Failed to fetch assets: ${assetsResponse.status}`);
    }
    
    const assetsData = await assetsResponse.json();
    
    return {
      assets: assetsData.assets || [],
      next: assetsData.next,
      previous: assetsData.previous,
      collectionData: collectionData.collection || {}
    };
  } catch (error) {
    console.error('Error fetching collection NFTs:', error);
    throw error;
  }
};

/**
 * Fetch a single NFT by contract address and token ID
 * @param {string} contractAddress - The NFT contract address
 * @param {string} tokenId - The NFT token ID
 * @returns {Promise<Object>} NFT asset data
 */
export const fetchSingleNFT = async (contractAddress, tokenId) => {
  if (!contractAddress || !tokenId) {
    throw new Error('Contract address and token ID are required');
  }
  
  try {
    const assetUrl = `${API_BASE_URL}/asset/${contractAddress}/${tokenId}`;
    const response = await proxyFetch(assetUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch NFT: ${response.status}`);
    }
    
    return response.json();
  } catch (error) {
    console.error('Error fetching single NFT:', error);
    throw error;
  }
};

/**
 * Search for NFT collections by name
 * @param {string} query - Search query string
 * @param {number} limit - Number of results to return
 * @returns {Promise<Array>} Matching collections
 */
export const searchCollections = async (query, limit = 20) => {
  if (!query) {
    return [];
  }
  
  try {
    const searchUrl = `${API_BASE_URL}/collections?offset=0&limit=${limit}&search=${encodeURIComponent(query)}`;
    const response = await proxyFetch(searchUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to search collections: ${response.status}`);
    }
    
    const data = await response.json();
    return data.collections || [];
  } catch (error) {
    console.error('Error searching collections:', error);
    throw error;
  }
};

/**
 * Get user's owned NFTs by wallet address
 * @param {string} ownerAddress - Ethereum wallet address
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} User's assets with pagination
 */
export const fetchUserNFTs = async (ownerAddress, options = {}) => {
  if (!ownerAddress) {
    throw new Error('Owner address is required');
  }
  
  const limit = options.limit || DEFAULT_LIMIT;
  const cursor = options.cursor || null;
  
  try {
    let assetsUrl = `${API_BASE_URL}/assets?owner=${ownerAddress}&limit=${limit}`;
    if (cursor) {
      assetsUrl += `&cursor=${cursor}`;
    }
    
    const response = await proxyFetch(assetsUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch user NFTs: ${response.status}`);
    }
    
    const data = await response.json();
    
    return {
      assets: data.assets || [],
      next: data.next,
      previous: data.previous
    };
  } catch (error) {
    console.error('Error fetching user NFTs:', error);
    throw error;
  }
}; 