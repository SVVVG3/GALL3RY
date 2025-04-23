import axios from 'axios';
import { getApiBaseUrl, getAlchemyApiKey } from '../utils/runtimeConfig';

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
class AlchemyService {
  constructor() {
    this.apiKey = null;
    this.requestCache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes cache TTL
  }

  // Store the API key
  apiKey = null;

  /**
   * Get cached response based on cache key
   * @param {string} cacheKey - The cache key
   * @returns {Promise<Object|null>} - Cached data or null if not found/expired
   */
  async getCachedResponse(cacheKey) {
    const cachedResponse = this.requestCache.get(cacheKey);
    if (cachedResponse && cachedResponse.timestamp > Date.now() - this.cacheTTL) {
      return cachedResponse.data;
    }
    return null;
  }

  /**
   * Set cached response
   * @param {string} cacheKey - The cache key 
   * @param {Object} data - The data to cache
   */
  async setCachedResponse(cacheKey, data) {
    this.requestCache.set(cacheKey, {
      data,
      timestamp: Date.now()
    });
    return data;
  }

  // Initialize the API key
  async initApiKey() {
    if (!this.apiKey) {
      this.apiKey = await getAlchemyApiKey();
      if (!this.apiKey) {
        // Fallback to environment variable directly as a last resort
        this.apiKey = process.env.REACT_APP_ALCHEMY_API_KEY;
        console.warn('Using fallback Alchemy API key from environment variables');
      }
      console.log(`Alchemy API key initialized: ${this.apiKey ? 'Successfully' : 'Failed'}`);
    }
    return this.apiKey;
  }

  /**
   * Get the Alchemy URL for the specified chain
   * @param {string} chainId - The chain ID, e.g. 'eth', 'polygon', etc.
   * @param {string} endpoint - Optional endpoint name to append to the URL
   * @param {string} queryParams - Optional query parameters
   * @returns {Promise<string>} - The Alchemy URL
   */
  async getAlchemyUrl(chainId = 'eth', endpoint = '', queryParams = '') {
    await this.initApiKey();
    
    // Always use the server proxy - never expose API key client-side
    let baseUrl;
    if (typeof window !== 'undefined') {
      // Client-side (browser) - always use proxy
      baseUrl = process.env.NODE_ENV === 'production'
        ? '/api/alchemy-proxy'
        : 'http://localhost:3000/api/alchemy-proxy';
        
      baseUrl = `${baseUrl}/${chainId}`;
    } else {
      // Server-side - construct direct URL (API key not exposed to client)
      const network = this.getNetworkFromChainId(chainId);
      baseUrl = `https://${network}.g.alchemy.com/nft/v3/${this.apiKey}`;
    }
    
    // Return just the base URL if no endpoint is provided
    if (!endpoint) {
      return baseUrl;
    }
    
    // Construct the URL with the endpoint and query params if provided
    let url = `${baseUrl}/${endpoint}`;
    if (queryParams) {
      // If query params already has a ? at the beginning, remove it
      if (queryParams.startsWith('?')) {
        queryParams = queryParams.substring(1);
      }
      url += `?${queryParams}`;
    }
    
    return url;
  }

  /**
   * Determines the network name based on chainId
   * @param {string} chainId - The chain ID ('eth', 'polygon', etc.)
   * @returns {string} - The network name for Alchemy URL
   */
  getNetworkFromChainId(chainId) {
    switch (chainId.toLowerCase()) {
      case 'eth':
        return 'eth-mainnet';
      case 'polygon':
        return 'polygon-mainnet';
      case 'opt':
        return 'opt-mainnet';
      case 'arb':
        return 'arb-mainnet';
      case 'base':
        return 'base-mainnet';
      default:
        return 'eth-mainnet';
    }
  }

  /**
   * Helper to convert network name to chain ID
   */
  getChainId(network) {
    const chain = SUPPORTED_CHAINS.find(c => 
      c.network.toLowerCase() === network.toLowerCase() || 
      c.id.toLowerCase() === network.toLowerCase()
    );
    return chain ? chain.id : 'eth';
  }
  
  /**
   * Validates if a string is a valid Ethereum address
   * @param {string} address - The address to validate
   * @returns {boolean} - Whether the address is valid
   */
  isValidAddress(address) {
    return typeof address === 'string' && 
           address.startsWith('0x') && 
           address.length === 42 && 
           /^0x[0-9a-fA-F]{40}$/.test(address);
  }
  
  /**
   * Gets NFTs for a specific owner
   * @param {string} owner - The owner address
   * @param {Object} options - Query options
   * @param {string} chain - The blockchain network
   * @returns {Promise<Array>} - The NFTs
   */
  async getNftsForOwner(owner, options = {}, chain = 'eth') {
    try {
      // Build a cache key
      const cacheKey = `nfts_${owner}_${JSON.stringify(options)}_${chain}`;
      
      // Check if we have a valid cached response
      const cachedResponse = await this.getCachedResponse(cacheKey);
      if (cachedResponse) {
        console.log(`Using cached NFTs for ${owner} on ${chain}`);
        return cachedResponse;
      }
      
      console.log(`Cache miss for NFTs fetch: ${owner.slice(0, 8)}... on ${chain}`);
      
      // Build query parameters
      const queryParams = new URLSearchParams({
        endpoint: 'getNFTsForOwner',
        network: chain,
        owner,
        withMetadata: options.withMetadata !== false ? 'true' : 'false',
        pageSize: options.pageSize || '100'
      });

      // Handle excludeFilters - only add SPAM as a valid filter
      // AIRDROP is not a valid filter according to Alchemy API v3
      if (options.excludeSpam === true) {
        queryParams.append('excludeFilters[]', 'SPAM');
      }
      
      // Add pageKey if provided
      if (options.pageKey) {
        queryParams.append('pageKey', options.pageKey);
      }

      const url = `${ALCHEMY_ENDPOINT}?${queryParams.toString()}`;
      
      console.log(`Fetching NFTs for ${owner} on ${chain} with URL: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'accept': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to fetch NFTs on ${chain}:`, errorText);
        throw new Error(`Failed to fetch NFTs on ${chain}: ${errorText}`);
      }

      const data = await response.json();
      
      // Add chain information to each NFT
      if (data.ownedNfts) {
        data.ownedNfts = data.ownedNfts.map(nft => ({
          ...nft,
          chain,
          network: chain // Add both for compatibility
        }));
      }
      
      // Handle pagination if fetchAll is true
      if (options.fetchAll && data.pageKey) {
        const nextPageOptions = {
          ...options,
          pageKey: data.pageKey
        };
        
        const nextPageResults = await this.getNftsForOwner(owner, nextPageOptions, chain);
        
        // Combine results
        data.ownedNfts = [
          ...data.ownedNfts,
          ...(nextPageResults.ownedNfts || [])
        ];
        
        delete data.pageKey;
      }

      // Cache the response
      await this.setCachedResponse(cacheKey, data);
      
      return data;
    } catch (error) {
      console.error(`Error in getNftsForOwner for ${chain}:`, error);
      return { error: error.message, ownedNfts: [] };
    }
  }
  
  /**
   * Fetches NFTs across all chains for an owner
   * @param {string} owner - The owner address
   * @param {Object} options - Query options
   * @returns {Promise<Object>} - NFTs organized by chain
   */
  async fetchNftsAcrossChains(owner, options = {}) {
    try {
      if (!owner) {
        console.log('fetchNftsAcrossChains: No wallet address provided');
        return { error: 'No wallet address provided', ownedNfts: [] };
      }
      
      this.initializeApiKey();
      
      if (!this.apiKey) {
        console.error('No API key available for Alchemy requests');
        return { error: 'API key configuration error', ownedNfts: [] };
      }

      // Determine chains to fetch
      const chainFilter = options.chains || this.supportedChains;
      const chainsToFetch = Array.isArray(chainFilter) 
        ? this.supportedChains.filter(chain => chainFilter.includes(chain))
        : this.supportedChains;
      
      console.log(`Fetching NFTs across ${chainsToFetch.length} chains for ${owner}`);
      
      // Set up fetch options - include metadata and pagination settings
      const fetchOptions = {
        ...options,
        withMetadata: options.withMetadata !== false,
        pageSize: options.pageSize || '100',
        fetchAll: options.fetchAll !== false
      };
      
      // Handle filters - only add SPAM as a valid filter
      // AIRDROP is not a valid filter according to Alchemy API v3
      fetchOptions.excludeSpam = options.excludeSpam === true;
      
      // Remove any invalid filter options that could cause API errors
      if (fetchOptions.excludeFilters) {
        delete fetchOptions.excludeFilters;
      }
      
      if (fetchOptions.excludeAirdrops) {
        delete fetchOptions.excludeAirdrops;
      }

      // Create an array of promises, one for each chain
      const chainPromises = chainsToFetch.map(chain => 
        this.getNftsForOwner(owner, fetchOptions, chain)
          .catch(error => {
            console.error(`Error fetching NFTs on ${chain}:`, error);
            return { 
              error: `Error on ${chain}: ${error.message}`,
              ownedNfts: [] 
            };
          })
      );
      
      // Wait for all promises to settle
      const results = await Promise.allSettled(chainPromises);
      
      // Process all results
      const nftsByChain = {};
      let totalNfts = 0;
      const errors = [];
      
      // Build the combined results object
      results.forEach((result, index) => {
        const chain = chainsToFetch[index];
        
        if (result.status === 'fulfilled') {
          const data = result.value;
          const nfts = data.ownedNfts || [];
          
          if (data.error) {
            errors.push(data.error);
          }
          
          nftsByChain[chain] = nfts;
          totalNfts += nfts.length;
          
          if (nfts.length > 0) {
            console.log(`Found ${nfts.length} NFTs for ${owner} on ${chain}`);
          }
        } else {
          errors.push(`Error on ${chain}: ${result.reason}`);
          nftsByChain[chain] = [];
        }
      });
      
      // Return combined results
      return {
        ownedNfts: Object.values(nftsByChain).flat(),
        nftsByChain,
        totalNfts,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      console.error('Error in fetchNftsAcrossChains:', error);
      return { error: error.message, ownedNfts: [] };
    }
  }
  
  /**
   * Creates a consistent unique identifier for NFTs across the application
   * @param {Object} nft - The NFT object 
   * @returns {string} A unique identifier string
   */
  createConsistentUniqueId(nft) {
    if (!nft) return '';
    
    // Extract contract address - normalize to lowercase
    const contractAddress = (
      (nft.contract?.address) || 
      (nft.contractAddress) || 
      ''
    ).toLowerCase();
    
    // Extract token ID - normalize to string and remove leading zeros
    const tokenId = String(
      (nft.tokenId) || 
      (nft.token_id) || 
      ''
    ).trim();
    
    // Extract network - normalize to lowercase
    const network = (
      (nft.network) || 
      (nft.chain) ||
      (nft.chainId) ||
      'eth'
    ).toLowerCase();
    
    // Create a consistent unique ID - independent of wallet
    // This ensures the same NFT owned by different wallets is considered the same
    return `${network}:${contractAddress}:${tokenId}`;
  }
  
  /**
   * Fetches NFTs for multiple wallet addresses
   * @param {string[]} addresses - Array of wallet addresses
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} - Unique NFTs from all wallets
   */
  async fetchNftsForMultipleAddresses(addresses, options = {}) {
    try {
      // Filter valid addresses
      const validAddresses = (addresses || [])
        .filter(address => address && typeof address === 'string' && address.trim() !== '')
        .map(address => address.toLowerCase());
      
      if (validAddresses.length === 0) {
        console.log('No valid addresses provided for fetchNftsForMultipleAddresses');
        return { uniqueNfts: [], errors: ['No valid addresses provided'] };
      }
      
      console.log(`Fetching NFTs for ${validAddresses.length} wallet addresses`);
      
      // Set up fetch options with defaults
      const fetchOptions = {
        ...options,
        withMetadata: options.withMetadata !== false,
        pageSize: options.pageSize || '100'
      };
      
      // Only include valid filters
      // Alchemy API v3 only supports SPAM as a valid filter
      fetchOptions.excludeSpam = options.excludeSpam === true;
      
      // Remove any invalid filter options that could cause API errors
      if (fetchOptions.excludeFilters) {
        delete fetchOptions.excludeFilters;
      }
      
      if (fetchOptions.excludeAirdrops) {
        delete fetchOptions.excludeAirdrops;
      }
      
      // Determine chains to fetch from
      const chainsToFetch = options.chains || this.supportedChains;
      console.log(`Fetching across chains: ${chainsToFetch.join(', ')}`);
      
      // Create parallel fetch tasks for all addresses and chains
      const fetchTasks = [];
      
      validAddresses.forEach(address => {
        chainsToFetch.forEach(chain => {
          fetchTasks.push({
            address,
            chain,
            task: () => this.getNftsForOwner(address, fetchOptions, chain)
              .catch(error => {
                console.error(`Error fetching NFTs for ${address} on ${chain}:`, error);
                return { 
                  error: `Error on ${chain}: ${error.message}`,
                  ownedNfts: [] 
                };
              })
          });
        });
      });
      
      console.log(`Created ${fetchTasks.length} parallel fetch tasks`);
      
      // Execute all fetch tasks in parallel
      const taskResults = await Promise.allSettled(
        fetchTasks.map(task => task.task())
      );
      
      // Track unique NFTs and errors
      const uniqueNftsMap = new Map();
      const walletNftCount = {};
      const errors = [];
      
      // Process results and deduplicate NFTs
      taskResults.forEach((result, index) => {
        const { address, chain } = fetchTasks[index];
        
        // Initialize count for this wallet if not exists
        if (!walletNftCount[address]) {
          walletNftCount[address] = 0;
        }
        
        if (result.status === 'fulfilled') {
          const data = result.value;
          const nfts = data.ownedNfts || [];
          
          if (data.error) {
            errors.push(data.error);
          }
          
          // Count NFTs for this wallet and add unique ones to the map
          if (nfts.length > 0) {
            walletNftCount[address] += nfts.length;
            
            nfts.forEach(nft => {
              // Use our consistent unique ID function for better deduplication
              const uniqueId = this.createConsistentUniqueId({
                ...nft,
                chain
              });
              
              if (!uniqueNftsMap.has(uniqueId)) {
                // Add chain and ownership information to the NFT
                uniqueNftsMap.set(uniqueId, {
                  ...nft,
                  chain,
                  chainId: chain,
                  network: chain,
                  ownerAddress: address,
                  uniqueId // Add the uniqueId to the NFT object for future reference
                });
              }
            });
          }
        } else {
          errors.push(`Error fetching for ${address} on ${chain}: ${result.reason}`);
        }
      });
      
      // Log counts per wallet
      Object.entries(walletNftCount).forEach(([wallet, count]) => {
        if (count > 0) {
          console.log(`Found ${count} NFTs for wallet ${wallet}`);
        }
      });
      
      // Convert the Map to an array for the final result
      const uniqueNfts = Array.from(uniqueNftsMap.values());
      console.log(`Found ${uniqueNfts.length} unique NFTs across all wallets`);
      
      return {
        uniqueNfts,
        totalFound: uniqueNfts.length,
        walletNftCount,
        errors: errors.length > 0 ? errors : undefined
      };
      
    } catch (error) {
      console.error('Error in fetchNftsForMultipleAddresses:', error);
      return { 
        uniqueNfts: [], 
        error: error.message 
      };
    }
  }
  
  /**
   * Helper function to determine if a collection exists on a specific chain
   * This is a simplified version - in production, you'd want to maintain a database
   * of known collections per chain or query an API
   */
  isCollectionOnChain(contractAddress, chainId) {
    if (!contractAddress || !chainId) return false;
    
    // Convert to lowercase for comparisons
    contractAddress = contractAddress.toLowerCase();
    
    // Known collections per chain
    const chainCollections = {
      'base': [
        '0x7d5861cfe1c74aaa0999b7e2651bf2ebd2a62d89', // Base Pups
        '0xbce3781ae7ca1a5e050bd9c4c77369867ebc307e'  // Base Bored Apes
      ],
      'opt': [
        '0x7a11f4cc9343b3a966dd5e094ee21e556a012ea4', // Optimism Quests
        '0x3b8aa8ef34afddeeb2d8f4b608cb7703af0e7db9'  // Optisaurs
      ],
      'arb': [
        '0xd2a077ec359d94e0a0b7e84435eacb40a67a817c', // Smol Brains
        '0x8ffb9b504d497e4000967391e70d542b8cc6748a'  // Arbitrum Planet
      ],
      'polygon': [
        '0x2953399124f0cbb46d2cbacd8a89cf0599974963', // OpenSea Polygon
        '0x5ce9fa5cd001f133a5422b1c283196e4574e1c73'  // Lens Protocol
      ]
    };
    
    // Check if the contract address is in the list for this chain
    return chainCollections[chainId]?.includes(contractAddress) || false;
  }
  
  /**
   * Get metadata for a specific NFT
   * @param {string} contractAddress - The contract address of the NFT
   * @param {string} tokenId - The token ID of the NFT
   * @param {string} chainId - The chain ID, e.g. 'eth', 'polygon', etc.
   * @returns {Promise<Object>} - The NFT metadata
   */
  async getNftMetadata(contractAddress, tokenId, chainId = 'eth') {
    try {
      // Create a cache key
      const cacheKey = `metadata_${contractAddress.toLowerCase()}_${tokenId}_${chainId.toLowerCase()}`;
      
      // Check if we have a valid cached response
      const cachedResponse = this.requestCache.get(cacheKey);
      if (cachedResponse && cachedResponse.timestamp > Date.now() - this.cacheTTL) {
        console.log(`Using cached metadata for ${contractAddress} token ${tokenId} on ${chainId}`);
        return cachedResponse.data;
      }
      
      const baseUrl = await this.getAlchemyUrl(chainId);
      const url = `${baseUrl}/getNFTMetadata?contractAddress=${contractAddress}&tokenId=${tokenId}`;
      
      console.log(`Fetching metadata for ${contractAddress} token ${tokenId} on ${chainId}`);
      const response = await fetch(url);
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to fetch NFT metadata: ${error}`);
      }
      
      const data = await response.json();
      
      // Store in cache
      this.requestCache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });
      
      return data;
    } catch (error) {
      console.error(`Error fetching NFT metadata for ${contractAddress} token ${tokenId} on ${chainId}:`, error);
      return null;
    }
  }
  
  /**
   * Get the best quality image URL for an NFT
   */
  async getNftImageUrl(contractAddress, tokenId, options = {}) {
    // Make sure API key is initialized
    await this.initApiKey();

    try {
      // Create a cache key for the image URL
      const chainId = options.chainId || 'eth';
      const cacheKey = `image_url_${contractAddress.toLowerCase()}_${tokenId}_${chainId.toLowerCase()}`;
      
      // Check if we have a valid cached response
      const cachedResponse = await this.getCachedResponse(cacheKey);
      if (cachedResponse) {
        console.log(`Using cached image URL for ${contractAddress} token ${tokenId} on ${chainId}`);
        return cachedResponse;
      }
      
      const metadata = await this.getNftMetadata(contractAddress, tokenId, chainId);
      
      let imageUrl = null;
      
      // Try to get the best quality image available from v3 API response format
      if (metadata && metadata.media && metadata.media.length > 0) {
        // Return the highest resolution image
        const gatewayUrl = metadata.media[0].gateway;
        if (gatewayUrl) imageUrl = gatewayUrl;
        
        if (!imageUrl) {
          const rawUrl = metadata.media[0].raw;
          if (rawUrl) imageUrl = rawUrl;
        }
      }
      
      // Fallback to metadata image
      if (!imageUrl && metadata && metadata.metadata && metadata.metadata.image) {
        imageUrl = metadata.metadata.image;
      }
      
      // Cache the result if we found an image URL
      if (imageUrl) {
        await this.setCachedResponse(cacheKey, imageUrl);
      }
      
      return imageUrl;
    } catch (error) {
      console.error('Error getting NFT image URL:', error.message);
      return null;
    }
  }
  
  /**
   * Gets NFTs for a specific collection
   * @param {string} contractAddress - The contract address
   * @param {Object} options - Additional options for the request
   * @param {string} chain - The blockchain network
   * @returns {Promise<Object>} - The NFTs data
   */
  async getNftsForCollection(contractAddress, options = {}, chain = 'eth') {
    try {
      // Create a cache key based on contract address, options and chain
      const cacheKey = `nfts_collection_${contractAddress.toLowerCase()}_${chain}_${JSON.stringify(options)}`;
      
      // Check if we have a valid cached response
      const cachedResponse = this.requestCache.get(cacheKey);
      if (cachedResponse && cachedResponse.timestamp > Date.now() - this.cacheTTL) {
        console.log(`Using cached NFTs for collection ${contractAddress} on ${chain}`);
        return cachedResponse.data;
      }
      
      // Build query parameters
      let queryParams = `contractAddress=${contractAddress}`;
      
      // Add options to query
      if (options.startToken) queryParams += `&startToken=${options.startToken}`;
      if (options.withMetadata !== undefined) queryParams += `&withMetadata=${options.withMetadata}`;
      if (options.limit) queryParams += `&limit=${options.limit}`;
      
      // Build URL
      const url = this.getAlchemyUrl(chain, 'getNFTsForCollection', queryParams);
      console.log(`Fetching collection NFTs from: ${url}`);
      
      // Make request
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch collection NFTs: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Store in cache
      this.requestCache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });
      
      return data;
    } catch (error) {
      console.error(`Error fetching NFTs for collection ${contractAddress} on ${chain}:`, error);
      return { nfts: [] };
    }
  }
  
  /**
   * Get wallet addresses that own NFTs from a specified contract
   * Updated to match the Alchemy NFT API v3 documentation
   * 
   * @param {string} contractAddress - The NFT contract address
   * @param {string} [network='eth'] - Blockchain network (eth, polygon, etc.)
   * @returns {Promise<string[]>} Array of wallet addresses
   */
  async getOwnersForContract(contractAddress, network = 'eth') {
    // Make sure API key is initialized
    await this.initApiKey();

    try {
      if (!contractAddress) {
        console.error('Contract address is missing or empty');
        throw new Error('Contract address is required');
      }
      
      // Create a cache key based on contract address and network
      const cacheKey = `owners_${contractAddress.toLowerCase()}_${network.toLowerCase()}`;
      
      // Check if we have a valid cached response
      const cachedResponse = await this.getCachedResponse(cacheKey);
      if (cachedResponse) {
        console.log(`Using cached owners for contract ${contractAddress} on ${network} (${cachedResponse.length} owners)`);
        return cachedResponse;
      }

      console.log(`Fetching owners for contract ${contractAddress} on ${network}`);
      console.log('DEBUG - getOwnersForContract call details:', {
        contractAddress,
        contractAddressType: typeof contractAddress,
        contractAddressLength: contractAddress?.length,
        network,
        alchemyEndpoint: ALCHEMY_ENDPOINT,
        serverUrl: SERVER_URL,
        timestamp: new Date().toISOString()
      });

      // Initialize endpoints if needed
      await initializeEndpoints();
      
      console.log(`After initialization, using ALCHEMY_ENDPOINT: ${ALCHEMY_ENDPOINT}`);

      let response;
      
      // First try with our proxy API
      try {
        // Build the API request params for our proxy
        const params = {
          endpoint: 'getOwnersForContract',
          contractAddress,
          network
        };
        
        console.log('Making proxy Alchemy API request with params:', params);

        // Make the API request with a longer timeout
        response = await axios.get(ALCHEMY_ENDPOINT, {
          params,
          timeout: 20000 // 20 seconds - increased from 15 seconds
        });
        
        console.log('Proxy API responded with status:', response.status);
      } catch (proxyError) {
        console.error(`❌ Proxy API failed for getOwnersForContract for ${contractAddress}:`, proxyError.message);
        
        // Try direct Alchemy API as a fallback
        try {
          console.log('Attempting direct Alchemy API call for getOwnersForContract');
          
          if (!this.apiKey) {
            console.error('Missing Alchemy API key for direct API call');
            throw new Error('Alchemy API key not available');
          }
          
          // Map the network to the appropriate endpoint prefix
          // Get the base API URL using our helper
          const baseUrl = await this.getAlchemyUrl(network, 'nft');
          
          // Build the direct API URL as per the docs
          const directUrl = `${baseUrl}/getOwnersForContract`;
          
          console.log(`Direct API call to Alchemy URL: ${directUrl}`);
          
          response = await axios.get(directUrl, {
            params: {
              contractAddress,
              withTokenBalances: false // Don't need token balances, just owners
            },
            timeout: 20000
          });
          
          console.log('Direct Alchemy API responded with status:', response.status);
          // Log full response structure for debugging
          console.log('Response structure from direct API:', {
            hasData: !!response.data,
            dataKeys: response.data ? Object.keys(response.data) : [],
            ownersCount: response.data?.owners?.length || 0
          });
        } catch (directApiError) {
          console.error('❌ Direct Alchemy API call failed:', directApiError.message);
          if (directApiError.response) {
            console.error('Error response data:', directApiError.response.data);
            console.error('Error response status:', directApiError.response.status);
          }
          throw directApiError;
        }
      }

      // Log full response for debugging
      console.log('Alchemy API response structure:', {
        status: response.status,
        hasData: !!response.data,
        dataKeys: response.data ? Object.keys(response.data) : [],
        hasOwners: Array.isArray(response.data?.owners),
        ownersCount: response.data?.owners?.length || 0
      });

      // Extract owners from the response according to the API documentation
      const owners = response.data?.owners || [];

      console.log(`Found ${owners.length} owners for contract ${contractAddress}`);
      
      if (owners.length > 0) {
        console.log('Sample of owner addresses:', owners.slice(0, 5));
      } else {
        console.warn(`No owners found for contract ${contractAddress}. This could be an issue with the contract address or API.`);
      }
      
      // Convert all addresses to lowercase for consistency
      const normalizedOwners = owners.map(owner => owner.toLowerCase());
      
      // Cache the results
      if (normalizedOwners.length > 0) {
        await this.setCachedResponse(cacheKey, normalizedOwners);
      }
      
      return normalizedOwners;
    } catch (error) {
      // Enhanced error logging with network-specific information
      console.error(`Error fetching owners for contract ${contractAddress} on ${network}:`, error.message);
      console.error('Error details:', {
        network,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data || error.message,
        stack: error.stack?.substring(0, 200)
      });
      
      // Network-specific error handling
      if (network === 'base') {
        console.warn(`Base network may be experiencing issues. Returning empty result for ${contractAddress}.`);
        // For Base network specifically, log more diagnostics but don't break the app
        if (error.code === 'ECONNABORTED') {
          console.warn('Request to Base network timed out. This is a common issue that will be handled gracefully.');
        }
      }
      
      // Check for specific error types to provide better diagnostics
      if (error.code === 'ECONNREFUSED') {
        console.error('Connection refused. API server might be down or unreachable.');
      } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
        console.error('Request timed out. API server might be overloaded or unreachable.');
      } else if (error.response?.status === 404) {
        console.error('API endpoint not found. Check the API URL configuration.');
      } else if (error.response?.status === 401 || error.response?.status === 403) {
        console.error('Authentication error. Check API key.');
      } else if (error.response?.status === 500) {
        console.error('Server error. The API server encountered an error processing the request.');
      }
      
      // Always return an empty array instead of failing completely
      return [];
    }
  }
  
  /**
   * Gets metadata for a specific contract
   * @param {string} contractAddress - The contract address
   * @param {string} chain - The blockchain network
   * @returns {Promise<Object>} - The contract metadata
   */
  async getContractMetadata(contractAddress, chain = 'eth') {
    try {
      // Create a cache key based on contract address and chain
      const cacheKey = `contract_metadata_${contractAddress.toLowerCase()}_${chain}`;
      
      // Check if we have a valid cached response
      const cachedResponse = this.requestCache.get(cacheKey);
      if (cachedResponse && cachedResponse.timestamp > Date.now() - this.cacheTTL) {
        console.log(`Using cached contract metadata for ${contractAddress} on ${chain}`);
        return cachedResponse.data;
      }
      
      // Build query parameters
      const queryParams = `contractAddress=${contractAddress}`;
      
      // Build URL
      const url = this.getAlchemyUrl(chain, 'getContractMetadata', queryParams);
      console.log(`Fetching contract metadata from: ${url}`);
      
      // Make request
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch contract metadata: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Store in cache
      this.requestCache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });
      
      return data;
    } catch (error) {
      console.error(`Error fetching contract metadata for ${contractAddress} on ${chain}:`, error);
      return {};
    }
  }

  /**
   * Gets all NFTs for a contract address
   * @param {string} contractAddress - The contract address to get NFTs for
   * @param {object} options - Additional options for the API call
   * @param {string} chainId - The chain ID, e.g. 'eth', 'polygon', etc.
   * @returns {Promise<{ nfts: Array, pageKey: string }>} - The NFTs and a page key for pagination
   */
  async getNftsForContract(contractAddress, options = {}, chainId = 'eth') {
    try {
      // Create a cache key based on contract address, chain ID and options
      const serializedOptions = JSON.stringify(options);
      const cacheKey = `contract_nfts_${contractAddress.toLowerCase()}_${chainId.toLowerCase()}_${serializedOptions}`;
      
      // Check if we have a valid cached response
      const cachedResponse = this.requestCache.get(cacheKey);
      if (cachedResponse && cachedResponse.timestamp > Date.now() - this.cacheTTL) {
        console.log(`Using cached NFTs for contract ${contractAddress} on ${chainId}`);
        return cachedResponse.data;
      }
      
      const baseUrl = await this.getAlchemyUrl(chainId);
      let url = `${baseUrl}/getNFTsForContract?contractAddress=${contractAddress}`;
      
      // Add optional parameters
      if (options.pageKey) url += `&pageKey=${options.pageKey}`;
      if (options.pageSize) url += `&pageSize=${options.pageSize}`;
      if (options.withMetadata !== undefined) url += `&withMetadata=${options.withMetadata}`;
      
      console.log(`Fetching NFTs for contract ${contractAddress} on ${chainId} with URL: ${url}`);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch NFTs for contract ${contractAddress} on ${chainId}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      // Store in cache
      this.requestCache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });
      
      return data;
    } catch (error) {
      console.error(`Error fetching NFTs for contract ${contractAddress} on ${chainId}:`, error);
      return { nfts: [], pageKey: '' };
    }
  }

  /**
   * Simplified method to fetch NFTs for Farcaster users
   * Uses the well-tested getNftsForOwner method for each combination
   * @param {string[]} addresses - Array of wallet addresses
   * @param {object} options - Options for the API request
   * @returns {Promise<Object>} - Object containing NFTs and other metadata
   */
  async fetchNftsForFarcaster(addresses, options = {}) {
    try {
      // Filter valid addresses
      const validAddresses = (addresses || [])
        .filter(address => address && typeof address === 'string' && address.trim() !== '')
        .map(address => address.toLowerCase().trim());
      
      if (validAddresses.length === 0) {
        console.log('No valid addresses provided');
        return { nfts: [], errors: ['No valid addresses provided'] };
      }
      
      console.log(`Fetching NFTs for ${validAddresses.length} wallet addresses using direct method`);
      
      // Determine chains to fetch from
      const chainsToFetch = options.chains || ['eth', 'polygon', 'opt', 'arb', 'base'];
      console.log(`Fetching from chains: ${chainsToFetch.join(', ')}`);
      
      // Set up fetch options - simplify to only what Alchemy API supports
      const fetchOptions = {
        withMetadata: true,
        pageSize: options.pageSize || '100'
      };
      
      // Only add excludeSpam if needed - this is the only valid filter
      if (options.excludeSpam) {
        fetchOptions.excludeSpam = true;
      }
      
      const allNfts = [];
      const walletNftCounts = {};
      const errors = [];
      
      // Initialize wallet NFT counts
      validAddresses.forEach(addr => {
        walletNftCounts[addr] = 0;
      });
      
      // For each address and chain combination, fetch NFTs
      for (const address of validAddresses) {
        for (const chain of chainsToFetch) {
          try {
            console.log(`Fetching NFTs for ${address} on ${chain}`);
            const result = await this.getNftsForOwner(address, fetchOptions, chain);
            
            if (result.error) {
              console.error(`Error fetching NFTs for ${address} on ${chain}: ${result.error}`);
              errors.push(`${chain}: ${result.error}`);
              continue;
            }
            
            if (result.ownedNfts && Array.isArray(result.ownedNfts)) {
              // Add wallet and chain info to each NFT
              const nftsWithInfo = result.ownedNfts.map(nft => ({
                ...nft,
                chain: chain,
                chainId: chain,
                network: chain,
                ownerAddress: address
              }));
              
              // Track count for this wallet
              walletNftCounts[address] += nftsWithInfo.length;
              
              // Add to the combined list
              allNfts.push(...nftsWithInfo);
            }
          } catch (error) {
            console.error(`Error fetching NFTs for ${address} on ${chain}:`, error);
            errors.push(`${chain}: ${error.message}`);
          }
        }
      }
      
      // Log counts per wallet
      Object.entries(walletNftCounts).forEach(([wallet, count]) => {
        if (count > 0) {
          console.log(`Found ${count} NFTs for wallet ${wallet}`);
        }
      });
      
      // De-duplicate NFTs using a Map
      const uniqueNftsMap = new Map();
      
      allNfts.forEach(nft => {
        try {
          // Create a unique ID for deduplication
          const contractAddress = (nft.contract?.address || '').toLowerCase();
          const tokenId = String(nft.tokenId || '').trim();
          const chain = (nft.chain || 'eth').toLowerCase();
          
          // Skip NFTs without proper ID information
          if (!contractAddress || !tokenId) return;
          
          const uniqueId = `${chain}:${contractAddress}:${tokenId}`;
          
          if (!uniqueNftsMap.has(uniqueId)) {
            // Add uniqueId to the NFT object
            uniqueNftsMap.set(uniqueId, {
              ...nft,
              uniqueId
            });
          }
        } catch (err) {
          console.error('Error processing NFT:', err);
        }
      });
      
      // Convert the unique NFTs map to an array
      const uniqueNfts = Array.from(uniqueNftsMap.values());
      console.log(`Found ${uniqueNfts.length} unique NFTs across all wallets`);
      
      return {
        nfts: uniqueNfts,
        totalFound: uniqueNfts.length,
        walletNftCounts,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      console.error('Error in fetchNftsForFarcaster:', error);
      return { nfts: [], error: error.message };
    }
  }
}

// Create an instance of the AlchemyService class
const alchemyService = new AlchemyService();

// Export convenience functions
export const fetchNftsForOwner = (address, options) => 
  alchemyService.getNftsForOwner(address, options);

export const fetchNftsAcrossChains = (address, options) =>
  alchemyService.fetchNftsAcrossChains(address, options);

export const fetchNftsForAddresses = (addresses, options) =>
  alchemyService.fetchNftsForMultipleAddresses(addresses, options);

export const createConsistentUniqueId = (nft) =>
  alchemyService.createConsistentUniqueId(nft);

export const fetchAssetTransfers = (addresses, options) =>
  alchemyService.getAssetTransfers(addresses, options);

export const fetchNftsSimple = (addresses, options) =>
  alchemyService.fetchNftsSimple(addresses, options);

export const fetchNftsForFarcaster = (addresses, options) =>
  alchemyService.fetchNftsForFarcaster(addresses, options);
  
export default alchemyService;