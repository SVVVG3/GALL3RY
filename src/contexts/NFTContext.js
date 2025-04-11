import React, { createContext, useContext, useState, useCallback } from 'react';
import { fetchZapperData } from '../services/zapper';

const NFTContext = createContext();

export const NFTProvider = ({ children }) => {
  const [nfts, setNfts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [selectedChains, setSelectedChains] = useState(['all']);
  const [selectedWallets, setSelectedWallets] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('collection'); // Add default sort
  const [page, setPage] = useState(1);
  const [collectionHolders, setCollectionHolders] = useState({});

  const fetchNFTs = useCallback(async (addresses) => {
    setLoading(true);
    setError(null);
    try {
      const query = `
        query GetNFTs($addresses: [Address!]!, $orderBy: PortfolioV2NftOrderByOption!) {
          portfolioV2(addresses: $addresses) {
            nftBalances(orderBy: { by: $orderBy }) {
              nfts {
                id
                name
                description
                imageUrl
                tokenId
                collection {
                  name
                  address
                  imageUrl
                  floorPrice
                  network
                }
                lastReceivedAt
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
                  attributes {
                    trait_type
                    value
                  }
                }
              }
            }
          }
        }
      `;

      const variables = {
        addresses,
        orderBy: sortBy === 'recent' ? 'LAST_RECEIVED' : 'USD_WORTH'
      };

      const data = await fetchZapperData(query, variables);
      const nftsWithImages = data.portfolioV2.nftBalances.nfts.map(nft => ({
        ...nft,
        imageUrl: nft.imageUrl || nft.metadata?.image || nft.collection?.imageUrl
      }));
      setNfts(nftsWithImages);
      setHasMore(nftsWithImages.length === 20);
      setPage(1);
    } catch (err) {
      setError('Failed to fetch NFTs');
      console.error(err);
    }
    setLoading(false);
  }, [sortBy]);

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
    }
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