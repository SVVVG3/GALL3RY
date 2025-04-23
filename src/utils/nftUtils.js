/**
 * Utility functions for processing NFT data
 */
import { createConsistentUniqueId } from '../services/alchemyService';

/**
 * Formats an array of NFTs for display by standardizing property names and structure
 * @param {Array} nfts - The array of NFT objects to format
 * @returns {Array} - The formatted NFT array
 */
export const formatNFTsForDisplay = (nfts) => {
  if (!nfts || !Array.isArray(nfts)) {
    console.warn('formatNFTsForDisplay received invalid input:', nfts);
    return [];
  }
  
  // Remove any duplicates using our consistent uniqueId generator from alchemyService
  const uniqueNfts = removeDuplicates(nfts);
  console.log(`Formatting ${uniqueNfts.length} unique NFTs for display (filtered ${nfts.length - uniqueNfts.length} duplicates)`);
  
  return uniqueNfts.map(nft => {
    // Skip null or undefined items
    if (!nft) return null;
    
    // Get the consistent uniqueId
    const uniqueId = nft.uniqueId || createConsistentUniqueId(nft);
    
    // Create a standardized NFT object with consistent property names
    return {
      // Basic NFT properties
      id: uniqueId,
      uniqueId,
      tokenId: nft.tokenId || nft.token_id || '0',
      name: nft.name || nft.title || nft.metadata?.name || `#${nft.tokenId || nft.token_id || '0'}`,
      description: nft.description || nft.metadata?.description || '',
      
      // Images and media
      image: nft.image || nft.imageUrl || nft.media?.[0]?.gateway || nft.metadata?.image || nft.rawMetadata?.image,
      imageUrl: nft.imageUrl || nft.image || nft.media?.[0]?.gateway || nft.metadata?.image || nft.rawMetadata?.image,
      animationUrl: nft.animationUrl || nft.animation_url || nft.metadata?.animation_url || nft.rawMetadata?.animation_url,
      
      // Contract information
      contractAddress: nft.contractAddress || nft.contract?.address || '',
      collectionName: nft.collectionName || nft.collection?.name || nft.contract?.name || nft.contractMetadata?.name || '',
      collection_name: nft.collection_name || nft.collection?.name || nft.contract?.name || nft.contractMetadata?.name || '',
      
      // Network information
      network: nft.network || 'eth',
      ownerWallet: nft.ownerWallet || nft.ownerAddress || '',
      
      // Value information
      floorPrice: nft.floorPrice || nft.collection?.floorPrice ? { 
        value: nft.floorPrice?.value || nft.collection?.floorPrice?.value || nft.contractMetadata?.openSea?.floorPrice || nft.contract?.openSeaMetadata?.floorPrice || 0,
        valueUsd: nft.floorPrice?.valueUsd || nft.collection?.floorPrice?.valueUsd || nft.contractMetadata?.openSea?.floorPriceUsd || 0
      } : undefined,
      
      // Timestamps
      mintedAt: nft.mintedAt || nft.timeLastUpdated || nft.createdAt || null,
      lastTransferTimestamp: nft.lastTransferTimestamp || nft.transferTimestamp || nft.lastActivityTimestamp || null,
      
      // Include important original properties that might be referenced elsewhere
      contract: nft.contract ? { 
        address: nft.contract.address,
        name: nft.contract.name,
        symbol: nft.contract.symbol,
        tokenType: nft.contract.tokenType
      } : undefined,
      
      metadata: nft.metadata ? JSON.parse(JSON.stringify(nft.metadata)) : undefined,
      
      // Store minimal original data as a stringified copy for reference
      // This avoids carrying potentially non-extensible objects
      _originalSource: nft.contractAddress || nft.contract?.address || 'unknown'
    };
  }).filter(Boolean); // Remove any null/undefined items
};

/**
 * Remove duplicate NFTs based on uniqueId or contract-tokenId-network combination
 */
function removeDuplicates(nfts) {
  if (!nfts || !Array.isArray(nfts) || nfts.length === 0) return [];
  
  const uniqueMap = new Map();
  const duplicatesInfo = [];
  
  nfts.forEach(nft => {
    if (!nft) return;
    
    // Use the consistent uniqueId generation function
    // Important: we prioritize existing uniqueId to ensure consistency
    const uniqueId = nft.uniqueId || createConsistentUniqueId(nft);
    
    if (!uniqueMap.has(uniqueId)) {
      // Make sure we maintain the uniqueId for downstream processing
      uniqueMap.set(uniqueId, {...nft, uniqueId});
    } else {
      // Track duplicates for debugging
      duplicatesInfo.push({
        uniqueId,
        name: nft.name || nft.title || `Token #${nft.tokenId}`,
        tokenId: nft.tokenId || nft.token_id,
        contract: nft.contractAddress || nft.contract?.address,
        collection: nft.collection?.name || nft.contract?.name
      });
    }
  });
  
  const uniqueNfts = [...uniqueMap.values()];
  
  if (duplicatesInfo.length > 0) {
    console.log(`nftUtils: Removed ${duplicatesInfo.length} duplicates - sample:`, 
      duplicatesInfo.slice(0, Math.min(3, duplicatesInfo.length))
    );
  }
  
  return uniqueNfts;
} 