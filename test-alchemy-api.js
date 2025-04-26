// Test script for Alchemy API integration
const axios = require('axios');
require('dotenv').config();

// Helper function to make API calls to our local server
async function testAlchemyAPI() {
  console.log('Testing Alchemy API integration...');
  
  // Test wallet address (vitalik.eth)
  const testAddress = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
  
  try {
    console.log(`Fetching NFTs for address: ${testAddress}`);
    const response = await axios.get(`http://localhost:3001/api/alchemy?endpoint=getNFTsForOwner&chain=eth&owner=${testAddress}&pageSize=5`);
    
    console.log('API Response Status:', response.status);
    console.log('NFTs found:', response.data.ownedNfts?.length || 0);
    
    if (response.data.ownedNfts && response.data.ownedNfts.length > 0) {
      console.log('Sample NFT:', {
        name: response.data.ownedNfts[0]?.title || 'N/A',
        contractAddress: response.data.ownedNfts[0]?.contract?.address || 'N/A',
        tokenId: response.data.ownedNfts[0]?.tokenId || 'N/A'
      });
    }
    
    console.log('✅ API test successful!');
    return true;
  } catch (error) {
    console.error('❌ API test failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    return false;
  }
}

// Run the test
testAlchemyAPI()
  .then(success => {
    console.log(`Test ${success ? 'passed' : 'failed'}`);
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('Unhandled error during test:', err);
    process.exit(1);
  }); 