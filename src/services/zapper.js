import axios from 'axios';

// Use server proxy instead of direct API calls
const API_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:3001/api/zapper'
  : '/api/zapper';

// Cache for GraphQL responses
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const fetchZapperData = async (query, variables) => {
  const cacheKey = JSON.stringify({ query, variables });
  const cachedData = cache.get(cacheKey);

  if (cachedData && Date.now() - cachedData.timestamp < CACHE_TTL) {
    console.log('Using cached Zapper data');
    return cachedData.data;
  }

  try {
    console.log('Sending GraphQL request to', API_URL);
    
    const response = await axios({
      url: API_URL,
      method: 'post',
      headers: {
        'Content-Type': 'application/json'
      },
      data: {
        query,
        variables
      },
      timeout: 15000 // 15 second timeout for slow API responses
    });

    // Check for different types of API errors
    if (response.data.errors) {
      const errorMessages = response.data.errors.map(err => err.message).join('; ');
      console.error('GraphQL Errors:', errorMessages);
      throw new Error(`GraphQL Errors: ${errorMessages}`);
    }

    // Process and format the NFT data to ensure all images are properly referenced
    const processedData = processImageUrls(response.data.data);

    // Cache the successful response
    cache.set(cacheKey, {
      data: processedData,
      timestamp: Date.now()
    });

    return processedData;
  } catch (error) {
    console.error('Error fetching from Zapper API:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    throw error;
  }
};

// Process all image URLs in the response to ensure they're valid
const processImageUrls = (data) => {
  if (!data) return data;
  
  // Deep clone to avoid modifying original
  const processed = JSON.parse(JSON.stringify(data));
  
  // Process NFT data in different response formats
  if (processed.nftUsersTokens) {
    // Format used by the Zapper API
    if (processed.nftUsersTokens.edges) {
      processed.nftUsersTokens.edges.forEach(edge => {
        if (edge.node) {
          processNftNode(edge.node);
        }
      });
    }
  }
  
  // Process portfolioV2 format
  if (processed.portfolioV2 && processed.portfolioV2.nftBalances) {
    if (processed.portfolioV2.nftBalances.nfts) {
      processed.portfolioV2.nftBalances.nfts.forEach(nft => {
        processNftNode(nft);
      });
    }
  }
  
  // Process nfts array format
  if (processed.nfts && Array.isArray(processed.nfts.items)) {
    processed.nfts.items.forEach(nft => {
      processNftNode(nft);
    });
  }
  
  return processed;
};

// Process a single NFT node's image URLs
const processNftNode = (nft) => {
  if (!nft) return;
  
  // Process imageUrl if exists
  if (nft.imageUrl) {
    nft.imageUrl = ensureValidImageUrl(nft.imageUrl);
  }
  
  // Process collection imageUrl if exists
  if (nft.collection && nft.collection.imageUrl) {
    nft.collection.imageUrl = ensureValidImageUrl(nft.collection.imageUrl);
  }
  
  // Process metadata image if exists
  if (nft.metadata && nft.metadata.image) {
    nft.metadata.image = ensureValidImageUrl(nft.metadata.image);
  }
  
  // Process mediasV2 array if exists
  if (nft.mediasV2 && Array.isArray(nft.mediasV2)) {
    nft.mediasV2.forEach(media => {
      if (!media) return;
      
      if (media.original) {
        media.original = ensureValidImageUrl(media.original);
      }
      
      if (media.originalUri) {
        media.originalUri = ensureValidImageUrl(media.originalUri);
      }
      
      if (media.url) {
        media.url = ensureValidImageUrl(media.url);
      }
    });
  }
};

// Ensure a valid image URL that can be displayed
const ensureValidImageUrl = (url) => {
  if (!url) return null;
  
  // Handle IPFS URLs
  if (url.startsWith('ipfs://')) {
    return url.replace('ipfs://', 'https://ipfs.io/ipfs/');
  }
  
  // Handle Arweave URLs
  if (url.startsWith('ar://')) {
    return url.replace('ar://', 'https://arweave.net/');
  }
  
  // Handle URLs missing protocol
  if (url.startsWith('//')) {
    return `https:${url}`;
  }
  
  // Ensure URL has protocol
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`;
  }
  
  return url;
};

// Helper function to validate Ethereum addresses
export const isValidAddress = (address) => {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
};

// Helper function to implement exponential backoff
export const fetchWithRetry = async (query, variables, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fetchZapperData(query, variables);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}; 