import React, { createContext, useContext, useState, useCallback } from 'react';
import { fetchZapperData } from '../services/zapper';

const NFTContext = createContext();
const PAGE_SIZE = 32;

export const NFTProvider = ({ children }) => {
  const [nfts, setNfts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [selectedChains, setSelectedChains] = useState(['all']);
  const [selectedWallets, setSelectedWallets] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('collection');
  const [page, setPage] = useState(1);
  const [collectionHolders, setCollectionHolders] = useState({});

  const fetchNFTs = useCallback(async (addresses) => {
    setLoading(true);
    setError(null);
    try {
      const query = `
        query GetNFTs($addresses: [Address!]!, $first: Int!) {
          portfolioV2(addresses: $addresses) {
            nftBalances(first: $first) {
              pageInfo {
                hasNextPage
                endCursor
              }
              nfts {
                id
                name
                imageUrl
                tokenId
                collection {
                  name
                  address
                  imageUrl
                  floorPrice
                  network
                }
                estimatedValue {
                  value
                  token {
                    symbol
                  }
                }
                metadata {
                  name
                  description
                  image
                }
              }
            }
          }
        }
      `;

      const variables = {
        addresses,
        first: PAGE_SIZE
      };

      console.log('Fetching NFTs with query:', { query, variables });

      const data = await fetchZapperData(query, variables);
      console.log('Received NFT data:', data);

      if (!data?.portfolioV2?.nftBalances?.nfts) {
        console.error('Invalid NFT data structure:', data);
        throw new Error('Invalid NFT data received');
      }

      const nftsWithImages = data.portfolioV2.nftBalances.nfts.map(nft => ({
        ...nft,
        imageUrl: nft.imageUrl || nft.metadata?.image || nft.collection?.imageUrl,
        name: nft.name || nft.metadata?.name || `#${nft.tokenId}`,
        description: nft.metadata?.description || ''
      }));
      
      setNfts(nftsWithImages);
      setHasMore(data.portfolioV2.nftBalances.pageInfo.hasNextPage);
      setPage(1);
    } catch (err) {
      console.error('Error fetching NFTs:', err);
      setError(err.message || 'Failed to fetch NFTs');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMoreNFTs = useCallback(async () => {
    if (!hasMore || loading) return;

    setLoading(true);
    try {
      const query = `
        query GetMoreNFTs($addresses: [Address!]!, $first: Int!, $after: String) {
          portfolioV2(addresses: $addresses) {
            nftBalances(first: $first, after: $after) {
              pageInfo {
                hasNextPage
                endCursor
              }
              nfts {
                id
                name
                imageUrl
                tokenId
                collection {
                  name
                  address
                  imageUrl
                  floorPrice
                  network
                }
                estimatedValue {
                  value
                  token {
                    symbol
                  }
                }
                metadata {
                  name
                  description
                  image
                }
              }
            }
          }
        }
      `;

      const variables = {
        addresses: selectedWallets,
        first: PAGE_SIZE,
        after: nfts[nfts.length - 1]?.id
      };

      const data = await fetchZapperData(query, variables);
      
      const newNfts = data.portfolioV2.nftBalances.nfts.map(nft => ({
        ...nft,
        imageUrl: nft.imageUrl || nft.metadata?.image || nft.collection?.imageUrl,
        name: nft.name || nft.metadata?.name || `#${nft.tokenId}`,
        description: nft.metadata?.description || ''
      }));

      setNfts(prev => [...prev, ...newNfts]);
      setHasMore(data.portfolioV2.nftBalances.pageInfo.hasNextPage);
      setPage(p => p + 1);
    } catch (err) {
      console.error('Error loading more NFTs:', err);
      setError(err.message || 'Failed to load more NFTs');
    } finally {
      setLoading(false);
    }
  }, [hasMore, loading, nfts, selectedWallets]);

  const fetchCollectionHolders = useCallback(async (collectionAddress, userFid) => {
    setLoading(true);
    try {
      // First get user's following list
      const followingQuery = `
        query GetFollowing($fid: Int!) {
          farcasterProfile(fid: $fid) {
            following {
              edges {
                node {
                  fid
                  username
                  displayName
                  imageUrl
                  followersCount
                  custodyAddress
                  connectedAddresses
                }
              }
            }
          }
        }
      `;

      const followingData = await fetchZapperData(followingQuery, { fid: userFid });
      const following = followingData.farcasterProfile.following.edges;

      // Then check each follower for collection ownership
      const holdersQuery = `
        query CheckNFTHolding($addresses: [Address!]!, $collectionAddress: Address!) {
          portfolioV2(addresses: $addresses) {
            nftBalances(filter: { collectionAddress: $collectionAddress }) {
              totalCount
              nfts {
                id
                name
                imageUrl
              }
            }
          }
        }
      `;

      const holders = await Promise.all(
        following.map(async ({ node }) => {
          const addresses = [node.custodyAddress, ...(node.connectedAddresses || [])].filter(Boolean);
          if (!addresses.length) return null;

          const holderData = await fetchZapperData(holdersQuery, {
            addresses,
            collectionAddress
          });
          
          if (holderData.portfolioV2.nftBalances.totalCount > 0) {
            return {
              ...node,
              holdingCount: holderData.portfolioV2.nftBalances.totalCount,
              nfts: holderData.portfolioV2.nftBalances.nfts
            };
          }
          return null;
        })
      );

      const filteredHolders = holders.filter(Boolean).sort((a, b) => b.followersCount - a.followersCount);
      setCollectionHolders({ [collectionAddress]: filteredHolders });
      return filteredHolders;
    } catch (err) {
      console.error('Failed to fetch collection holders:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const value = {
    nfts,
    loading,
    error,
    hasMore,
    selectedChains,
    selectedWallets,
    searchQuery,
    sortBy,
    collectionHolders,
    setSelectedChains,
    setSelectedWallets,
    setSearchQuery,
    setSortBy,
    fetchNFTs,
    fetchCollectionHolders,
    resetFilters: () => {
      setSelectedChains(['all']);
      setSelectedWallets([]);
      setSearchQuery('');
      setSortBy('collection');
    },
    loadMoreNFTs
  };

  return <NFTContext.Provider value={value}>{children}</NFTContext.Provider>;
};

export const useNFT = () => {
  const context = useContext(NFTContext);
  if (!context) {
    throw new Error('useNFT must be used within an NFTProvider');
  }
  return context;
}; 