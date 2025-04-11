const axios = require('axios');
const { corsHeaders, cache } = require('./_utils');

/**
 * API handler for proxying NFT images to avoid CORS issues
 */
const handler = async (req, res) => {
  // Set CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Extract parameters from path
    // Expected format: /api/nft-image/:network/:contractAddress/:tokenId
    const pathParts = req.url.split('/').filter(Boolean);
    
    // Remove 'api' and 'nft-image' from the path
    const relevantParts = pathParts.slice(pathParts.indexOf('nft-image') + 1);
    
    if (relevantParts.length < 3) {
      return res.status(400).json({ 
        error: 'Invalid request format', 
        message: 'Required format: /api/nft-image/:network/:contractAddress/:tokenId' 
      });
    }

    const [network, contractAddress, tokenId] = relevantParts;

    // Check for required parameters
    if (!network || !contractAddress || !tokenId) {
      return res.status(400).json({ 
        error: 'Missing parameters', 
        message: 'Network, contract address, and token ID are required' 
      });
    }

    // Generate cache key
    const cacheKey = `nft_image_${network}_${contractAddress}_${tokenId}`;
    const cachedData = cache.get(cacheKey);
    
    if (cachedData) {
      console.log('Cache hit for NFT image');
      res.setHeader('Content-Type', cachedData.contentType);
      return res.send(cachedData.data);
    }

    // Try to get the image URL from Alchemy
    const apiKeys = {
      ethereum: process.env.ALCHEMY_ETH_API_KEY,
      optimism: process.env.ALCHEMY_OPTIMISM_API_KEY,
      arbitrum: process.env.ALCHEMY_ARBITRUM_API_KEY,
      polygon: process.env.ALCHEMY_POLYGON_API_KEY,
      base: process.env.ALCHEMY_BASE_API_KEY
    };

    // Base URLs for Alchemy NFT API by network
    const baseUrls = {
      ethereum: 'https://eth-mainnet.g.alchemy.com/nft/v2/',
      optimism: 'https://opt-mainnet.g.alchemy.com/nft/v2/',
      arbitrum: 'https://arb-mainnet.g.alchemy.com/nft/v2/',
      polygon: 'https://polygon-mainnet.g.alchemy.com/nft/v2/',
      base: 'https://base-mainnet.g.alchemy.com/nft/v2/'
    };

    const apiKey = apiKeys[network.toLowerCase()] || apiKeys.ethereum;
    const baseUrl = baseUrls[network.toLowerCase()] || baseUrls.ethereum;

    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured for this network' });
    }

    // Query Alchemy API to get the NFT metadata
    const alchemyUrl = `${baseUrl}${apiKey}/getNFTMetadata?contractAddress=${contractAddress}&tokenId=${tokenId}`;
    
    const alchemyResponse = await axios.get(alchemyUrl);
    
    // Extract image URL from the response
    let imageUrl = null;
    
    if (alchemyResponse.data.media && alchemyResponse.data.media.length > 0) {
      // Prefer gateway URL (Alchemy-processed) when available
      imageUrl = alchemyResponse.data.media[0].gateway || alchemyResponse.data.media[0].raw;
    }
    
    // Fallback to metadata image
    if (!imageUrl && alchemyResponse.data.metadata && alchemyResponse.data.metadata.image) {
      imageUrl = alchemyResponse.data.metadata.image;
      
      // Fix IPFS URLs
      if (imageUrl.startsWith('ipfs://')) {
        imageUrl = imageUrl.replace('ipfs://', 'https://ipfs.io/ipfs/');
      }
    }
    
    if (!imageUrl) {
      return res.status(404).json({ error: 'Image not found' });
    }
    
    // Fetch the actual image
    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const contentType = imageResponse.headers['content-type'];
    
    // Cache the image data
    cache.set(cacheKey, {
      data: imageResponse.data,
      contentType: contentType || 'image/png'
    }, 86400); // Cache for 24 hours
    
    // Send the image
    res.setHeader('Content-Type', contentType || 'image/png');
    return res.send(imageResponse.data);
  } catch (error) {
    console.error('Error proxying NFT image:', error.message);
    return res.status(500).json({
      error: 'Image proxy error',
      message: error.message
    });
  }
};

module.exports = handler; 