import React, { useEffect, useRef, useState } from 'react';
import { useNFT } from '../contexts/NFTContext';
import NFTGrid from './NFTGrid';
import LoadingSpinner from './LoadingSpinner';
import SortControls from './SortControls';

/**
 * NFT Gallery component
 * Displays a grid of NFT images with search, sorting and pagination
 */
const NFTGallery = ({ addresses, onNFTClick }) => {
  const { nfts, loading, error, hasMore, fetchNFTs, loadMoreNFTs, setSearchQuery } = useNFT();
  const [searchText, setSearchText] = useState('');
  
  // Add debug info to monitor hasMore state
  console.log("NFTGallery render:", { 
    nftsCount: nfts.length, 
    hasMore, 
    loading, 
    addresses: addresses?.length || 0
  });

  useEffect(() => {
    if (addresses && addresses.length > 0) {
      fetchNFTs(addresses);
    }
  }, [addresses, fetchNFTs]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearchQuery(searchText);
  };

  const handleLoadMore = () => {
    if (hasMore && !loading) {
      console.log("Manual load more clicked");
      loadMoreNFTs();
    }
  };

  if (error) {
    return (
      <div className="text-center py-8 text-sm text-gray-500">
        {error}
      </div>
    );
  }

  if (!addresses || addresses.length === 0) {
    return null;
  }

  if (!nfts.length && !loading) {
    return (
      <div className="text-center py-8 text-sm text-gray-500">
        No NFTs found for this user
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <form onSubmit={handleSearch} className="w-2/3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search by NFT or collection name"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
            <button 
              type="submit"
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </div>
        </form>
        
        <SortControls />
      </div>
      
      <NFTGrid nfts={nfts} onNFTClick={onNFTClick} />
      
      {loading && (
        <div className="flex justify-center items-center py-8">
          <LoadingSpinner size="small" />
        </div>
      )}
      
      {/* Explicit "Load More" button that's always visible when hasMore is true */}
      {hasMore && !loading && (
        <div className="mt-8 flex justify-center">
          <button 
            onClick={handleLoadMore}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition duration-200"
          >
            Load More NFTs
          </button>
        </div>
      )}
    </div>
  );
};

export default NFTGallery; 