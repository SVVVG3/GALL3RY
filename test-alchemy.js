/**
 * Alchemy API Test Script
 * 
 * This script tests the Alchemy NFT API integration, specifically focusing on image loading issues.
 * It fetches NFTs for a sample wallet and validates the image URLs in the responses.
 */

require('dotenv').config();
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

// Sample wallet address with a variety of NFTs
const TEST_WALLET = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045'; // vitalik.eth
const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY;

// Validate environment setup
if (!ALCHEMY_API_KEY) {
  console.error('❌ Error: ALCHEMY_API_KEY environment variable is required');
  process.exit(1);
}

// Test helper functions
const getImageUrl = (nft) => {
  if (!nft) return '';
  
  let imageUrl = '';
  
  // PRIORITY 1: Alchemy structured image object
  if (nft.image && typeof nft.image === 'object') {
    // Try cached URL first (most reliable from Alchemy API)
    if (nft.image.cachedUrl) {
      imageUrl = nft.image.cachedUrl;
    } 
    // Try PNG URL (good for SVG conversions)
    else if (nft.image.pngUrl) {
      imageUrl = nft.image.pngUrl;
    }
    // Try thumbnail (good for performance)
    else if (nft.image.thumbnailUrl) {
      imageUrl = nft.image.thumbnailUrl;
    }
    // Finally try original
    else if (nft.image.originalUrl) {
      imageUrl = nft.image.originalUrl;
    }
  }
  
  // PRIORITY 2: Direct image URL (if string)
  else if (typeof nft.image === 'string') {
    imageUrl = nft.image;
  }
  
  // PRIORITY 3: Raw metadata structures
  if (!imageUrl && nft.raw && nft.raw.metadata) {
    const metadata = nft.raw.metadata;
    imageUrl = metadata.image || metadata.image_url || metadata.image_data || '';
  }
  
  // Handle IPFS URLs
  if (imageUrl && imageUrl.startsWith('ipfs://')) {
    const ipfsHash = imageUrl.replace('ipfs://', '');
    imageUrl = `https://ipfs.io/ipfs/${ipfsHash}`;
  }
  
  // Handle Arweave URLs
  if (imageUrl && imageUrl.startsWith('ar://')) {
    imageUrl = imageUrl.replace('ar://', 'https://arweave.net/');
  }
  
  return imageUrl;
};

// Test direct API access
async function testDirectAlchemyAPI() {
  console.log('\n--- Testing Direct Alchemy API ---');
  
  try {
    console.log(`Fetching NFTs for wallet: ${TEST_WALLET}`);
    
    // Build the Alchemy API URL
    const alchemyUrl = `https://eth-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_API_KEY}/getNFTsForOwner`;
    
    // Make the API request
    const response = await axios.get(alchemyUrl, {
      params: {
        owner: TEST_WALLET,
        pageSize: 10,
        excludeFilters: ['SPAM'],
        withMetadata: true,
        includeMedia: true
      },
      timeout: 15000
    });
    
    console.log(`✅ Successfully fetched ${response.data.ownedNfts.length} NFTs`);
    
    // Analyze image URLs in the response
    console.log('\nAnalyzing NFT image URLs:');
    
    let validImageCount = 0;
    let missingImageCount = 0;
    let ipfsCount = 0;
    let alchemyCdnCount = 0;
    
    for (const nft of response.data.ownedNfts) {
      const imageUrl = getImageUrl(nft);
      
      if (!imageUrl) {
        missingImageCount++;
        console.log(`❌ Missing image URL for NFT: ${nft.title || nft.name || nft.tokenId}`);
        console.log('  NFT data:', JSON.stringify(nft, null, 2).substring(0, 500) + '...');
      } else {
        validImageCount++;
        
        // Track URL types
        if (imageUrl.includes('ipfs')) ipfsCount++;
        if (imageUrl.includes('nft-cdn.alchemy.com')) alchemyCdnCount++;
        
        console.log(`✅ Valid image URL: ${imageUrl.substring(0, 100)}${imageUrl.length > 100 ? '...' : ''}`);
      }
    }
    
    // Print summary
    console.log('\nImage URL Summary:');
    console.log(`- Total NFTs checked: ${response.data.ownedNfts.length}`);
    console.log(`- Valid image URLs: ${validImageCount}`);
    console.log(`- Missing image URLs: ${missingImageCount}`);
    console.log(`- IPFS URLs: ${ipfsCount}`);
    console.log(`- Alchemy CDN URLs: ${alchemyCdnCount}`);
    
    return true;
  } catch (error) {
    console.error('❌ Error testing Alchemy API:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return false;
  }
}

// Test our API proxy
async function testAPIProxy() {
  console.log('\n--- Testing Our API Proxy ---');
  
  try {
    console.log(`Fetching NFTs via our API proxy for wallet: ${TEST_WALLET}`);
    
    // Make the API request to our proxy
    const response = await axios.get('/alchemy', {
      baseURL: 'http://localhost:3001',
      params: {
        endpoint: 'getNFTsForOwner',
        chain: 'eth',
        owner: TEST_WALLET,
        pageSize: 10,
        excludeFilters: ['SPAM'],
        withMetadata: true,
        includeMedia: true
      },
      timeout: 15000
    });
    
    console.log(`✅ Successfully fetched ${response.data.ownedNfts.length} NFTs via proxy`);
    
    // Write the response to a file for inspection
    await fs.writeFile(
      path.join(__dirname, 'alchemy-proxy-response.json'),
      JSON.stringify(response.data, null, 2)
    );
    
    console.log('✅ Response saved to alchemy-proxy-response.json for inspection');
    
    return true;
  } catch (error) {
    console.error('❌ Error testing API proxy:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    } else if (error.code === 'ECONNREFUSED') {
      console.error('❌ Connection refused. Is your local server running on port 3001?');
    }
    return false;
  }
}

// Test image proxy with various URLs
async function testImageProxy() {
  console.log('\n--- Testing Image Proxy ---');
  
  // Sample image URLs from different sources
  const testUrls = [
    // Alchemy CDN
    'https://nft-cdn.alchemy.com/eth-mainnet/b396e2f77c2995414649af7cf1745e79',
    
    // IPFS via gateway
    'https://ipfs.io/ipfs/QmV4s7NMmDh64Z2GkuqbUmRM7XyN5WcbTn9sSAVvCsK4xQ/1001.gif',
    
    // Metadata Goonz
    'https://metadata.goonzworld.com/goonz-originals-polygon/images/goonz-vday-collection/3.png',
    
    // OpenSea (seadn.io)
    'https://i.seadn.io/gae/yIm-M5-BpSDdTEIJRt5D6xphizhIdozXjqSITgK4phWq7MmAU3qE7Nw7POGCiPGyhtJ3ZFP8iJ29TFl-RLcGBWX5qI4-ZcnCPcsY4zI?w=500&auto=format'
  ];
  
  let successCount = 0;
  
  for (const imageUrl of testUrls) {
    try {
      console.log(`Testing image proxy with: ${imageUrl}`);
      
      // Use our image proxy endpoint
      const proxyUrl = `http://localhost:3001/image-proxy?url=${encodeURIComponent(imageUrl)}`;
      
      // Make a request to our proxy
      const response = await axios.get(proxyUrl, {
        responseType: 'arraybuffer',
        timeout: 15000
      });
      
      // Check if we got a valid image response
      const contentType = response.headers['content-type'];
      const isImage = contentType && contentType.startsWith('image/');
      
      if (isImage) {
        console.log(`✅ Successfully proxied image (${contentType}, ${response.data.length} bytes)`);
        successCount++;
      } else {
        console.log(`❌ Received non-image response: ${contentType}`);
      }
    } catch (error) {
      console.error(`❌ Error proxying image ${imageUrl}:`, error.message);
    }
  }
  
  console.log(`\nImage Proxy Summary: ${successCount}/${testUrls.length} successful`);
  return successCount === testUrls.length;
}

// Main function to run all tests
async function runTests() {
  console.log('=== ALCHEMY NFT API TESTING ===');
  console.log('Testing API connectivity and image loading...');
  
  const directApiResult = await testDirectAlchemyAPI();
  console.log('\n----------------------------------------\n');
  
  const proxyApiResult = await testAPIProxy();
  console.log('\n----------------------------------------\n');
  
  const imageProxyResult = await testImageProxy();
  
  console.log('\n=== TEST RESULTS ===');
  console.log(`Direct Alchemy API: ${directApiResult ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Our API Proxy: ${proxyApiResult ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Image Proxy: ${imageProxyResult ? '✅ PASSED' : '❌ FAILED'}`);
  
  if (directApiResult && proxyApiResult && imageProxyResult) {
    console.log('\n✅ All tests passed! Your Alchemy integration appears to be working correctly.');
  } else {
    console.log('\n❌ Some tests failed. Please check the logs for details.');
  }
}

// Run the tests
runTests().catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
}); 