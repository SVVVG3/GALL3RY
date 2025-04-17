/**
 * Test script for NFT display and image fetching
 * 
 * This test script validates:
 * 1. Alchemy API NFT data retrieval
 * 2. Image URL extraction from NFT data
 * 3. Image proxy functionality
 * 4. Frontend rendering compatibility 
 * 
 * Run with: 
 *   NODE_ENV=development node -r esm src/services/test-nft-display.js
 */

import axios from 'axios';
import alchemyService from './alchemyService.js';

// Sample NFT data based on the Alchemy API response example
const SAMPLE_NFT_RESPONSE = {
  ownedNfts: [
    {
      contract: {
        address: "0x0000000000cf80E7Cf8Fa4480907f692177f8e06",
        name: "NamefiNFT",
        symbol: "NFNFT"
      },
      tokenId: "73906452355594127029039375271145516945927406532858726769026903911185640775143",
      tokenType: "ERC721",
      name: "vitalik.cloud",
      description: "vitalik.cloud - Namefi™️ NFT representing the beneficiary-ship of vitalik.cloud domain.",
      image: {
        cachedUrl: "https://nft-cdn.alchemy.com/eth-mainnet/a91d6d9cffbe5426ba8b50de8ced5868",
        thumbnailUrl: "https://res.cloudinary.com/alchemyapi/image/upload/thumbnailv2/eth-mainnet/a91d6d9cffbe5426ba8b50de8ced5868",
        pngUrl: "https://res.cloudinary.com/alchemyapi/image/upload/convert-png/eth-mainnet/a91d6d9cffbe5426ba8b50de8ced5868",
        originalUrl: "https://md.namefi.io/ethereum/svg/vitalik.cloud/image.svg"
      },
      raw: {
        metadata: {
          image: "https://md.namefi.io/ethereum/svg/vitalik.cloud/image.svg"
        }
      }
    }
  ]
};

// Console formatting helpers
const log = {
  info: (msg) => console.log(`ℹ️ ${msg}`),
  success: (msg) => console.log(`✅ ${msg}`),
  error: (msg) => console.log(`❌ ${msg}`),
  warn: (msg) => console.log(`⚠️ ${msg}`),
  title: (msg) => console.log(`\n📌 ${msg}\n${'='.repeat(msg.length + 5)}`)
};

// Validate a single image URL by attempting to load it
async function validateImageUrl(url, description) {
  if (!url) {
    log.error(`${description || 'URL'} is missing or empty`);
    return false;
  }

  try {
    log.info(`Testing ${description || 'image URL'}: ${url}`);
    
    // Try direct fetch first
    try {
      const response = await axios.get(url, {
        timeout: 8000,
        responseType: 'arraybuffer',
        validateStatus: status => status < 400,
        headers: {
          'Accept': 'image/*',
        }
      });
      
      const contentType = response.headers['content-type'];
      const isImage = contentType && contentType.startsWith('image/');
      const size = response.data ? response.data.length : 0;
      
      log.success(`Direct fetch succeeded: ${contentType}, ${Math.round(size / 1024)} KB`);
      return { success: true, direct: true, url };
    } catch (directError) {
      log.warn(`Direct fetch failed: ${directError.message}`);
      
      // If direct fetch fails, try through our proxy 
      const proxyUrl = `http://localhost:3000/api/image-proxy?url=${encodeURIComponent(url)}`;
      log.info(`Trying via proxy: ${proxyUrl}`);
      
      const proxyResponse = await axios.get(proxyUrl, {
        timeout: 10000,
        responseType: 'arraybuffer',
        validateStatus: status => status < 400
      });
      
      const contentType = proxyResponse.headers['content-type'];
      const isImage = contentType && contentType.startsWith('image/');
      const size = proxyResponse.data ? proxyResponse.data.length : 0;
      
      if (isImage) {
        log.success(`Proxy fetch succeeded: ${contentType}, ${Math.round(size / 1024)} KB`);
        return { success: true, direct: false, url: proxyUrl };
      } else {
        log.error(`Proxy response is not an image: ${contentType}`);
        return { success: false };
      }
    }
  } catch (error) {
    log.error(`All fetch attempts failed for ${url}: ${error.message}`);
    return { success: false };
  }
}

// Extract and test all possible image URLs from an NFT object
async function testNftImageUrls(nft) {
  log.title(`Testing NFT: ${nft.name || nft.title || `#${nft.tokenId}`}`);
  
  // Identify all potential image URLs in the NFT data
  const possibleImageUrls = [
    { source: 'image.cachedUrl', url: nft.image?.cachedUrl, priority: 1 },
    { source: 'image.pngUrl', url: nft.image?.pngUrl, priority: 2 },
    { source: 'image.thumbnailUrl', url: nft.image?.thumbnailUrl, priority: 3 },
    { source: 'image.originalUrl', url: nft.image?.originalUrl, priority: 4 },
    { source: 'image (string)', url: typeof nft.image === 'string' ? nft.image : null, priority: 5 },
    { source: 'raw.metadata.image', url: nft.raw?.metadata?.image, priority: 6 },
    { source: 'raw.metadata.image_url', url: nft.raw?.metadata?.image_url, priority: 7 },
    { source: 'metadata.image', url: nft.metadata?.image, priority: 8 },
    { source: 'metadata.image_url', url: nft.metadata?.image_url, priority: 9 },
  ];
  
  // Filter to only URLs that exist
  const imageUrls = possibleImageUrls.filter(item => item.url);
  
  if (imageUrls.length === 0) {
    log.error('No image URLs found in this NFT');
    return { success: false, nft };
  }
  
  log.info(`Found ${imageUrls.length} potential image URLs`);
  
  // Sort by priority
  imageUrls.sort((a, b) => a.priority - b.priority);
  
  // Test each URL in priority order until one works
  for (const imageInfo of imageUrls) {
    log.info(`Testing ${imageInfo.source}: ${imageInfo.url}`);
    const result = await validateImageUrl(imageInfo.url, imageInfo.source);
    
    if (result.success) {
      return { 
        success: true, 
        nft, 
        workingUrl: result.url,
        usesProxy: !result.direct,
        source: imageInfo.source
      };
    }
  }
  
  log.error('All image URLs failed validation');
  return { success: false, nft };
}

// Test a single sample NFT with hard-coded data
async function testSampleNft() {
  log.title('Testing sample NFT from API response example');
  
  if (!SAMPLE_NFT_RESPONSE.ownedNfts || SAMPLE_NFT_RESPONSE.ownedNfts.length === 0) {
    log.error('Sample NFT data is invalid');
    return;
  }
  
  const sampleNft = SAMPLE_NFT_RESPONSE.ownedNfts[0];
  const result = await testNftImageUrls(sampleNft);
  
  if (result.success) {
    log.success(`Sample NFT test passed using ${result.source}`);
  } else {
    log.error('Sample NFT test failed - no valid images');
  }
}

// Test with real NFTs from Alchemy API
async function testRealNfts(address, limit = 3) {
  log.title(`Testing real NFTs for address: ${address}`);
  
  try {
    const result = await alchemyService.getNftsForOwner(address, {
      pageSize: Math.min(10, limit), // Don't fetch too many
      excludeSpam: true
    });
    
    if (!result.nfts || result.nfts.length === 0) {
      log.error(`No NFTs found for address ${address}`);
      return { success: false, address, tested: 0, passed: 0 };
    }
    
    log.info(`Found ${result.nfts.length} NFTs, testing up to ${limit}...`);
    
    // Test each NFT
    const nftsToTest = result.nfts.slice(0, limit);
    let passCount = 0;
    
    for (let i = 0; i < nftsToTest.length; i++) {
      const nft = nftsToTest[i];
      const testResult = await testNftImageUrls(nft);
      
      if (testResult.success) {
        passCount++;
      }
    }
    
    if (passCount === nftsToTest.length) {
      log.success(`All ${passCount}/${nftsToTest.length} NFTs passed image testing`);
    } else {
      log.warn(`${passCount}/${nftsToTest.length} NFTs passed image testing`);
    }
    
    return { 
      success: passCount > 0, 
      address, 
      tested: nftsToTest.length, 
      passed: passCount 
    };
    
  } catch (error) {
    log.error(`Error testing real NFTs: ${error.message}`);
    return { success: false, address, error: error.message };
  }
}

// Run a complete test suite
async function runFullTestSuite() {
  log.title('🚀 STARTING NFT DISPLAY TEST SUITE');
  
  // Test the sample NFT first
  await testSampleNft();
  
  // Test addresses with real data
  const testAddresses = [
    '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045', // Vitalik 
    '0x57bb27f5Bf6E9F3E42397cCa4342BB35C985997f', // Random NFT collector
  ];
  
  const addressResults = [];
  
  for (const address of testAddresses) {
    const result = await testRealNfts(address, 3);
    addressResults.push(result);
  }
  
  // Report summary
  log.title('📊 TEST SUMMARY');
  let totalTested = 0;
  let totalPassed = 0;
  
  addressResults.forEach(result => {
    if (result.tested) {
      totalTested += result.tested;
      totalPassed += result.passed;
      log.info(`Address ${result.address}: ${result.passed}/${result.tested} passed`);
    } else {
      log.error(`Address ${result.address}: Test failed - ${result.error || 'unknown error'}`);
    }
  });
  
  if (totalTested > 0) {
    const successRate = Math.round((totalPassed / totalTested) * 100);
    log.info(`Overall success rate: ${successRate}% (${totalPassed}/${totalTested})`);
    
    if (successRate >= 80) {
      log.success('NFT image display test PASSED');
    } else if (successRate >= 50) {
      log.warn('NFT image display test PARTIALLY PASSED');
    } else {
      log.error('NFT image display test FAILED');
    }
  } else {
    log.error('NFT image display test FAILED - no NFTs were tested');
  }
}

// Execute the test
runFullTestSuite().catch(error => {
  log.error(`Unhandled error in test suite: ${error.message}`);
}); 