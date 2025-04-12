import axios from 'axios';

// Server base URL - Use relative URL for deployed app and absolute for development
const SERVER_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:3001' 
  : '';

// Get Alchemy API keys from environment variables
const ALCHEMY_ETH_API_KEY = process.env.REACT_APP_ALCHEMY_ETH_API_KEY;
const ALCHEMY_BASE_API_KEY = process.env.REACT_APP_ALCHEMY_BASE_API_KEY;

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
      // Guard against invalid inputs
      if (!contractAddress || !tokenId) {
        console.warn('Missing contract address or token ID for Alchemy API call');
        return null;
      }
      
      // Define network-specific API keys and base URLs
      const networkConfigs = {
        ethereum: {
          apiKey: process.env.REACT_APP_ALCHEMY_ETH_API_KEY || process.env.ALCHEMY_ETH_API_KEY,
          baseUrl: 'https://eth-mainnet.g.alchemy.com/nft/v2/'
        },
        polygon: {
          apiKey: process.env.REACT_APP_ALCHEMY_POLYGON_API_KEY || process.env.ALCHEMY_POLYGON_API_KEY,
          baseUrl: 'https://polygon-mainnet.g.alchemy.com/nft/v2/'
        },
        optimism: {
          apiKey: process.env.REACT_APP_ALCHEMY_OPTIMISM_API_KEY || process.env.ALCHEMY_OPTIMISM_API_KEY,
          baseUrl: 'https://opt-mainnet.g.alchemy.com/nft/v2/'
        },
        arbitrum: {
          apiKey: process.env.REACT_APP_ALCHEMY_ARBITRUM_API_KEY || process.env.ALCHEMY_ARBITRUM_API_KEY,
          baseUrl: 'https://arb-mainnet.g.alchemy.com/nft/v2/'
        },
        base: {
          apiKey: process.env.REACT_APP_ALCHEMY_BASE_API_KEY || process.env.ALCHEMY_BASE_API_KEY,
          baseUrl: 'https://base-mainnet.g.alchemy.com/nft/v2/'
        }
      };
      
      // Default to Ethereum if network not supported
      const networkKey = network.toLowerCase();
      const config = networkConfigs[networkKey] || networkConfigs.ethereum;
      
      // Check if we have an API key for this network
      if (!config.apiKey) {
        console.warn(`No Alchemy API key found for network: ${network}`);
        return null;
      }
      
      // Construct the API URL
      const url = `${config.baseUrl}${config.apiKey}/getNFTMetadata?contractAddress=${contractAddress}&tokenId=${tokenId}&refreshCache=false`;
      
      console.log(`Fetching NFT image from Alchemy for ${contractAddress}:${tokenId} on ${network}`);
      
      // Make the API request
      const response = await fetch(url);
      
      if (!response.ok) {
        console.warn(`Alchemy API error (${response.status}): ${response.statusText}`);
        return null;
      }
      
      const data = await response.json();
      
      // Extract the image URL with fallback options
      let imageUrl = null;
      
      // Try different image sources in order of preference
      if (data.media && Array.isArray(data.media)) {
        // Look for high-res images first
        const highResImage = data.media.find(m => 
          m.gateway && 
          m.gateway.includes('https') && 
          !m.gateway.includes('placeholder'));
          
        if (highResImage?.gateway) {
          imageUrl = highResImage.gateway;
        }
        // If no high-res, try raw URLs
        else if (data.media[0]?.raw) {
          imageUrl = data.media[0].raw;
        }
        // Last resort, try any gateway
        else if (data.media[0]?.gateway) {
          imageUrl = data.media[0].gateway;
        }
      }
      
      // If still no image, try the top-level image field
      if (!imageUrl && data.metadata && data.metadata.image) {
        imageUrl = this.processImageUrl(data.metadata.image);
      }
      
      // Final fallback to tokenUri thumbnail
      if (!imageUrl && data.tokenUri && data.tokenUri.gateway) {
        imageUrl = data.tokenUri.gateway;
      }
      
      return imageUrl;
    } catch (error) {
      console.error('Error fetching NFT image from Alchemy:', error.message);
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
    try {
      if (!usernameOrFid) {
        throw new Error('Username or FID is required');
      }
      
      // Clean up username input
      const cleanUsername = usernameOrFid.trim().replace('@', '');
      
      console.log(`Fetching Farcaster profile for ${cleanUsername}`);
      
      // Use the official Zapper GraphQL API
      const zapperQuery = `
        query FarcasterProfile($username: String, $fid: Int) {
          farcasterProfile(username: $username, fid: $fid) {
            username
            fid
            metadata {
              displayName
              description
              imageUrl
              warpcast
            }
            custodyAddress
            connectedAddresses
          }
        }
      `;
      
      const isUsername = isNaN(parseInt(cleanUsername));
      const variables = isUsername 
        ? { username: cleanUsername }
        : { fid: parseInt(cleanUsername) };
      
      console.log(`Sending query with variables:`, JSON.stringify(variables));
      
      // Use our abstracted method which has better error handling
      const data = await this.makeGraphQLRequest(zapperQuery, variables);
      
      if (!data?.farcasterProfile) {
        console.warn(`No Farcaster profile found for ${cleanUsername}`);
        throw new Error(`Could not find Farcaster profile for ${cleanUsername}`);
      }
      
      console.log(`Found Farcaster user: ${data.farcasterProfile.username} (FID: ${data.farcasterProfile.fid})`);
      console.log(`Found ${data.farcasterProfile.connectedAddresses?.length || 0} connected addresses`);
      
      // Get the best avatar URL
      let avatarUrl = data.farcasterProfile.metadata?.imageUrl || '';
      
      // Log the original avatar URL for debugging
      console.log(`Original avatar URL: ${avatarUrl}`);
      
      // If it's a Warpcast URL, make sure it doesn't have a small size parameter
      if (avatarUrl && avatarUrl.includes('warpcast.com') && avatarUrl.includes('size=')) {
        // Remove size parameter to get full-size image
        avatarUrl = avatarUrl.replace(/([?&])size=\d+/, '$1size=600');
        console.log(`Updated avatar URL: ${avatarUrl}`);
      }
      
      // Return profile with normalized field names
      return {
        fid: data.farcasterProfile.fid,
        username: data.farcasterProfile.username,
        displayName: data.farcasterProfile.metadata?.displayName || '',
        description: data.farcasterProfile.metadata?.description || '',
        avatarUrl: avatarUrl,
        warpcastUrl: data.farcasterProfile.metadata?.warpcast?.url || '',
        custodyAddress: data.farcasterProfile.custodyAddress,
        connectedAddresses: data.farcasterProfile.connectedAddresses || []
      };
    } catch (error) {
      console.error('Error fetching Farcaster profile:', error);
      throw new Error(`Failed to find Farcaster profile: ${error.message}`);
    }
  },

  /**
   * Get NFTs for a list of addresses using the Zapper GraphQL API
   */
  async getNftsForAddresses(addresses, options = {}) {
    try {
      if (!addresses || addresses.length === 0) {
        console.warn('No addresses provided to getNftsForAddresses');
        return { nfts: [], hasMore: false, cursor: null };
      }
      
      // Filter out invalid addresses
      addresses = addresses.filter(addr => addr && typeof addr === 'string' && addr.startsWith('0x'));
      
      if (addresses.length === 0) {
        console.warn('No valid addresses remaining after filtering');
        return { nfts: [], hasMore: false, cursor: null };
      }
      
      console.log(`Fetching NFTs for ${addresses.length} addresses:`, addresses);
      
      // Updated query to match the current Zapper API schema
      const zapperQuery = `
        query NftUsersTokens($owners: [Address!]!, $first: Int, $after: String, $withOverrides: Boolean) {
          nftUsersTokens(
            owners: $owners
            first: $first
            after: $after
            withOverrides: $withOverrides
          ) {
            edges {
              node {
                id
                tokenId
                name
                description
                collection {
                  name
                  address
                  network
                  nftStandard
                  type
                  supply
                  holdersCount
                  floorPrice {
                    valueUsd
                    valueWithDenomination
                    denomination {
                      symbol
                      network
                      address
                    }
                  }
                  medias {
                    logo {
                      thumbnail
                    }
                  }
                }
                mediasV3 {
                  images(first: 3) {
                    edges {
                      node {
                        original
                        thumbnail
                        blurhash
                        large
                        width
                        height
                        mimeType
                        fileSize
                      }
                    }
                  }
                  animations(first: 1) {
                    edges {
                      node {
                        original
                        mimeType
                      }
                    }
                  }
                }
                estimatedValue {
                  valueUsd
                  valueWithDenomination
                  denomination {
                    symbol
                    network
                  }
                }
                lastSale {
                  valueUsd
                  valueWithDenomination
                  denomination {
                    symbol
                  }
                  timestamp
                }
                traits {
                  attributeName
                  attributeValue
                  supplyPercentage
                  supply
                }
              }
              cursor
              balance
              balanceUSD
              ownedAt
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
        first: options.limit || 100,
        after: options.cursor || null,
        withOverrides: true
      };
      
      // Add a retry mechanism
      let retries = 0;
      const maxRetries = 3;
      let lastError = null;
      
      while (retries < maxRetries) {
        try {
          console.log(`Attempt ${retries + 1} to fetch NFTs`);
          const data = await this.makeGraphQLRequest(zapperQuery, variables);
          
          if (!data || !data.nftUsersTokens || !data.nftUsersTokens.edges) {
            console.warn('Unexpected response format from Zapper API:', data);
            retries++;
            await new Promise(resolve => setTimeout(resolve, 1000 * retries)); // Exponential backoff
            continue;
          }
          
          // Extract pagination info
          const pageInfo = data.nftUsersTokens.pageInfo || {};
          const hasMore = pageInfo.hasNextPage === true;
          const nextCursor = pageInfo.endCursor || null;

          console.log(`Pagination info: hasMore=${hasMore}, nextCursor=${nextCursor || 'none'}`);
          
          // Process and enhance the NFT data
          const nfts = data.nftUsersTokens.edges.map(edge => {
            const node = edge.node;
            if (!node) return null;
            
            // Create a normalized NFT object that combines data from all possible sources
            return {
              id: node.id,
              tokenId: node.tokenId,
              name: node.name || `#${node.tokenId}`,
              description: node.description,
              // Store value data - prioritize estimatedValue
              valueEth: node.estimatedValue?.valueWithDenomination || node.collection?.floorPrice?.valueWithDenomination || 0,
              // Handle images
              imageUrl: this.getBestImageUrlV3(node),
              // Track cursor for pagination
              cursor: edge.cursor,
              balance: edge.balance,
              balanceUSD: edge.balanceUSD,
              // Store lastSale for sorting
              lastSale: node.lastSale,
              // Store collection data
              collection: {
                id: node.collection?.id,
                name: node.collection?.name || 'Unknown Collection',
                address: node.collection?.address,
                network: node.collection?.network,
                imageUrl: node.collection?.medias?.logo?.thumbnail,
                floorPriceEth: node.collection?.floorPrice?.valueWithDenomination
              },
              // Store traits for display
              traits: node.traits || []
            };
          }).filter(Boolean);
          
          console.log(`Successfully fetched ${nfts.length} NFTs`);
          
          // Filter out NFTs with missing data
          const validNfts = nfts.filter(nft => nft.id);
          console.log(`${validNfts.length} NFTs have valid IDs`);
          
          // Return the NFTs along with pagination data
          return { 
            nfts: validNfts, 
            hasMore: hasMore,
            cursor: nextCursor
          };
        } catch (error) {
          console.error(`Attempt ${retries + 1} failed:`, error.message);
          lastError = error;
          retries++;
          
          if (retries < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * retries));
          }
        }
      }
      
      // If we've exhausted all retries, throw the last error
      if (lastError) {
        throw lastError;
      }
      
      return { nfts: [], hasMore: false, cursor: null };
    } catch (error) {
      console.error('Error fetching NFTs from Zapper:', error.message);
      
      // Return a more friendly error message
      throw new Error(`Failed to load NFTs: ${error.message}. Please try again later.`);
    }
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
    // Use the nftUsersCollections query which is still supported
    const query = `
      query NftUsersCollections($owners: [Address!]!, $first: Int, $withOverrides: Boolean) {
        nftUsersCollections(
          owners: $owners
          first: $first
          withOverrides: $withOverrides
        ) {
          edges {
            node {
              id
              name
              floorPriceEth
              tokenCount
              cardImageUrl
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
      first: options.first || 50,
      withOverrides: true
    };

    try {
      const data = await this.makeGraphQLRequest(query, variables);
      
      if (!data || !data.nftUsersCollections || !data.nftUsersCollections.edges) {
        console.warn('Unexpected response format from Zapper API for NFT collections:', data);
        return { collections: [], pageInfo: { hasNextPage: false, endCursor: null } };
      }
      
      // Map and clean the collection data
      const collections = data.nftUsersCollections.edges
        .map(edge => {
          const collection = edge.node;
          if (!collection) return null;
          
          return {
            id: collection.id,
            name: collection.name || 'Unknown Collection',
            floorPriceEth: collection.floorPriceEth,
            tokenCount: collection.tokenCount || 0,
            imageUrl: collection.cardImageUrl
          };
        })
        .filter(collection => collection !== null);
      
      return {
        collections,
        pageInfo: data.nftUsersCollections.pageInfo || { hasNextPage: false, endCursor: null }
      };
    } catch (error) {
      console.error('Error fetching NFT collections:', error.message);
      throw error;
    }
  },

  /**
   * Get NFTs for a specific address
   */
  async getNFTsForUser(addresses, options = {}) {
    const query = `
      query GetNFTsForUser($owners: [Address!]!, $first: Int, $withOverrides: Boolean) {
        nftUsersTokens(
          owners: $owners
          first: $first
          withOverrides: $withOverrides
        ) {
          edges {
            node {
              id
              tokenId
              name
              description
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
      first: options.first || 100,
      withOverrides: true
    };

    try {
      const data = await this.makeGraphQLRequest(query, variables);
      
      if (!data || !data.nftUsersTokens || !data.nftUsersTokens.edges) {
        console.warn('Unexpected response format from Zapper API for getNFTsForUser:', data);
        return [];
      }
      
      // Transform the response to match our NftCard component expectations
      return data.nftUsersTokens.edges.map(edge => {
        const node = edge.node;
        if (!node) return null;
        
        // Get the best image URL available
        let imageUrl = null;
        if (node.mediasV2 && node.mediasV2.length > 0) {
          imageUrl = node.mediasV2[0].url || node.mediasV2[0].original || node.mediasV2[0].originalUri;
        }
        
        return {
          id: node.id,
          name: node.name || `#${node.tokenId}`,
          token_id: node.tokenId,
          description: node.description,
          imageUrl: imageUrl || node.collection?.cardImageUrl,
          collection: {
            name: node.collection?.name || 'Unknown Collection',
            id: node.collection?.id,
            imageUrl: node.collection?.cardImageUrl,
            floorPriceEth: node.collection?.floorPriceEth
          }
        };
      }).filter(Boolean);
    } catch (error) {
      console.error('Error fetching NFTs:', error);
      throw error;
    }
  },
};

export default zapperService; 