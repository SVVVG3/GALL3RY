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
  
  // Log all request details for debugging
  console.log(`Alchemy API Request:`, {
    endpoint,
    chain,
    method: req.method,
    params: req.query,
    url: req.url,
    userAgent: req.headers['user-agent']
  });
  
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
      case 'getassettransfer':
      case 'getasset':
        // This endpoint requires a different URL format since it's an RPC method
        url = `${getAlchemyBaseUrl(chain)}/v2/${apiKey}`;
        
        try {
          // Parse and validate addresses
          const addresses = requestParams.addresses ? 
            requestParams.addresses.split(',')
              .map(addr => addr.trim())
              .filter(addr => addr && addr.length > 0) : 
            [];
          
          // More detailed logging for debugging
          console.log(`Fetching transfers for ${addresses.length} addresses on ${chain}:`, 
            addresses.length > 0 ? addresses.slice(0, 3).concat(addresses.length > 3 ? ['...and more'] : []) : 'No addresses');
          
          if (!addresses.length) {
            return res.status(400).json({
              error: 'Missing addresses parameter',
              message: 'At least one address is required for getAssetTransfers endpoint'
            });
          }
          
          // Get the optional category parameter or default to ERC721 and ERC1155
          const categories = requestParams.category ? 
            (Array.isArray(requestParams.category) ? requestParams.category : [requestParams.category]) : 
            ["ERC721", "ERC1155"];
          
          // Make two requests - one for incoming transfers and one for outgoing
          const [incomingResponse, outgoingResponse] = await Promise.all([
            // Fetch transfers TO these addresses (acquisitions)
            axios.post(url, {
              jsonrpc: "2.0",
              id: 1,
              method: "alchemy_getAssetTransfers",
              params: [{
                category: categories,
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
            }),
            
            // Fetch transfers FROM these addresses (sales/transfers out)
            axios.post(url, {
              jsonrpc: "2.0",
              id: 2,
              method: "alchemy_getAssetTransfers",
              params: [{
                category: categories,
                fromAddress: addresses,
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
            })
          ]);
          
          // Process the transfer data to make it easier to use on the frontend
          const incomingTransfers = incomingResponse.data?.result?.transfers || [];
          const outgoingTransfers = outgoingResponse.data?.result?.transfers || [];
          
          console.log(`Received ${incomingTransfers.length} incoming transfers and ${outgoingTransfers.length} outgoing transfers from Alchemy`);
          
          // Sample log for debugging
          if (incomingTransfers.length > 0) {
            const sample = incomingTransfers[0];
            console.log('Sample transfer:', {
              from: sample.from,
              to: sample.to,
              asset: sample.asset,
              tokenId: sample.tokenId,
              contractAddress: sample.rawContract?.address,
              timestamp: sample.metadata?.blockTimestamp
            });
          }
          
          // Create a map of contractAddress-tokenId -> timestamp for easy lookup
          // Process only incoming transfers initially since these are current NFTs
          const transferMap = {};
          let processedCount = 0;
          
          // Process incoming transfers first (these are acquisitions)
          incomingTransfers.forEach(transfer => {
            try {
              const contractAddress = transfer.rawContract?.address;
              const tokenId = transfer.tokenId;
              
              if (contractAddress && tokenId) {
                const key = `${contractAddress.toLowerCase()}-${tokenId}`;
                const timestamp = transfer.metadata.blockTimestamp;
                
                // Only store the most recent timestamp for each NFT
                // or overwrite if this transfer is more recent
                if (!transferMap[key] || new Date(timestamp) > new Date(transferMap[key])) {
                  transferMap[key] = timestamp;
                  processedCount++;
                }
              }
            } catch (e) {
              console.warn('Error processing transfer:', e);
            }
          });
          
          // Now ALSO process outgoing transfers to get the most recent activity for each NFT
          outgoingTransfers.forEach(transfer => {
            try {
              const contractAddress = transfer.rawContract?.address;
              const tokenId = transfer.tokenId;
              
              if (contractAddress && tokenId) {
                const key = `${contractAddress.toLowerCase()}-${tokenId}`;
                const timestamp = transfer.metadata.blockTimestamp;
                
                // Update if this outgoing transfer is more recent than what we have
                if (!transferMap[key] || new Date(timestamp) > new Date(transferMap[key])) {
                  transferMap[key] = timestamp;
                  processedCount++;
                }
              }
            } catch (e) {
              console.warn('Error processing outgoing transfer:', e);
            }
          });
          
          // If requested, include debug information
          const debug = requestParams.debug === 'true';
          const diagnosticInfo = debug ? {
            incomingCount: incomingTransfers.length,
            outgoingCount: outgoingTransfers.length,
            processedCount,
            addressesUsed: addresses,
            mapEntriesCount: Object.keys(transferMap).length,
            sampleTransfers: incomingTransfers.slice(0, 2)
          } : null;
          
          // Return both the raw transfers and the processed map
          return res.status(200).json({
            transfers: incomingTransfers,
            transferMap,
            count: incomingTransfers.length,
            processedCount,
            mapSize: Object.keys(transferMap).length,
            diagnostic: diagnosticInfo
          });
        } catch (error) {
          console.error('Error fetching asset transfers:', error);
          
          // Enhanced error logging
          const errorDetails = {
            message: error.message,
            stack: error.stack,
            response: error.response ? {
              status: error.response.status,
              statusText: error.response.statusText,
              data: error.response.data
            } : null
          };
          
          console.error('Error details:', JSON.stringify(errorDetails, null, 2));
          
          return res.status(500).json({
            error: 'Failed to fetch asset transfers',
            message: error.message,
            details: errorDetails
          });
        }
        
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