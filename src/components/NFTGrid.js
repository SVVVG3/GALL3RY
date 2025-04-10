import React from 'react';
import NftCard from './NftCard';

/**
 * NftGrid Component
 * Displays a grid of NFTs
 */
const NftGrid = ({ nfts }) => {
  if (!nfts || nfts.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No NFTs found
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {nfts.map((nft, index) => (
        <NftCard key={`${nft.contract?.address}-${nft.id?.tokenId || index}`} nft={nft} />
      ))}
    </div>
  );
};

export default NftGrid; 