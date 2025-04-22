/**
 * Utility functions for processing NFT data
 */

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
  
  return nfts.map(nft => {
    // Skip null or undefined items
    if (!nft) return null;
    
    // Create a standardized NFT object with consistent property names
    return {
      // Basic NFT properties
      id: nft.id || `${nft.contractAddress}-${nft.tokenId}` || `${nft.contract?.address}-${nft.tokenId}`,
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
      
      // Value information
      floorPrice: nft.floorPrice || nft.collection?.floorPrice || {
        value: nft.contractMetadata?.openSea?.floorPrice || nft.contract?.openSeaMetadata?.floorPrice || 0,
        valueUsd: nft.contractMetadata?.openSea?.floorPriceUsd || 0
      },
      
      // Timestamps
      mintedAt: nft.mintedAt || nft.timeLastUpdated || nft.createdAt || null,
      lastTransferTimestamp: nft.lastTransferTimestamp || nft.transferTimestamp || nft.lastActivityTimestamp || null,
      
      // Keep the original data for reference
      _originalData: nft
    };
  }).filter(Boolean); // Remove any null/undefined items
}; 