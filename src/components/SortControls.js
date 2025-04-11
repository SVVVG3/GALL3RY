import React from 'react';
import { useNFT } from '../contexts/NFTContext';

/**
 * SortControls component
 * Displays sort options for the NFT gallery
 */
const SortControls = () => {
  const { sortBy, setSortBy } = useNFT();

  return (
    <div className="flex space-x-2">
      <button
        onClick={() => setSortBy('recent')}
        className={`px-3 py-1.5 text-sm font-medium rounded-md ${
          sortBy === 'recent'
            ? 'bg-purple-100 text-purple-800'
            : 'bg-white text-gray-600 hover:bg-gray-100'
        }`}
      >
        Recent
      </button>
      <button
        onClick={() => setSortBy('a-z')}
        className={`px-3 py-1.5 text-sm font-medium rounded-md ${
          sortBy === 'a-z'
            ? 'bg-purple-100 text-purple-800'
            : 'bg-white text-gray-600 hover:bg-gray-100'
        }`}
      >
        A-Z
      </button>
      <button
        onClick={() => setSortBy('collection')}
        className={`px-3 py-1.5 text-sm font-medium rounded-md ${
          sortBy === 'collection'
            ? 'bg-purple-100 text-purple-800'
            : 'bg-white text-gray-600 hover:bg-gray-100'
        }`}
      >
        Collection
      </button>
      <button
        onClick={() => setSortBy('value')}
        className={`px-3 py-1.5 text-sm font-medium rounded-md ${
          sortBy === 'value'
            ? 'bg-purple-100 text-purple-800'
            : 'bg-white text-gray-600 hover:bg-gray-100'
        }`}
      >
        Value
      </button>
    </div>
  );
};

export default SortControls; 