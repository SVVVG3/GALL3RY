import React from 'react';

/**
 * NftCard Component
 * Displays an individual NFT
 */
const NftCard = ({ nft }) => {
  const imageUrl = nft.media?.[0]?.gateway || 
                  nft.metadata?.image || 
                  'https://via.placeholder.com/400?text=No+Image';

  const title = nft.title || nft.metadata?.name || 'Unnamed NFT';
  const collection = nft.contract?.name || 'Unknown Collection';
  const tokenId = nft.id?.tokenId ? 
    `#${parseInt(nft.id.tokenId, 16)}` : 
    nft.tokenId ? `#${nft.tokenId}` : '';

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      <div className="w-full aspect-square bg-gray-100">
        <img 
          src={imageUrl} 
          alt={title}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = 'https://via.placeholder.com/400?text=Error+Loading+Image';
          }}
        />
      </div>
      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-1 truncate" title={title}>
          {title} {tokenId}
        </h3>
        <p className="text-sm text-gray-600 mb-2 truncate" title={collection}>
          {collection}
        </p>
        <button className="w-full py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
          View Details
        </button>
      </div>
    </div>
  );
};

export default NftCard; 