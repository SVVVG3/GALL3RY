/**
 * Dedicated Alchemy API handler with improved configuration and error handling
 */

import axios from 'axios';

// Map network names to their Alchemy endpoints
const getAlchemyBaseUrl = (network = 'eth') => {
  const networkMap = {
    'eth': 'eth-mainnet',
    'ethereum': 'eth-mainnet',
    'polygon': 'polygon-mainnet',
    'arbitrum': 'arb-mainnet',
    'optimism': 'opt-mainnet',
    'base': 'base-mainnet',
    'zora': 'zora-mainnet',
    'sepolia': 'eth-sepolia',
  };

  const normalizedNetwork = network.toLowerCase();
  const chainId = networkMap[normalizedNetwork] || 'eth-mainnet';
  return `https://${chainId}.g.alchemy.com`;
};

// Helper to get API key with proper error handling
const getAlchemyApiKey = () => {
  const apiKey = process.env.ALCHEMY_API_KEY;
  if (!apiKey) {
    console.error('CRITICAL ERROR: Alchemy API key is missing from environment variables');
    throw new Error('Missing Alchemy API key');
  }
  return apiKey;
};

// The main API handler
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Get request parameters
  const { endpoint, chain = 'eth' } = req.query;
  
  if (!endpoint) {
    return res.status(400).json({ 
      error: 'Missing endpoint parameter', 
      message: 'Endpoint parameter is required' 
    });
  }
  
  try {
    // Get Alchemy API key
    const apiKey = getAlchemyApiKey();
    console.log(`Processing Alchemy request: ${endpoint} for chain ${chain}`);
    
    // Build the complete URL based on endpoint and chain
    let url;
    let requestParams = { ...req.query };
    
    // Remove our custom parameters
    delete requestParams.endpoint;
    delete requestParams.chain;
    
    // Handle different endpoints and construct the appropriate URL
    switch (endpoint.toLowerCase()) {
      case 'getnftsforowner':
        url = `${getAlchemyBaseUrl(chain)}/nft/v3/${apiKey}/getNFTsForOwner`;
        
        // Set defaults for this specific endpoint
        requestParams = {
          ...requestParams,
          withMetadata: requestParams.withMetadata !== 'false',
          excludeFilters: requestParams.excludeFilters || ['SPAM', 'AIRDROPS'],
          pageSize: parseInt(requestParams.pageSize || '100', 10),
          // Ensure we get media info for better display
          includeMedia: true,
          // Include floor price data for proper value sorting
          withFloorPrice: true,
        };
        
        // Handle owner validation
        if (!requestParams.owner) {
          return res.status(400).json({
            error: 'Missing owner parameter',
            message: 'Owner address is required for getNFTsForOwner endpoint'
          });
        }
        
        break;
      
      case 'getnftmetadata':
        url = `${getAlchemyBaseUrl(chain)}/nft/v3/${apiKey}/getNFTMetadata`;
        
        // Basic validation
        if (!requestParams.contractAddress || !requestParams.tokenId) {
          return res.status(400).json({
            error: 'Missing parameters',
            message: 'contractAddress and tokenId are required'
          });
        }
        
        break;
      
      case 'getnftsforcollection':
        url = `${getAlchemyBaseUrl(chain)}/nft/v3/${apiKey}/getNFTsForCollection`;
        
        // Basic validation
        if (!requestParams.contractAddress) {
          return res.status(400).json({
            error: 'Missing contractAddress parameter',
            message: 'contractAddress is required for getNFTsForCollection endpoint'
          });
        }
        
        break;
      
      case 'getassettransfers':
        // This endpoint requires a different URL format since it's an RPC method
        url = `${getAlchemyBaseUrl(chain)}/v2/${apiKey}`;
        
        try {
          // Parse addresses
          const addresses = requestParams.addresses ? 
            requestParams.addresses.split(',').map(addr => addr.trim()) : 
            [];
          
          if (!addresses.length) {
            return res.status(400).json({
              error: 'Missing addresses parameter',
              message: 'At least one address is required for getAssetTransfers endpoint'
            });
          }
          
          console.log(`Fetching transfers for ${addresses.length} addresses on ${chain}`);
          
          // Make a POST request to Alchemy's JSON-RPC endpoint
          const rpcResponse = await axios.post(url, {
            jsonrpc: "2.0",
            id: 1,
            method: "alchemy_getAssetTransfers",
            params: [{
              category: ["ERC721", "ERC1155"],
              toAddress: addresses,
              withMetadata: true,
              excludeZeroValue: true,
              maxCount: "0x64", // Hex for 100
              order: requestParams.order || "desc"
            }]
          }, {
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            }
          });
          
          // Process the transfer data to make it easier to use on the frontend
          const transfers = rpcResponse.data?.result?.transfers || [];
          console.log(`Received ${transfers.length} transfers from Alchemy`);
          
          // Create a map of contractAddress-tokenId -> timestamp for easy lookup
          const transferMap = {};
          transfers.forEach(transfer => {
            try {
              const contractAddress = transfer.rawContract?.address;
              const tokenId = transfer.tokenId;
              
              if (contractAddress && tokenId) {
                const key = `${contractAddress.toLowerCase()}-${tokenId}`;
                // Use ISO string for consistent date handling
                transferMap[key] = new Date(transfer.metadata.blockTimestamp).toISOString();
              }
            } catch (e) {
              console.warn('Error processing transfer:', e);
            }
          });
          
          // Return both the raw transfers and the processed map
          return res.status(200).json({
            transfers,
            transferMap,
            count: transfers.length
          });
        } catch (error) {
          console.error('Error fetching asset transfers:', error);
          return res.status(500).json({
            error: 'Failed to fetch asset transfers',
            message: error.message
          });
        }
        
        // No need for a break statement here as we're returning directly
        
      default:
        return res.status(400).json({
          error: 'Unsupported endpoint',
          message: `Endpoint ${endpoint} is not supported`,
          supportedEndpoints: ['getNFTsForOwner', 'getNFTMetadata', 'getNFTsForCollection', 'getAssetTransfers']
        });
    }
    
    console.log(`Requesting from Alchemy URL: ${url}`);
    
    // Add retry logic for Alchemy API
    const maxRetries = 2;
    let lastError = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Make the request with a reasonable timeout
        const response = await axios.get(url, {
          params: requestParams,
          timeout: 10000,
          headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate, br'
          }
        });
        
        // Log successful response
        console.log(`Alchemy API response status: ${response.status}, data received successfully`);
        
        // Fix nft data if needed for easier consumption on the frontend
        if (endpoint.toLowerCase() === 'getnftsforowner' && response.data?.ownedNfts) {
          // Add owner address to each NFT for filtering later
          response.data.ownedNfts = response.data.ownedNfts.map(nft => ({
            ...nft,
            ownerAddress: requestParams.owner,
            source: 'alchemy',
            network: chain
          }));
        }
        
        return res.status(200).json(response.data);
      } catch (error) {
        console.error(`Attempt ${attempt + 1}/${maxRetries + 1} failed:`, error.message);
        lastError = error;
        
        // Only retry on certain error types
        if (error.response?.status === 429 || // Rate limit
            error.response?.status === 500 || // Server error
            error.code === 'ECONNABORTED' || // Timeout
            error.code === 'ETIMEDOUT') {
          // Wait longer between retries
          await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
          continue;
        } else {
          // Don't retry on client errors or other issues
          break;
        }
      }
    }
    
    // If we get here, all attempts failed
    console.error('All Alchemy API attempts failed');
    
    // Return an informative error
    if (lastError?.response) {
      return res.status(lastError.response.status).json({
        error: 'Alchemy API error',
        message: lastError.message,
        details: lastError.response.data
      });
    } else {
      return res.status(500).json({
        error: 'Alchemy API request failed',
        message: lastError?.message || 'Unknown error',
        code: lastError?.code
      });
    }
  } catch (error) {
    console.error('Global error in Alchemy handler:', error);
    
    return res.status(500).json({
      error: 'Alchemy API handler error',
      message: error.message
    });
  }
}