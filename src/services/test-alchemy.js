/**
 * Test file for debugging Alchemy service
 * This file directly imports the services and tries to use them
 * Run with: node -r esm src/services/test-alchemy.js
 */

// Try to import both service versions
import alchemyService from './alchemy/index.js';
import directAlchemyService from './directAlchemy.js';

// Function to test each service
async function testService(name, service) {
  console.log(`Testing ${name}...`);
  
  // Log available methods
  console.log(`Available methods: ${Object.keys(service).join(', ')}`);
  
  // Test address
  const testAddress = '0x44d4c58efcbb44639d64420175cf519aa3191a86';
  
  try {
    // Try fetchNFTsForAddress if available
    if (typeof service.fetchNFTsForAddress === 'function') {
      console.log(`Calling ${name}.fetchNFTsForAddress('${testAddress}')`);
      const result = await service.fetchNFTsForAddress(testAddress);
      console.log(`Result: ${result.nfts ? result.nfts.length : 0} NFTs found`);
    }
    // Try getNFTsForOwner if available
    else if (typeof service.getNFTsForOwner === 'function') {
      console.log(`Calling ${name}.getNFTsForOwner('${testAddress}')`);
      const result = await service.getNFTsForOwner(testAddress);
      console.log(`Result: ${result.nfts ? result.nfts.length : 0} NFTs found`);
    }
    else {
      console.log(`${name} has no method to fetch NFTs by address`);
    }
    
    // Try batchFetchNFTs if available
    if (typeof service.batchFetchNFTs === 'function') {
      console.log(`Calling ${name}.batchFetchNFTs([testAddress])`);
      const batchResult = await service.batchFetchNFTs([testAddress]);
      console.log(`Batch result: ${batchResult.nfts ? batchResult.nfts.length : 0} NFTs found`);
    }
    else {
      console.log(`${name} has no batchFetchNFTs method`);
    }
    
    console.log(`${name} test completed successfully`);
  } catch (error) {
    console.error(`Error testing ${name}:`, error);
  }
}

// Test both services
async function runTests() {
  try {
    console.log('Starting Alchemy service tests...');
    
    // Test main service
    if (alchemyService) {
      await testService('alchemyService', alchemyService);
    } else {
      console.log('Main alchemyService not available');
    }
    
    // Test direct service
    if (directAlchemyService) {
      await testService('directAlchemyService', directAlchemyService);
    } else {
      console.log('directAlchemyService not available');
    }
    
    console.log('All tests completed');
  } catch (error) {
    console.error('Test runner error:', error);
  }
}

// Run the tests
runTests(); 