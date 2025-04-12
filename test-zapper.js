/**
 * Test script for validating Zapper API integration with the latest schema updates
 * 
 * This script:
 * 1. Tests the nftUsersTokens query with proper estimatedValue fields
 * 2. Verifies deduplication of NFTs based on contract and token ID
 * 3. Confirms that proper value fields are obtained and used
 * 
 * To run: 
 * node test-zapper.js
 */

const axios = require('axios');
require('dotenv').config();

// Sample Ethereum address known to have NFTs
const TEST_ADDRESS = '0xcbee81ef354480853cc21165930d265ba1326266'; // Replace with any address you want to test

// Test the NFT fetching with the latest schema
async function testNftFetching() {
  try {
    console.log('-'.repeat(80));
    console.log('Testing Zapper API NFT fetching with updated schema');
    console.log('-'.repeat(80));
    
    // Query using new estimatedValue field format
    const query = `
      query NftUsersTokens($owners: [Address!]!, $first: Int, $withOverrides: Boolean) {
        nftUsersTokens(
          owners: $owners
          first: $first
          withOverrides: $withOverrides
        ) {
          edges {
            node {
              id
              name
              tokenId
              collection {
                id
                name
                address
                floorPriceEth
              }
              estimatedValue {
                valueWithDenomination
                denomination {
                  symbol
                }
              }
              lastSale {
                valueWithDenomination
                denomination {
                  symbol
                }
              }
            }
            cursor
          }
        }
      }
    `;
    
    // Variables for the query
    const variables = {
      owners: [TEST_ADDRESS],
      first: 100,
      withOverrides: true
    };
    
    console.log(`Fetching NFTs for address: ${TEST_ADDRESS}`);
    
    // Direct API call using the API key from .env
    const result = await axios({
      url: 'https://public.zapper.xyz/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-zapper-api-key': process.env.ZAPPER_API_KEY,
        'Accept': 'application/json'
      },
      data: { query, variables }
    });
    
    // Check for GraphQL errors
    if (result.data.errors) {
      console.error('GraphQL errors:', result.data.errors);
      return;
    }
    
    const nfts = result.data.data.nftUsersTokens.edges.map(edge => edge.node);
    console.log(`Fetched ${nfts.length} NFTs for address ${TEST_ADDRESS}`);
    
    // Test deduplication
    const uniqueNfts = deduplicateNfts(nfts);
    console.log(`After deduplication: ${uniqueNfts.length} unique NFTs`);
    
    if (nfts.length !== uniqueNfts.length) {
      console.log(`Found and removed ${nfts.length - uniqueNfts.length} duplicate NFTs`);
    }
    
    // Check value fields
    console.log('\nValue field analysis:');
    let estimatedValueCount = 0;
    let lastSaleCount = 0;
    let floorPriceCount = 0;
    
    uniqueNfts.forEach(nft => {
      if (nft.estimatedValue?.valueWithDenomination) estimatedValueCount++;
      if (nft.lastSale?.valueWithDenomination) lastSaleCount++;
      if (nft.collection?.floorPriceEth) floorPriceCount++;
    });
    
    console.log(`NFTs with estimatedValue: ${estimatedValueCount} (${Math.round(estimatedValueCount/uniqueNfts.length*100)}%)`);
    console.log(`NFTs with lastSale: ${lastSaleCount} (${Math.round(lastSaleCount/uniqueNfts.length*100)}%)`);
    console.log(`NFTs with floorPriceEth: ${floorPriceCount} (${Math.round(floorPriceCount/uniqueNfts.length*100)}%)`);
    
    // Print a few sample NFTs with their values
    console.log('\nSample NFTs with value information:');
    uniqueNfts.slice(0, 5).forEach((nft, index) => {
      console.log(`\nNFT #${index + 1}: ${nft.name || 'Unnamed'} (Token ID: ${nft.tokenId})`);
      console.log(`Collection: ${nft.collection?.name || 'Unknown'}`);
      
      if (nft.estimatedValue?.valueWithDenomination) {
        console.log(`Estimated Value: ${nft.estimatedValue.valueWithDenomination} ${nft.estimatedValue.denomination?.symbol || 'ETH'}`);
      } else {
        console.log('Estimated Value: Not available');
      }
      
      if (nft.lastSale?.valueWithDenomination) {
        console.log(`Last Sale: ${nft.lastSale.valueWithDenomination} ${nft.lastSale.denomination?.symbol || 'ETH'}`);
      } else {
        console.log('Last Sale: Not available');
      }
      
      if (nft.collection?.floorPriceEth) {
        console.log(`Floor Price: ${nft.collection.floorPriceEth} ETH`);
      } else {
        console.log('Floor Price: Not available');
      }
    });
    
    console.log('-'.repeat(80));
    console.log('Test completed successfully!');
    console.log('-'.repeat(80));
  } catch (error) {
    console.error('Error testing NFT fetching:', error);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Helper function to deduplicate NFTs (same as in API handler)
function deduplicateNfts(nfts) {
  const uniqueNfts = new Map();
  const dedupedNfts = [];
  
  nfts.forEach(nft => {
    if (!nft) return;
    
    // Create a unique key for each NFT based on collection address and token ID
    const collectionAddr = nft.collection?.address || '';
    const tokenId = nft.tokenId || '';
    const uniqueKey = `${collectionAddr.toLowerCase()}-${tokenId}`;
    
    // Only add if we haven't seen this NFT before
    if (!uniqueNfts.has(uniqueKey)) {
      uniqueNfts.set(uniqueKey, true);
      dedupedNfts.push(nft);
    }
  });
  
  return dedupedNfts;
}

// Run the test
testNftFetching(); 