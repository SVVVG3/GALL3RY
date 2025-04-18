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
   * Updated for Alchemy NFT API v3 with full pagination support
   */
  async getNftsForOwner(ownerAddress, options = {}) {
    const { 
      network = 'ethereum', 
      pageKey, 
      pageSize = 100,
      excludeSpam = true,
      excludeAirdrops = true,
      fetchAll = true  // New option to fetch all pages
    } = options;
    
    const chainId = this.getChainId(network);
    
    try {
      // Build filter array based on options
      const filters = [];
      if (excludeSpam) filters.push('SPAM');
      if (excludeAirdrops) filters.push('AIRDROPS');
      
      // If fetchAll is true, we'll collect all pages of NFTs
      let allNfts = [];
      let currentPageKey = pageKey;
      let totalFetched = 0;
      let hasMorePages = true;
      
      // Loop to fetch all pages if fetchAll is true
      while (hasMorePages) {
        const params = {
          endpoint: 'getNFTsForOwner',
          chain: chainId,
          owner: ownerAddress,
          pageSize,
          withMetadata: true,
          excludeFilters: filters.length > 0 ? filters : null,
          pageKey: currentPageKey || undefined
        };
        
        console.log(`Fetching NFTs for ${ownerAddress} on ${chainId}${currentPageKey ? ' (continuation page)' : ''} with filters: ${filters.join(', ')}`);
        
        // Use the dynamically updated ALCHEMY_ENDPOINT instead of calling getBaseUrl()
        const response = await axios.get(ALCHEMY_ENDPOINT, { params });
        
        // Get NFTs from this page
        const nftsFromPage = (response.data?.ownedNfts || []).map(nft => ({
          ...nft,
          network: chainId,
          ownerAddress
        }));
        
        // Add to our collection
        allNfts = [...allNfts, ...nftsFromPage];
        totalFetched += nftsFromPage.length;
        
        // Log progress
        console.log(`Received ${nftsFromPage.length} NFTs from Alchemy on ${chainId}${currentPageKey ? ' (continuation page)' : ''}, total: ${totalFetched}`);
        
        // Update pageKey for next iteration
        currentPageKey = response.data?.pageKey;
        
        // Determine if we should continue pagination
        hasMorePages = fetchAll && !!currentPageKey;
        
        // Safety check - don't loop infinitely
        if (totalFetched >= 1000) {
          console.warn(`Reached safety limit of 1000 NFTs for ${ownerAddress} on ${chainId}, stopping pagination`);
          hasMorePages = false;
        }
        
        // If we're not fetching all pages, break after first request
        if (!fetchAll) {
          break;
        }
      }
      
      return {
        nfts: allNfts,
        pageKey: currentPageKey,
        totalCount: totalFetched,
        hasMore: !!currentPageKey
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
    const fetchAll = options.fetchAll !== false; // Default to true
    
    try {
      console.log(`Fetching NFTs across ${chains.length} chains for ${ownerAddress}${fetchAll ? ' (all pages)' : ''}`);
      
      // Make parallel requests to all chains
      const results = await Promise.allSettled(
        chains.map(chainId => 
          this.getNftsForOwner(ownerAddress, {
            network: chainId,
            pageSize,
            excludeSpam: options.excludeSpam !== false,
            excludeAirdrops: options.excludeAirdrops !== false,
            fetchAll: fetchAll
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
      let uniqueNfts = allNfts.filter(nft => {
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

/**
 * Get asset transfers for addresses to track NFT ownership history
 * Uses Alchemy's getAssetTransfers endpoint to get NFT transfer history
 */
async function getAssetTransfers(addresses, options = {}) {
  if (!addresses || addresses.length === 0) {
    console.warn('No addresses provided to getAssetTransfers');
    return { transfers: [], transferMap: {} };
  }
  
  try {
    // Get the chains to fetch from (defaulting to ETH only for transfers to reduce API calls)
    const chain = options.chain || 'eth';
    
    // Clean and validate addresses
    const validAddresses = addresses
      .filter(addr => addr && typeof addr === 'string')
      .map(addr => addr.toLowerCase().trim());
    
    if (validAddresses.length === 0) {
      console.warn('No valid addresses after formatting');
      return { transfers: [], transferMap: {} };
    }
    
    console.log(`Fetching NFT transfers for ${validAddresses.length} addresses on ${chain}`);
    
    // Build the params for the Alchemy API call
    const params = {
      endpoint: 'getAssetTransfers',
      chain,
      addresses: validAddresses.join(','),
      order: options.order || 'desc',
      debug: options.debug === true ? 'true' : undefined,
      category: ['ERC721', 'ERC1155'] // Explicitly specify NFT categories
    };
    
    console.log(`Fetching transfers with params:`, {
      endpoint: params.endpoint,
      chain: params.chain,
      addressCount: validAddresses.length,
      order: params.order,
      debug: params.debug
    });
    
    // Call our backend API which will handle the RPC call
    const response = await axios.get(ALCHEMY_ENDPOINT, { params });
    
    // Check if we got a valid response
    if (!response.data) {
      console.warn('Empty response from getAssetTransfers API');
      return { transfers: [], transferMap: {} };
    }
    
    // Check if we have the transferMap
    if (!response.data.transferMap) {
      console.warn('Response missing transferMap:', response.data);
      return { 
        transfers: response.data.transfers || [], 
        transferMap: {},
        diagnostic: response.data.diagnostic || { error: 'Missing transferMap in response' }
      };
    }
    
    console.log(`Got transfer data with ${response.data.count || 0} entries, ${Object.keys(response.data.transferMap).length} mapped items`);
    
    return {
      transfers: response.data.transfers || [],
      transferMap: response.data.transferMap || {},
      processedCount: response.data.processedCount,
      diagnostic: response.data.diagnostic
    };
  } catch (error) {
    console.error('Error fetching asset transfers:', error);
    const errorDetails = {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data
    };
    console.error('Error details:', errorDetails);
    
    return { 
      transfers: [], 
      transferMap: {},
      error: error.message,
      diagnostic: { error: error.message, stack: error.stack, details: errorDetails }
    };
  }
}

// Export convenience functions
export const fetchNftsForOwner = (address, options) => 
  alchemyService.getNftsForOwner(address, options);

export const fetchNftsAcrossChains = (address, options) =>
  alchemyService.fetchNftsAcrossChains(address, options);

export const fetchNftsForAddresses = (addresses, options) =>
  alchemyService.fetchNftsForMultipleAddresses(addresses, options);

export const fetchAssetTransfers = (addresses, options) =>
  getAssetTransfers(addresses, options);

export default alchemyService; 