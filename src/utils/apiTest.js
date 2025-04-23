/**
 * API Testing Utility
 * This file provides helper functions to test API endpoints with chain-specific routing
 */

import { fetchNftsForOwner, fetchNftsAcrossChains } from '../services/alchemyService';

// Test wallet addresses
const TEST_WALLETS = {
  eth: '0x0ed1e02164a2a3fbc5d37e1f9c59bee3aad6eb3a',  // ENS domain holder
  base: '0x55ca68e0fb58fc9fbe9aa8156cac2a8ee8f7b767', // Base holder
  polygon: '0xf6bc47f6f74e5ff6fc661b267eba67596a0451ca', // Polygon NFT holder
  opt: '0x77ad3a15b78725d0cdc23c7c3eeb7fe3981a0ea0',   // Optimism NFT holder
  arb: '0x27e6a43f85d49c78d8c3c6f34e30157f02e982e3'    // Arbitrum NFT holder
};

/**
 * Test function to verify API calls to different chains
 */
export async function testChainRouting() {
  console.log('===== API CHAIN ROUTING TEST =====');
  
  // Test each chain individually
  const chains = Object.keys(TEST_WALLETS);
  const results = {};
  
  for (const chain of chains) {
    const wallet = TEST_WALLETS[chain];
    console.log(`Testing ${chain} chain with wallet ${wallet}`);
    
    try {
      const start = Date.now();
      const result = await fetchNftsForOwner(wallet, { 
        excludeSpam: true,
        withMetadata: true,
        pageSize: '10' // Small page size for quick test
      }, chain);
      
      const elapsed = Date.now() - start;
      
      results[chain] = {
        wallet,
        nftCount: result.ownedNfts?.length || 0,
        elapsed: `${elapsed}ms`,
        hasError: !!result.error,
        error: result.error,
        success: !result.error && Array.isArray(result.ownedNfts),
        // Check if chain info is correctly included
        chainInfo: result.ownedNfts && result.ownedNfts.length > 0 
          ? { 
              chain: result.ownedNfts[0].chain,
              network: result.ownedNfts[0].network,
              chainId: result.ownedNfts[0].chainId
            }
          : null
      };
      
      console.log(`${chain}: ${results[chain].success ? '✅' : '❌'} ${results[chain].nftCount} NFTs found in ${results[chain].elapsed}`);
      
      if (results[chain].chainInfo) {
        console.log(`Chain info in response: ${JSON.stringify(results[chain].chainInfo)}`);
      }
    } catch (error) {
      console.error(`Error testing ${chain}:`, error);
      results[chain] = {
        wallet,
        error: error.message,
        success: false
      };
    }
  }
  
  // Test multi-chain fetch
  try {
    console.log('\nTesting multi-chain fetch for single wallet...');
    const start = Date.now();
    const multiChainResult = await fetchNftsAcrossChains(TEST_WALLETS.eth, {
      excludeSpam: true,
      chains: ['eth', 'polygon', 'opt', 'arb', 'base']
    });
    
    const elapsed = Date.now() - start;
    
    console.log('Multi-chain fetch results:');
    console.log(`Total NFTs: ${multiChainResult.ownedNfts?.length || 0}`);
    console.log(`Time: ${elapsed}ms`);
    
    // Log count per chain
    if (multiChainResult.nftsByChain) {
      console.log('NFTs by chain:');
      Object.entries(multiChainResult.nftsByChain).forEach(([chain, nfts]) => {
        console.log(`  ${chain}: ${nfts.length} NFTs`);
      });
    }
    
    // Check if NFTs have the correct chain info
    if (multiChainResult.ownedNfts && multiChainResult.ownedNfts.length > 0) {
      const chainCounts = {};
      
      multiChainResult.ownedNfts.forEach(nft => {
        const nftChain = nft.chain || nft.network || nft.chainId;
        chainCounts[nftChain] = (chainCounts[nftChain] || 0) + 1;
      });
      
      console.log('NFTs with chain info:');
      Object.entries(chainCounts).forEach(([chain, count]) => {
        console.log(`  ${chain}: ${count} NFTs`);
      });
    }
    
    results.multiChain = {
      success: !multiChainResult.error,
      totalNfts: multiChainResult.ownedNfts?.length || 0,
      elapsed: `${elapsed}ms`
    };
  } catch (error) {
    console.error('Error testing multi-chain fetch:', error);
    results.multiChain = {
      error: error.message,
      success: false
    };
  }
  
  return results;
}

// If imported directly, export the test function
export default { testChainRouting }; 