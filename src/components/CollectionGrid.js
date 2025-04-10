import React from 'react';
import CollectionCard from './CollectionCard';

/**
 * CollectionGrid Component
 * Displays a grid of NFT collections
 */
const CollectionGrid = ({ collections }) => {
  if (!collections || collections.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No collections available
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {collections.map(collection => (
        <CollectionCard key={collection.id} collection={collection} />
      ))}
    </div>
  );
};

export default CollectionGrid; 