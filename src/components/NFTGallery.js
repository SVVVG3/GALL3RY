import React, { useEffect, useRef } from 'react';
import { useNFT } from '../contexts/NFTContext';
import NFTGrid from './NFTGrid';
import LoadingSpinner from './LoadingSpinner';

/**
 * NFT Gallery component
 * Displays a grid of NFT images with pagination
 */
const NFTGallery = ({ addresses, onNFTClick }) => {
  const { nfts, loading, error, hasMore, fetchNFTs, loadMoreNFTs } = useNFT();
  const observer = useRef();
  const lastNFTRef = useRef();

  useEffect(() => {
    if (addresses && addresses.length > 0) {
      fetchNFTs(addresses);
    }
  }, [addresses, fetchNFTs]);

  useEffect(() => {
    const options = {
      root: null,
      rootMargin: '20px',
      threshold: 1.0
    };

    observer.current = new IntersectionObserver(entries => {
      const target = entries[0];
      if (target.isIntersecting && hasMore && !loading) {
        loadMoreNFTs();
      }
    }, options);

    if (lastNFTRef.current) {
      observer.current.observe(lastNFTRef.current);
    }

    return () => {
      if (observer.current) {
        observer.current.disconnect();
      }
    };
  }, [nfts, hasMore, loading, loadMoreNFTs]);

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
      <NFTGrid nfts={nfts} onNFTClick={onNFTClick} />
      
      {loading && (
        <div className="flex justify-center items-center py-8">
          <LoadingSpinner size="small" />
        </div>
      )}
      
      {hasMore && <div ref={lastNFTRef} className="h-10" />}
    </div>
  );
};

export default NFTGallery; 