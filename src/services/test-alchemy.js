/**
 * Test file for debugging Alchemy service and image fetching
 * This file checks both NFT data retrieval and image URL validation
 * Run with: node -r esm src/services/test-alchemy.js
 */

import axios from 'axios';
import alchemyService from './alchemyService.js';

// Function to validate an image URL by actually fetching it
async function validateImageUrl(url, description) {
  if (!url) {
    console.log(`❌ ${description || 'Image URL'} is missing`);
    return false;
  }

  try {
    console.log(`🔍 Testing ${description || 'image'} URL: ${url}`);
    
    // Check if URL needs proxy or direct access
    const useProxy = url.includes('ipfs.io') || 
                     url.includes('gateway.pinata.cloud') || 
                     url.includes('i.seadn.io') || 
                     url.includes('nft-cdn.alchemy.com');
    
    let testUrl = url;
    
    // If we should use our proxy, construct the proxy URL
    if (useProxy) {
      // For local testing, use localhost proxy
      testUrl = `http://localhost:3000/api/image-proxy?url=${encodeURIComponent(url)}`;
      console.log(`Using local proxy for URL: ${testUrl}`);
    }
    
    const response = await axios.get(testUrl, {
      timeout: 10000,
      responseType: 'arraybuffer',
      validateStatus: status => status < 400, // Only accept valid status codes
    });
    
    const contentType = response.headers['content-type'];
    const isImage = contentType && contentType.startsWith('image/');
    const size = response.data ? response.data.length : 0;
    
    console.log(`✅ ${description || 'Image'} loaded successfully:`, {
      status: response.status,
      contentType,
      size: `${Math.round(size / 1024)} KB`,
      isValidImage: isImage
    });
    
    return isImage;
  } catch (error) {
    console.error(`❌ Failed to load ${description || 'image'}: ${error.message}`);
    return false;
  }
}

// Function to analyze image URLs in an NFT object
function analyzeNftImageUrls(nft) {
  console.log(`\n📊 Analyzing image URLs for NFT: ${nft.name || nft.title || `#${nft.tokenId}`}`);
  
  // Check all possible image URL locations
  const imageLocations = [
    { path: 'image', type: 'direct property', url: typeof nft.image === 'string' ? nft.image : null },
    { path: 'image.cachedUrl', type: 'cached', url: nft.image?.cachedUrl },
    { path: 'image.pngUrl', type: 'PNG conversion', url: nft.image?.pngUrl },
    { path: 'image.thumbnailUrl', type: 'thumbnail', url: nft.image?.thumbnailUrl },
    { path: 'image.originalUrl', type: 'original', url: nft.image?.originalUrl },
    { path: 'metadata.image', type: 'metadata', url: nft.metadata?.image },
    { path: 'metadata.image_url', type: 'metadata URL', url: nft.metadata?.image_url },
    { path: 'raw.metadata.image', type: 'raw metadata', url: nft.raw?.metadata?.image },
    { path: 'raw.metadata.image_url', type: 'raw metadata URL', url: nft.raw?.metadata?.image_url },
  ];
  
  // Log all found image URLs
  console.log('Found image URLs:');
  const foundUrls = imageLocations.filter(loc => loc.url);
  
  if (foundUrls.length === 0) {
    console.log('❌ No image URLs found in NFT object');
    return false;
  }
  
  foundUrls.forEach(loc => {
    console.log(`- ${loc.type} (${loc.path}): ${loc.url}`);
  });
  
  return foundUrls;
}

// Main test function for NFTs and their images
async function testNftImageFetching(address) {
  console.log(`\n🧪 Testing NFT images for address: ${address}`);
  
  try {
    // Fetch NFTs for the address
    const result = await alchemyService.getNftsForOwner(address, {
      network: 'ethereum',
      pageSize: 10 // Limit to 10 for testing
    });
    
    console.log(`📦 Found ${result.nfts.length} NFTs for address`);
    
    if (result.nfts.length === 0) {
      console.log('❌ No NFTs found for testing images');
      return;
    }
    
    // Test each NFT for image availability
    let successCount = 0;
    let failureCount = 0;
    
    for (let i = 0; i < result.nfts.length && i < 5; i++) { // Limit to first 5 for faster testing
      const nft = result.nfts[i];
      console.log(`\n🖼️ Testing NFT #${i+1}: ${nft.name || nft.title || `#${nft.tokenId}`}`);
      
      // Analyze all image URLs in this NFT
      const imageUrls = analyzeNftImageUrls(nft);
      
      if (!imageUrls || imageUrls.length === 0) {
        console.log('❌ No image URLs found for this NFT');
        failureCount++;
        continue;
      }
      
      // Try to validate the first 2 image URLs
      let imageValidated = false;
      for (let j = 0; j < Math.min(imageUrls.length, 2); j++) {
        const imageUrl = imageUrls[j];
        const isValid = await validateImageUrl(imageUrl.url, `${imageUrl.type} image`);
        
        if (isValid) {
          imageValidated = true;
          break; // Stop if we found a valid image
        }
      }
      
      if (imageValidated) {
        successCount++;
      } else {
        failureCount++;
      }
    }
    
    console.log(`\n📋 Image validation results: ✅ ${successCount} successful, ❌ ${failureCount} failed`);
    
  } catch (error) {
    console.error('\n❌ Error testing NFT images:', error.message);
  }
}

// Test addresses - include a few for different testing scenarios
const testAddresses = [
  '0x44d4c58efcbb44639d64420175cf519aa3191a86', // Original test address
  '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', // Vitalik - has many NFTs
  '0xFf3d7f41F20ebBF66eBD1dF43bb05E956a13Af47'  // Another test address with NFTs
];

// Run the test for each address
async function runTests() {
  try {
    console.log('🚀 Starting NFT image testing...');
    
    for (let i = 0; i < testAddresses.length; i++) {
      await testNftImageFetching(testAddresses[i]);
    }
    
    console.log('\n✨ All image tests completed');
  } catch (error) {
    console.error('\n💥 Test runner error:', error);
  }
}

// Run the tests
runTests(); 