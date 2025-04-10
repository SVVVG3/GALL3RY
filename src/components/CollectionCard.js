import React from 'react';

/**
 * CollectionCard Component
 * Displays an NFT collection card
 */
const CollectionCard = ({ collection }) => {
  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
      <div className="w-full aspect-square">
        <img 
          src={collection.imageUrl} 
          alt={collection.name}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-800 mb-1">{collection.name}</h3>
        <p className="text-sm text-gray-600 mb-2">{collection.description}</p>
        <button className="w-full py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
          View Collection
        </button>
      </div>
    </div>
  );
};

export default CollectionCard; 