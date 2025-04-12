import axios from 'axios';

// Server base URL - Use relative URL for deployed app and absolute for development
const SERVER_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:3001' 
  : '';

// Get Alchemy API keys from environment variables
const ALCHEMY_ETH_API_KEY = process.env.REACT_APP_ALCHEMY_ETH_API_KEY;
const ALCHEMY_BASE_API_KEY = process.env.REACT_APP_ALCHEMY_BASE_API_KEY;

// API endpoints and keys
const ZAPPER_API_URL = 'https://api.zapper.xyz/v2';
const ALCHEMY_API_KEY = process.env.REACT_APP_ALCHEMY_API_KEY || '';
const ZAPPER_API_KEY = process.env.REACT_APP_ZAPPER_API_KEY || '';

// Base headers for Zapper API requests
const baseHeaders = {
  'Content-Type': 'application/json',
  'X-API-KEY': ZAPPER_API_KEY,
};

// Network configurations for Alchemy API
const NETWORK_CONFIG = {
  ethereum: {
    apiUrl: 'https://eth-mainnet.g.alchemy.com/v2',
    chainId: 1,
  },
  polygon: {
    apiUrl: 'https://polygon-mainnet.g.alchemy.com/v2',
    chainId: 137,
  },
  // Add other supported networks as needed
};

/**
 * Service for interacting with the Zapper API and Alchemy API for NFT data
 */
const zapperService = {
  /**
   * Make a GraphQL request to the Zapper API via our server proxy
   */
  async makeGraphQLRequest(query, variables) {
    try {
      console.log(`Sending GraphQL request to ${SERVER_URL}/api/zapper`);
      
      // Use fetch API instead of axios for better compatibility with mobile browsers
      const response = await fetch(`${SERVER_URL}/api/zapper`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables,
        }),
        // No explicit timeout - rely on browser's default
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API error (${response.status}): ${errorText}`);
        
        // Try to parse error message to provide better feedback
        let parsedError;
        try {
          parsedError = JSON.parse(errorText);
        } catch (e) {
          // If parsing fails, use the original error text
        }
        
        if (parsedError?.helpfulMessage) {
          throw new Error(`API Error: ${parsedError.helpfulMessage}`);
        } else if (parsedError?.error) {
          throw new Error(`API Error (${response.status}): ${parsedError.error} - ${parsedError.message || 'Unknown error'}`);
        } else {
          throw new Error(`API request failed with status ${response.status}`);
        }
      }

      const responseData = await response.json();

      if (responseData.errors) {
        console.error('GraphQL response contains errors:', responseData.errors);
        
        // Extract error messages for better user feedback
        const errorMessages = responseData.errors.map(err => err.message).join('; ');
        throw new Error(`GraphQL Errors: ${errorMessages}`);
      }

      return responseData.data;
    } catch (error) {
      console.error('Error making Zapper GraphQL request:', error.message);
      
      // Simplified error handling for better error messages on mobile
      if (error.message.includes('Failed to fetch') || error.message.includes('Network request failed')) {
        throw new Error('Network error. Please check your internet connection and try again.');
      }
      
      if (error.message.includes('timeout') || error.message.includes('Timeout')) {
        throw new Error('Request timed out. The server might be busy, please try again.');
      }
      
      // Rethrow with clearer message
      throw new Error(`Failed to load data: ${error.message}`);
    }
  },

  /**
   * Get NFT image from Alchemy API as fallback
   */
  async getAlchemyNFTImage(contractAddress, tokenId, network = 'ethereum') {
    try {
      const networkConfig = NETWORK_CONFIG[network];
      
      if (!networkConfig) {
        throw new Error(`Unsupported network: ${network}`);
      }
      
      if (!ALCHEMY_API_KEY) {
        throw new Error('Alchemy API key is not configured');
      }
      
      const url = `${networkConfig.apiUrl}/${ALCHEMY_API_KEY}/getNFTMetadata`;
      const response = await fetch(url, {
        params: {
          contractAddress,
          tokenId,
          tokenType: 'ERC721'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.media && data.media.length > 0) {
          return data.media[0].gateway || data.media[0].raw;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get NFT image from Alchemy:', error);
      return null;
    }
  },
  
  /**
   * Process and fix IPFS image URLs
   */
  processImageUrl(url) {
    if (!url) return null;
    
    // Handle IPFS URLs
    if (url.startsWith('ipfs://')) {
      return url.replace('ipfs://', 'https://ipfs.io/ipfs/');
    }
    
    // Handle Arweave URLs
    if (url.startsWith('ar://')) {
      return url.replace('ar://', 'https://arweave.net/');
    }
    
    return url;
  },

  /**
   * Get Farcaster user profile by username or FID
   */
  async getFarcasterProfile(usernameOrFid) {
    const isNumeric = /^\d+$/.test(usernameOrFid.toString());
    
    const query = `
      query GetFarcasterUserProfile($${isNumeric ? 'fid' : 'username'}: ${isNumeric ? 'Int!' : 'String!'}) {
        farcasterUserProfile(${isNumeric ? 'fid' : 'username'}: $${isNumeric ? 'fid' : 'username'}) {
          fid
          username
          displayName
          pfp {
            url
          }
          followerCount
          followingCount
          bio
          verifications
        }
      }
    `;
    
    const variables = {
      [isNumeric ? 'fid' : 'username']: isNumeric ? parseInt(usernameOrFid) : usernameOrFid
    };
    
    try {
      const data = await this.makeGraphQLRequest(query, variables);
      return data.farcasterUserProfile;
    } catch (error) {
      console.error('Failed to get Farcaster profile:', error);
      throw error;
    }
  },

  /**
   * Get NFTs for a list of addresses using the Zapper GraphQL API
   */
  async getNftsForAddresses(addresses, options = {}) {
    const {
      limit = 100,
      cursor = null,
      prioritizeSpeed = true,
      retryCount = 2
    } = options;

    // GraphQL query for fetching NFTs with estimated values
    const query = `
      query NftUsersTokens($owners: [Address!]!, $first: Int, $after: String, $withOverrides: Boolean, $prioritizeSpeed: Boolean) {
        nftUsersTokens(
          owners: $owners
          first: $first
          after: $after
          withOverrides: $withOverrides
          prioritizeSpeed: $prioritizeSpeed
        ) {
          edges {
            node {
              id
              name
              tokenId
              description
              ownedAt
              acquiredAt
              mintPrice {
                value
                denomination {
                  symbol
                }
              }
              mediasV2 {
                ... on Image {
                  url
                  originalUri
                  original
                }
                ... on Animation {
                  url
                  originalUri
                  original
                }
              }
              collection {
                id
                name
                floorPriceEth
                cardImageUrl
                address
                network
                nftsCount
                holdersCount
              }
              estimatedValue {
                valueWithDenomination
                denomination {
                  symbol
                }
                value
              }
            }
            cursor
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    const variables = {
      owners: addresses,
      first: limit,
      after: cursor,
      withOverrides: true,
      prioritizeSpeed
    };

    let attempt = 0;
    let lastError = null;

    // Implement retry logic
    while (attempt <= retryCount) {
      try {
        const data = await this.makeGraphQLRequest(query, variables);
        const nftData = data?.nftUsersTokens;
        
        if (!nftData) {
          throw new Error('Invalid response format');
        }
        
        const nftEdges = nftData.edges || [];
        const pageInfo = nftData.pageInfo || {};
        
        // Process and transform NFT data
        const processedNfts = nftEdges.map(edge => {
          const node = edge.node;
          
          // Extract image URL from media
          let imageUrl = null;
          if (node.mediasV2 && node.mediasV2.length > 0) {
            const media = node.mediasV2[0];
            imageUrl = media.url || media.originalUri || media.original;
          }
          
          const network = node.collection?.network || 'ethereum';
          
          // Extract and process estimated value
          let estimatedValue = 0;
          let valueEth = '0';
          
          if (node.estimatedValue) {
            estimatedValue = Number(node.estimatedValue.value) || 0;
            valueEth = estimatedValue.toString();
          }
          
          // Return formatted NFT object
          return {
            id: node.id,
            name: node.name || `#${node.tokenId}`,
            tokenId: node.tokenId,
            description: node.description,
            imageUrl,
            collection: {
              id: node.collection?.id,
              name: node.collection?.name,
              floorPrice: node.collection?.floorPriceEth || 0,
              imageUrl: node.collection?.cardImageUrl,
              address: node.collection?.address,
              network,
              nftsCount: node.collection?.nftsCount,
              holdersCount: node.collection?.holdersCount
            },
            network,
            estimatedValue,
            valueEth,
            estimatedValueFormatted: node.estimatedValue?.valueWithDenomination || '0 ETH',
            ownedAt: node.ownedAt || node.acquiredAt,
            cursor: edge.cursor,
            mintPrice: node.mintPrice?.value ? {
              value: node.mintPrice.value,
              symbol: node.mintPrice.denomination?.symbol || 'ETH'
            } : null
          };
        });
        
        // Return results with pagination info
        return {
          nfts: processedNfts,
          cursor: pageInfo.endCursor || null,
          hasMore: pageInfo.hasNextPage || false
        };
      } catch (error) {
        console.error(`Attempt ${attempt + 1}/${retryCount + 1} failed:`, error);
        lastError = error;
        attempt++;
        
        // Wait before retrying (exponential backoff)
        if (attempt <= retryCount) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // All attempts failed
    throw lastError || new Error('Failed to fetch NFTs after multiple attempts');
  },
  
  // Helper to extract the best image URL from an NFT node using mediasV3
  getBestImageUrlV3(node) {
    if (!node) return 'https://via.placeholder.com/500?text=No+Image';
    
    // Try mediasV3 images first
    if (node.mediasV3?.images?.edges && node.mediasV3.images.edges.length > 0) {
      for (const edge of node.mediasV3.images.edges) {
        const image = edge.node;
        if (!image) continue;
        
        // Try various image sizes in order of preference
        if (image.large) return image.large;
        if (image.original) return image.original;
        if (image.thumbnail) return image.thumbnail;
      }
    }
    
    // Try mediasV3 animations if no images found
    if (node.mediasV3?.animations?.edges && node.mediasV3.animations.edges.length > 0) {
      for (const edge of node.mediasV3.animations.edges) {
        const animation = edge.node;
        if (!animation) continue;
        
        if (animation.original) return animation.original;
      }
    }
    
    // Fall back to collection image
    if (node.collection?.medias?.logo?.thumbnail) {
      return node.collection.medias.logo.thumbnail;
    }
    
    return 'https://via.placeholder.com/500?text=No+Image';
  },

  /**
   * Get NFT collections for a set of wallet addresses
   */
  async getNftCollectionsForAddresses(addresses, options = {}) {
    const query = `
      query NftCollections($addresses: [Address!]!) {
        nftCollections(addresses: $addresses) {
          id
          name
          floorPriceEth
          imageUrl
          address
          network
          nftsCount
          holdersCount
        }
      }
    `;

    const variables = {
      addresses
    };

    try {
      const data = await this.makeGraphQLRequest(query, variables);
      return data.nftCollections || [];
    } catch (error) {
      console.error('Failed to fetch NFT collections:', error);
      throw error;
    }
  },

  /**
   * Get NFTs for a specific address
   */
  async getNFTsForUser(addresses, options = {}) {
    return this.getNftsForAddresses(addresses, options);
  },
};

export default zapperService; 