import axios from 'axios';
import { getApiBaseUrl } from '../utils/runtimeConfig';

// Base URL for Alchemy API requests
const getBaseUrl = () => {
  // Use the runtime config URL or fallback to environment variable
  // This helps work correctly with the dynamic port in development
  if (typeof window !== 'undefined' && window.__RUNTIME_CONFIG__ && window.__RUNTIME_CONFIG__.apiUrl) {
    return `${window.__RUNTIME_CONFIG__.apiUrl}/alchemy`;
  }
  
  // Production fallback
  if (process.env.NODE_ENV === 'production') {
    return `${window.location.origin}/api/alchemy`;
  }
  
  // Development fallback (note: the actual port may change, but this will be overridden by runtime config)
  return 'http://localhost:3001/api/alchemy';
};

// Initialize the SERVER_URL with a default value
// Will be updated dynamically when initializeEndpoints() is called
let SERVER_URL = '';
let ALCHEMY_ENDPOINT = '';

// Initialize endpoints after we've loaded the API base URL
async function initializeEndpoints() {
  try {
    const baseUrl = await getApiBaseUrl();
    
    // Only update if SERVER_URL has changed or is not yet set
    if (!SERVER_URL || SERVER_URL !== baseUrl) {
      SERVER_URL = baseUrl;
      console.log(`Initialized Alchemy SERVER_URL: ${SERVER_URL}`);
      
      ALCHEMY_ENDPOINT = `${SERVER_URL}/alchemy`;
      console.log(`Alchemy API endpoint initialized: ${ALCHEMY_ENDPOINT}`);
    }
  } catch (error) {
    console.error('Failed to initialize Alchemy endpoints:', error);
    // Fallback to default values
    SERVER_URL = '/api';
    ALCHEMY_ENDPOINT = `${SERVER_URL}/alchemy`;
  }
}

// Call initialization immediately
initializeEndpoints();

// Reinitialize service periodically
setInterval(() => {
  console.log('Refreshing Alchemy API endpoints configuration...');
  initializeEndpoints()
    .then(() => console.log('Alchemy API endpoints refreshed'))
    .catch(err => console.error('Failed to refresh Alchemy API endpoints:', err));
}, 60000); // Check every minute

// Define all supported chains
const SUPPORTED_CHAINS = [
  { id: 'eth', name: 'Ethereum', network: 'ethereum' },
  { id: 'polygon', name: 'Polygon', network: 'polygon' },
  { id: 'opt', name: 'Optimism', network: 'optimism' },
  { id: 'arb', name: 'Arbitrum', network: 'arbitrum' },
  { id: 'base', name: 'Base', network: 'base' }
];

/**
 * Service for interacting with Alchemy NFT APIs
 * Updated to follow Alchemy NFT API v3 documentation
 */
const alchemyService = {
  /**
   * Helper to convert network name to chain ID
   */
  getChainId(network) {
    const chain = SUPPORTED_CHAINS.find(c => 
      c.network.toLowerCase() === network.toLowerCase() || 
      c.id.toLowerCase() === network.toLowerCase()
    );
    return chain ? chain.id : 'eth';
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
    
    const chainId = this.getChainId(network);
    
    try {
      const params = {
        endpoint: 'getNFTsForOwner',
        chain: chainId,
        owner: ownerAddress,
        pageSize,
        withMetadata: true,
        excludeFilters: excludeSpam ? 'SPAM' : null,
        pageKey: pageKey || undefined
      };
      
      console.log(`Fetching NFTs for ${ownerAddress} on ${chainId}`);
      
      // Use the dynamically updated ALCHEMY_ENDPOINT instead of calling getBaseUrl()
      const response = await axios.get(ALCHEMY_ENDPOINT, { params });
      
      // Log response for debugging
      console.log(`Received ${response.data?.ownedNfts?.length || 0} NFTs from Alchemy on ${chainId}`);
      
      // Add chain/network info to each NFT
      const nfts = (response.data?.ownedNfts || []).map(nft => ({
        ...nft,
        network: chainId,
        ownerAddress
      }));
      
      return {
        nfts,
        pageKey: response.data?.pageKey,
        totalCount: response.data?.totalCount || 0,
        hasMore: !!response.data?.pageKey
      };
    } catch (error) {
      console.error(`Error fetching NFTs on ${chainId} for ${ownerAddress}:`, error.message);
      
      // Return empty result on failure for this chain
      return {
        nfts: [],
        pageKey: null,
        totalCount: 0,
        hasMore: false,
        error: error.message
      };
    }
  },
  
  /**
   * Fetch NFTs across multiple chains and combine the results
   */
  async fetchNftsAcrossChains(ownerAddress, options = {}) {
    // Get the chains to fetch from
    const chains = options.chains || SUPPORTED_CHAINS.map(c => c.id);
    const pageSize = options.pageSize || 100;
    
    try {
      console.log(`Fetching NFTs across ${chains.length} chains for ${ownerAddress}`);
      
      // Make parallel requests to all chains
      const results = await Promise.allSettled(
        chains.map(chainId => 
          this.getNftsForOwner(ownerAddress, {
            network: chainId,
            pageSize,
            excludeSpam: options.excludeSpam !== false
          })
        )
      );
      
      // Combine results from successful requests
      let allNfts = [];
      let totalErrors = 0;
      let totalCount = 0;
      
      results.forEach((result, index) => {
        const chainId = chains[index];
        
        if (result.status === 'fulfilled') {
          const nfts = result.value.nfts || [];
          totalCount += nfts.length;
          
          // Tag each NFT with its chain if not already tagged
          allNfts = [
            ...allNfts,
            ...nfts.map(nft => ({
              ...nft,
              network: nft.network || chainId
            }))
          ];
          
          console.log(`Added ${nfts.length} NFTs from ${chainId}`);
        } else {
          totalErrors++;
          console.error(`Failed to fetch NFTs from ${chainId}:`, result.reason);
        }
      });
      
      console.log(`Total: ${allNfts.length} NFTs found across ${chains.length - totalErrors}/${chains.length} chains`);
      
      return {
        nfts: allNfts,
        totalCount,
        hasMore: false, // We don't handle pagination across chains in this implementation
        chainsWithErrors: totalErrors > 0
      };
    } catch (error) {
      console.error('Error in fetchNftsAcrossChains:', error.message);
      return {
        nfts: [],
        totalCount: 0,
        hasMore: false,
        error: error.message
      };
    }
  },
  
  /**
   * Fetch NFTs for multiple addresses across multiple chains
   */
  async fetchNftsForMultipleAddresses(addresses, options = {}) {
    if (!addresses || addresses.length === 0) {
      console.warn('No addresses provided to fetchNftsForMultipleAddresses');
      return { nfts: [], totalCount: 0 };
    }
    
    try {
      console.log(`Fetching NFTs for ${addresses.length} addresses across chains`);
      
      // Get all NFTs for each address across chains
      const results = await Promise.all(
        addresses.map(address => 
          this.fetchNftsAcrossChains(address, options)
        )
      );
      
      // Combine all NFTs from all addresses
      let allNfts = [];
      results.forEach(result => {
        if (result.nfts && Array.isArray(result.nfts)) {
          allNfts = [...allNfts, ...result.nfts];
        }
      });
      
      console.log(`Total ${allNfts.length} NFTs found across all addresses and chains`);
      
      // Remove duplicates by using contract address and token ID as unique key
      const seen = new Set();
      const uniqueNfts = allNfts.filter(nft => {
        const key = `${nft.contract?.address}-${nft.tokenId}-${nft.network}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      
      console.log(`After removing duplicates: ${uniqueNfts.length} unique NFTs`);
      
      // Enrich NFT data with image URLs if they're missing
      const enrichWithImageUrls = (nfts) => {
        return nfts.map(nft => {
          // If we already have image data, return as is
          if (nft.image || nft.image_url || 
             (nft.media && nft.media.length > 0) || 
             nft.animation_url || 
             (nft.metadata && (nft.metadata.image || nft.metadata.image_url))) {
            return nft;
          }
          
          // Try to add image URL based on contract address and token ID
          if (nft.contract && nft.contract.address && nft.tokenId) {
            const imageUrl = `https://nft-cdn.alchemy.com/eth-mainnet/${nft.contract.address}/${nft.tokenId}`;
            nft.image_url = imageUrl;
            
            // Add media array if it doesn't exist
            if (!nft.media) {
              nft.media = [{
                raw: imageUrl,
                gateway: imageUrl
              }];
            }
          }
          
          return nft;
        });
      };
      
      // Add this call before returning the NFTs
      if (uniqueNfts.length > 0) {
        uniqueNfts = enrichWithImageUrls(uniqueNfts);
      }
      
      return {
        nfts: uniqueNfts,
        totalCount: uniqueNfts.length
      };
    } catch (error) {
      console.error('Error in fetchNftsForMultipleAddresses:', error);
      return { nfts: [], totalCount: 0, error: error.message };
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
      
      const response = await axios.get(ALCHEMY_ENDPOINT, { params });
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
      
      const response = await axios.get(ALCHEMY_ENDPOINT, { params });
      
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
};

// Export convenience functions
export const fetchNftsForOwner = (address, options) => 
  alchemyService.getNftsForOwner(address, options);

export const fetchNftsAcrossChains = (address, options) =>
  alchemyService.fetchNftsAcrossChains(address, options);

export const fetchNftsForAddresses = (addresses, options) =>
  alchemyService.fetchNftsForMultipleAddresses(addresses, options);

export default alchemyService; 