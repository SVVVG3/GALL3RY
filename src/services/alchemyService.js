import axios from 'axios';

// Base URL for Alchemy API requests
const getBaseUrl = () => {
  // Use the current domain for production or testing with deployed API
  // Or use localhost:3001 for local development
  return process.env.NODE_ENV === 'production' 
    ? `${window.location.origin}/api` 
    : 'http://localhost:3001/api';
};

/**
 * Service for interacting with Alchemy NFT APIs
 * Updated to follow Alchemy NFT API v3 documentation
 */
const alchemyService = {
  /**
   * Helper to get the proper Alchemy URL for a given network
   */
  getBaseUrl(network) {
    const networkMap = {
      ethereum: 'eth',
      polygon: 'polygon',
      optimism: 'opt',
      arbitrum: 'arb',
      base: 'base'
    };
    
    const chainId = networkMap[network.toLowerCase()] || 'eth';
    // Handle paths differently based on environment to avoid double "api/" in production
    return `${getBaseUrl()}/alchemy?chain=${chainId}`;
  },
  
  /**
   * Get NFTs owned by an address
   * Updated for Alchemy NFT API v3
   */
  async getNftsForOwner(ownerAddress, options = {}) {
    const { 
      network = 'ethereum', 
      pageKey, 
      pageSize = 100,
      excludeSpam = true
    } = options;
    
    try {
      const params = {
        endpoint: 'getNFTsForOwner',
        owner: ownerAddress,
        pageSize,
        withMetadata: true,
        excludeFilters: excludeSpam ? ['SPAM'] : [],
        pageKey: pageKey || null,
        orderBy: options.orderBy || null,
        includeContract: options.includeContract !== false,
        tokenUriTimeoutInMs: options.tokenUriTimeoutInMs || 10000,
        chain: network
      };
      
      console.log(`Fetching NFTs for ${ownerAddress} with params:`, params);
      
      const response = await axios.get(this.getBaseUrl(network), { params });
      
      // Log response for debugging
      console.log(`Received ${response.data?.ownedNfts?.length || 0} NFTs from Alchemy`);
      
      return {
        nfts: response.data?.ownedNfts || [],
        pageKey: response.data?.pageKey,
        totalCount: response.data?.totalCount || 0,
        hasMore: !!response.data?.pageKey
      };
    } catch (error) {
      console.error('Error fetching NFTs for owner from Alchemy:', error.message);
      throw error;
    }
  },
  
  /**
   * Get metadata for a specific NFT
   * Updated for Alchemy NFT API v3
   */
  async getNftMetadata(contractAddress, tokenId, options = {}) {
    const { network = 'ethereum' } = options;
    
    try {
      const params = {
        endpoint: 'getNFTMetadata',
        contractAddress,
        tokenId,
        refreshCache: options.refreshCache || false,
        tokenType: options.tokenType || null,
        chain: network
      };
      
      const response = await axios.get(this.getBaseUrl(network), { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching NFT metadata from Alchemy:', error.message);
      throw error;
    }
  },
  
  /**
   * Get the best quality image URL for an NFT
   */
  async getNftImageUrl(contractAddress, tokenId, options = {}) {
    try {
      const metadata = await this.getNftMetadata(contractAddress, tokenId, options);
      
      // Try to get the best quality image available from v3 API response format
      if (metadata.media && metadata.media.length > 0) {
        // Return the highest resolution image
        const gatewayUrl = metadata.media[0].gateway;
        if (gatewayUrl) return gatewayUrl;
        
        const rawUrl = metadata.media[0].raw;
        if (rawUrl) return rawUrl;
      }
      
      // Fallback to metadata image
      if (metadata.metadata && metadata.metadata.image) {
        return metadata.metadata.image;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting NFT image URL:', error.message);
      return null;
    }
  },
  
  /**
   * Get a collection's NFTs
   * Updated for Alchemy NFT API v3
   */
  async getNftsForCollection(contractAddress, options = {}) {
    const { network = 'ethereum', pageKey, pageSize = 100 } = options;
    
    try {
      const params = {
        endpoint: 'getNFTsForCollection',
        contractAddress,
        withMetadata: true,
        pageSize,
        startToken: pageKey || null,
        tokenUriTimeoutInMs: options.tokenUriTimeoutInMs || 10000,
        chain: network
      };
      
      const response = await axios.get(this.getBaseUrl(network), { params });
      
      return {
        nfts: response.data?.nfts || [],
        pageKey: response.data?.nextToken || null,
        totalCount: response.data?.nfts?.length || 0,
        hasMore: !!response.data?.nextToken
      };
    } catch (error) {
      console.error('Error fetching NFTs for collection from Alchemy:', error.message);
      throw error;
    }
  },
  
  /**
   * Fetch NFTs for multiple addresses at once
   * Updated with better error handling and fallback strategies
   */
  async batchFetchNFTs(addresses, network = 'ethereum', options = {}) {
    if (!addresses || addresses.length === 0) {
      console.error('No addresses provided to batchFetchNFTs');
      return { nfts: [], hasMore: false, pageKey: null, totalCount: 0 };
    }
    
    try {
      const url = this.getBaseUrl(network);
      console.log(`Batch fetching NFTs for ${addresses.length} addresses using: ${url}`);
      
      // First try standard POST request with proper endpoint
      try {
        const response = await axios.post(url, {
          endpoint: 'getNFTsForOwner', // Using endpoint parameter in body
          owners: addresses, // Send all addresses
          pageSize: options.pageSize || 50,
          withMetadata: true,
          excludeFilters: options.excludeSpam !== false ? ['SPAM'] : [],
          chain: network
        });
        
        // Process and return data
        return {
          nfts: response.data?.ownedNfts || [],
          hasMore: !!response.data?.pageKey,
          pageKey: response.data?.pageKey,
          totalCount: response.data?.totalCount || 0
        };
      } catch (error) {
        console.error('Error in batch POST request:', error);
        // Continue to fallback
      }
      
      // Fallback: fetch one by one if server endpoint fails
      console.log('Falling back to individual fetching...');
      const allNfts = [];
      let hasMore = false;
      
      for (const address of addresses) {
        try {
          const result = await this.getNftsForOwner(address, { 
            network, 
            pageSize: options.pageSize || 24,
            pageKey: options.pageKey,
            excludeSpam: options.excludeSpam !== false,
            chain: network
          });
          
          if (result.nfts && Array.isArray(result.nfts)) {
            allNfts.push(...result.nfts);
          }
          
          if (result.pageKey) {
            hasMore = true;
          }
        } catch (err) {
          console.error(`Error fetching NFTs for ${address}:`, err);
          // Continue with other addresses
        }
      }
      
      return {
        nfts: allNfts,
        hasMore,
        pageKey: null,
        totalCount: allNfts.length
      };
    } catch (error) {
      console.error('Error in batchFetchNFTs:', error);
      // Return empty result on failure
      return { nfts: [], hasMore: false, pageKey: null, totalCount: 0 };
    }
  },
};

export default alchemyService; 