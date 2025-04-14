import axios from 'axios';

// Server base URL
const SERVER_URL = 'http://localhost:3001';

/**
 * Service for interacting with the Alchemy API
 */
const alchemyService = {
  apiKeys: {
    ethereum: process.env.REACT_APP_ALCHEMY_ETH_API_KEY,
    base: process.env.REACT_APP_ALCHEMY_BASE_API_KEY,
  },
  
  /**
   * Get the base URL for a specific network
   */
  getBaseUrl(network) {
    const networkMap = {
      'ethereum': 'eth-mainnet',
      'base': 'base-mainnet',
      'ETHEREUM_MAINNET': 'eth-mainnet',
      'BASE_MAINNET': 'base-mainnet',
    };
    
    const mappedNetwork = networkMap[network] || 'eth-mainnet';
    return `https://${mappedNetwork}.g.alchemy.com/v2/${this.apiKeys[network.toLowerCase()] || this.apiKeys.ethereum}`;
  },
  
  /**
   * Get NFTs for a specific address on a network
   */
  async getNftsForOwner(ownerAddress, options = {}) {
    const { network = 'ethereum', pageKey, pageSize = 100 } = options;
    
    try {
      const baseUrl = this.getBaseUrl(network);
      const url = `${baseUrl}/getNFTs`;
      
      const params = {
        owner: ownerAddress,
        pageSize,
        withMetadata: true,
      };
      
      if (pageKey) {
        params.pageKey = pageKey;
      }
      
      const response = await axios.get(url, { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching NFTs from Alchemy:', error.message);
      throw error;
    }
  },
  
  /**
   * Get a specific NFT by contract address and token ID
   */
  async getNftMetadata(contractAddress, tokenId, options = {}) {
    const { network = 'ethereum' } = options;
    
    try {
      const response = await axios.get(`${SERVER_URL}/api/alchemy/nft`, {
        params: {
          contractAddress,
          tokenId,
          network,
        },
      });
      
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
      const baseUrl = this.getBaseUrl(network);
      const url = `${baseUrl}/getNFTsForCollection`;
      
      const params = {
        contractAddress,
        withMetadata: true,
        pageSize,
      };
      
      if (pageKey) {
        params.pageKey = pageKey;
      }
      
      const response = await axios.get(url, { params });
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
      // Use server endpoint for batch fetching
      const response = await axios.post(`${SERVER_URL}/api/alchemy/batch-nfts`, {
        addresses,
        network,
        options
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