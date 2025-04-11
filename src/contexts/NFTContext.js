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
  const [sortBy, setSortBy] = useState('collection');
  const [page, setPage] = useState(1);
  const [collectionHolders, setCollectionHolders] = useState({});

  const fetchNFTs = useCallback(async (addresses) => {
    setLoading(true);
    setError(null);
    try {
      const query = `
        query getNFTsForUser($addresses: [Address!]!, $first: Int!) {
          nftUsersTokens(
            owners: $addresses
            first: $first
            input: {
              owners: $addresses
              first: $first
              withOverrides: true
            }
          ) {
            edges {
              node {
                token {
                  id
                  tokenId
                  name
                  description
                  estimatedValue {
                    value
                    currency
                  }
                  collection {
                    name
                    address
                    imageUrl
                    floorPrice
                    network
                  }
                  media {
                    url
                    type
                    format
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
        }
      `;

      const variables = {
        addresses,
        first: 100
      };

      const data = await fetchZapperData(query, variables);
      
      // Transform the response to match our component expectations
      const transformedNfts = data.nftUsersTokens.edges.map(edge => ({
        id: edge.node.token.id,
        name: edge.node.token.name || edge.node.token.metadata?.name,
        description: edge.node.token.description || edge.node.token.metadata?.description,
        imageUrl: edge.node.token.media?.[0]?.url || edge.node.token.metadata?.image || edge.node.token.collection?.imageUrl,
        tokenId: edge.node.token.tokenId,
        collection: edge.node.token.collection,
        estimatedValue: edge.node.token.estimatedValue,
        metadata: edge.node.token.metadata
      }));

      setNfts(transformedNfts);
      setHasMore(transformedNfts.length === 100);
      setPage(1);
    } catch (err) {
      setError('Failed to fetch NFTs');
      console.error(err);
    }
    setLoading(false);
  }, []);

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