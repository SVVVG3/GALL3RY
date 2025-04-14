import axios from 'axios';

// Get server URL from env vars or use a default
const SERVER_URL = process.env.REACT_APP_API_URL || '';

/**
 * Service for interacting with Alchemy NFT APIs
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
    return `${SERVER_URL}/api/alchemy?chain=${chainId}`;
  },
  
  /**
   * Get NFTs owned by an address
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
        excludeSpam
      };
      
      if (pageKey) {
        params.pageKey = pageKey;
      }
      
      const response = await axios.get(this.getBaseUrl(network), { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching NFTs for owner from Alchemy:', error.message);
      throw error;
    }
  },
  
  /**
   * Get metadata for a specific NFT
   */
  async getNftMetadata(contractAddress, tokenId, options = {}) {
    const { network = 'ethereum' } = options;
    
    try {
      const params = {
        endpoint: 'getNFTMetadata',
        contractAddress,
        tokenId
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
      
      // Try to get the best quality image available
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
   */
  async getNftsForCollection(contractAddress, options = {}) {
    const { network = 'ethereum', pageKey, pageSize = 100 } = options;
    
    try {
      const params = {
        endpoint: 'getNFTsForCollection',
        contractAddress,
        withMetadata: true,
        pageSize
      };
      
      if (pageKey) {
        params.pageKey = pageKey;
      }
      
      const response = await axios.get(this.getBaseUrl(network), { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching NFTs for collection from Alchemy:', error.message);
      throw error;
    }
  },
  
  /**
   * Fetch NFTs for multiple addresses at once
   */
  async batchFetchNFTs(addresses, network = 'ethereum', options = {}) {
    if (!addresses || addresses.length === 0) {
      console.error('No addresses provided to batchFetchNFTs');
      return { nfts: [], hasMore: false, pageKey: null, totalCount: 0 };
    }
    
    try {
      const url = this.getBaseUrl(network);
      
      const response = await axios.post(url, {
        endpoint: 'getNFTMetadataBatch',
        tokens: addresses.map(address => ({ address }))
      });
      
      return {
        nfts: response.data.nfts || [],
        hasMore: !!response.data.pageKey,
        pageKey: response.data.pageKey,
        totalCount: response.data.totalCount || 0
      };
    } catch (error) {
      console.error('Error in batchFetchNFTs:', error);
      
      // Fallback: fetch one by one if server endpoint fails
      console.log('Falling back to individual fetching...');
      const allNfts = [];
      let hasMore = false;
      
      for (const address of addresses) {
        try {
          const result = await this.getNftsForOwner(address, { 
            network, 
            pageSize: options.pageSize || 24,
            pageKey: options.pageKey
          });
          
          if (result.ownedNfts) {
            allNfts.push(...result.ownedNfts);
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
    }
  },
};

export default alchemyService; 