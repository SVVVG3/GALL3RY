import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '../hooks/useDebounce';
import { useInView } from 'react-intersection-observer';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { API_URL } from '../config';
import alchemyService from '../services/alchemyService';

const ZapperSearch = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const [selectedChain, setSelectedChain] = useState(searchParams.get('chain') || 'all');
  const debouncedSearchTerm = useDebounce(searchTerm, 500);
  const { ref, inView } = useInView();

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    error
  } = useInfiniteQuery({
    queryKey: ['nfts', debouncedSearchTerm, selectedChain],
    queryFn: async ({ pageParam = null }) => {
      try {
        // Use Alchemy API (via our service) to fetch NFTs
        const network = selectedChain === 'all' ? 'ethereum' : selectedChain;
        const result = await alchemyService.getNftsForOwner(debouncedSearchTerm, {
          network,
          pageKey: pageParam,
          pageSize: 24
        });

        // Transform the data to match our component's expectations
        return {
          items: (result.ownedNfts || []).map(nft => ({
            id: `${nft.contract.address}-${nft.tokenId}`,
            name: nft.title || `#${nft.tokenId}`,
            description: nft.description,
            imageUrl: nft.media[0]?.gateway || nft.media[0]?.raw,
            collection: nft.contract.name || 'Unknown Collection',
            value: nft.price?.floorPrice ? (nft.price.floorPrice.amount * nft.price.floorPrice.ethUsd) : null,
            valueEth: nft.price?.floorPrice?.amount
          })),
          nextPage: result.pageKey
        };
      } catch (err) {
        console.error('Error fetching NFTs:', err);
        throw new Error(err.message || 'Failed to fetch NFTs');
      }
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    enabled: debouncedSearchTerm.length >= 42, // Only enable for Ethereum addresses (0x + 40 chars)
  });

  React.useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  React.useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearchTerm) params.set('q', debouncedSearchTerm);
    if (selectedChain !== 'all') params.set('chain', selectedChain);
    setSearchParams(params);
  }, [debouncedSearchTerm, selectedChain, setSearchParams]);

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleChainChange = (e) => {
    setSelectedChain(e.target.value);
  };

  if (isError) {
    return (
      <div className="text-red-500 p-4 border border-red-300 rounded bg-red-50">
        <h3 className="font-bold mb-2">Error</h3>
        <p>{error.message}</p>
        <p className="text-sm mt-2">Please make sure you've entered a valid Ethereum address.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <input
          type="text"
          value={searchTerm}
          onChange={handleSearch}
          placeholder="Enter Ethereum address..."
          className="flex-1 p-2 border rounded"
        />
        <select
          value={selectedChain}
          onChange={handleChainChange}
          className="p-2 border rounded"
        >
          <option value="all">All Chains</option>
          <option value="ethereum">Ethereum</option>
          <option value="polygon">Polygon</option>
          <option value="optimism">Optimism</option>
          <option value="arbitrum">Arbitrum</option>
          <option value="base">Base</option>
        </select>
      </div>

      {isLoading ? (
        <div className="text-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2">Loading NFTs...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data?.pages.map((page, i) => (
            <React.Fragment key={i}>
              {page.items.map((item) => (
                <div key={item.id} className="border rounded p-4 hover:shadow-lg transition-shadow">
                  {item.imageUrl && (
                    <img 
                      src={item.imageUrl} 
                      alt={item.name}
                      className="w-full h-48 object-cover rounded mb-2"
                      onError={(e) => {
                        e.target.src = 'https://via.placeholder.com/400x300?text=No+Image';
                      }}
                    />
                  )}
                  <h3 className="font-bold">{item.name}</h3>
                  <p className="text-sm text-gray-600">{item.collection}</p>
                  {item.description && (
                    <p className="text-sm mt-2 line-clamp-2">{item.description}</p>
                  )}
                  <div className="mt-2 flex justify-between">
                    {item.value && (
                      <span className="text-sm text-gray-500">
                        Value: ${parseFloat(item.value).toFixed(2)}
                      </span>
                    )}
                    {item.valueEth && (
                      <span className="text-sm text-gray-500">
                        {parseFloat(item.valueEth).toFixed(4)} ETH
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      )}

      <div ref={ref} className="h-10">
        {isFetchingNextPage && (
          <div className="text-center p-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-500">Loading more...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ZapperSearch; 