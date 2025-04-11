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
                transfers {
                  edges {
                    node {
                      timestamp
                      from
                      to
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
        first: PAGE_SIZE
      };

      console.log('Fetching NFTs with query:', { query, variables });

      const data = await fetchZapperData(query, variables);
      console.log('Received NFT data:', data);

      if (!data?.portfolioV2?.nftBalances?.nfts) {
        console.error('Invalid NFT data structure:', data);
        throw new Error('Invalid NFT data received');
      }

      const nftsWithImages = data.portfolioV2.nftBalances.nfts.map(nft => {
        // Extract the most recent transfer timestamp
        let latestTransferTimestamp = null;
        if (nft.transfers && nft.transfers.edges && nft.transfers.edges.length > 0) {
          latestTransferTimestamp = Math.max(...nft.transfers.edges.map(edge => edge.node.timestamp));
        }

        return {
          ...nft,
          imageUrl: nft.imageUrl || nft.metadata?.image || nft.collection?.imageUrl,
          name: nft.name || nft.metadata?.name || `#${nft.tokenId}`,
          description: nft.metadata?.description || '',
          latestTransferTimestamp
        };
      });
      
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
    console.log("fetchCollectionHolders called with:", { collectionAddress, userFid });
    
    // Validate collection address and user FID
    if (!collectionAddress) {
      console.error("Missing collection address");
      throw new Error("Collection address is required");
    }
    
    if (!userFid) {
      console.error("Missing user FID");
      throw new Error("User FID is required");
    }
    
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
            followers {
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

      // Make sure userFid is a number
      const parsedFid = parseInt(userFid, 10);
      if (isNaN(parsedFid)) {
        console.error("Invalid FID provided:", userFid);
        throw new Error(`Invalid FID: ${userFid}`);
      }

      console.log("Fetching profile data for FID:", parsedFid);
      const profileData = await fetchZapperData(followingQuery, { fid: parsedFid });
      console.log("Profile data received:", profileData);
      
      if (!profileData || !profileData.farcasterProfile) {
        console.error("Invalid profile data received:", profileData);
        throw new Error("Invalid profile data");
      }
      
      const following = profileData.farcasterProfile.following.edges || [];
      const followers = profileData.farcasterProfile.followers.edges || [];
      
      console.log("Relationship counts:", { 
        followingCount: following.length, 
        followersCount: followers.length 
      });

      // If collectionAddress is numeric (extracted from base64 ID), 
      // we'll need to use a different query approach
      // Let's use a numeric ID query for the Zapper API
      const holdersQuery = `
        query CheckNFTHolding($addresses: [Address!]!, $collectionIds: [Int!]) {
          portfolioV2(addresses: $addresses) {
            nftBalances(filter: { collectionIds: $collectionIds }) {
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

      // Convert collectionAddress to collectionIds parameter if it's numeric
      const variables = {
        addresses: [],
        collectionIds: [parseInt(collectionAddress, 10)]
      };

      if (isNaN(variables.collectionIds[0])) {
        // If it's not a valid number, fall back to using address
        console.log("Using address instead of collection ID:", collectionAddress);
        delete variables.collectionIds;
        variables.collectionAddress = collectionAddress;
      } else {
        console.log("Using collection ID:", variables.collectionIds[0]);
      }

      // Process following list
      const followingHolders = await Promise.all(
        following.map(async ({ node }) => {
          const addresses = [node.custodyAddress, ...(node.connectedAddresses || [])].filter(Boolean);
          if (!addresses.length) return null;

          // Clone the variables and add the addresses
          const holderVariables = {...variables, addresses};
          
          const holderData = await fetchZapperData(holdersQuery, holderVariables);
          
          if (holderData.portfolioV2.nftBalances.totalCount > 0) {
            return {
              ...node,
              holdingCount: holderData.portfolioV2.nftBalances.totalCount,
              nfts: holderData.portfolioV2.nftBalances.nfts,
              relationship: 'following'
            };
          }
          return null;
        })
      );

      // Process followers list
      const followerHolders = await Promise.all(
        followers.map(async ({ node }) => {
          const addresses = [node.custodyAddress, ...(node.connectedAddresses || [])].filter(Boolean);
          if (!addresses.length) return null;

          // Clone the variables and add the addresses
          const holderVariables = {...variables, addresses};
          
          const holderData = await fetchZapperData(holdersQuery, holderVariables);
          
          if (holderData.portfolioV2.nftBalances.totalCount > 0) {
            return {
              ...node,
              holdingCount: holderData.portfolioV2.nftBalances.totalCount,
              nfts: holderData.portfolioV2.nftBalances.nfts,
              relationship: 'follower'
            };
          }
          return null;
        })
      );

      // Combine and filter out null values, sort by followers count
      const filteredFollowingHolders = followingHolders.filter(Boolean);
      const filteredFollowerHolders = followerHolders.filter(Boolean);
      
      // Identify mutual connections (both following and followers)
      const mutualHolderIds = new Set();
      
      filteredFollowingHolders.forEach(following => {
        const isAlsoFollower = filteredFollowerHolders.some(follower => follower.fid === following.fid);
        if (isAlsoFollower) {
          mutualHolderIds.add(following.fid);
          following.relationship = 'mutual';
        }
      });
      
      filteredFollowerHolders.forEach(follower => {
        if (mutualHolderIds.has(follower.fid)) {
          follower.relationship = 'mutual';
        }
      });
      
      // Remove duplicates (when someone is both a follower and following)
      const allHolders = [
        ...filteredFollowingHolders,
        ...filteredFollowerHolders.filter(follower => !mutualHolderIds.has(follower.fid))
      ].sort((a, b) => b.followersCount - a.followersCount);

      setCollectionHolders({ [collectionAddress]: allHolders });
      return allHolders;
    } catch (err) {
      console.error('Failed to fetch collection holders:', err);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Function to get sorted NFTs based on current sort setting
  const getSortedNFTs = useCallback(() => {
    if (!nfts || nfts.length === 0) return [];

    // Apply search filter if provided
    let filteredNFTs = nfts;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filteredNFTs = nfts.filter(nft => 
        (nft.name && nft.name.toLowerCase().includes(query)) ||
        (nft.collection?.name && nft.collection.name.toLowerCase().includes(query))
      );
    }
    
    // Apply chain filter if not 'all'
    if (selectedChains.length > 0 && !selectedChains.includes('all')) {
      filteredNFTs = filteredNFTs.filter(nft => {
        const network = nft.collection?.network?.toLowerCase();
        if (!network) return false;
        
        // Match chain to network (eth, base, etc)
        return selectedChains.some(chain => network.includes(chain.toLowerCase()));
      });
    }

    // Apply sorting
    let sortedNFTs = [...filteredNFTs];
    
    switch (sortBy) {
      case 'a-z':
        // Sort alphabetically by name
        sortedNFTs.sort((a, b) => {
          const nameA = (a.name || '').toLowerCase();
          const nameB = (b.name || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });
        break;
        
      case 'collection':
        // Sort by collection name
        sortedNFTs.sort((a, b) => {
          const nameA = (a.collection?.name || '').toLowerCase();
          const nameB = (b.collection?.name || '').toLowerCase();
          return nameA.localeCompare(nameB);
        });
        break;
        
      case 'value':
        // Sort by estimated value (high to low)
        sortedNFTs.sort((a, b) => {
          const valueA = a.estimatedValue?.value || 0;
          const valueB = b.estimatedValue?.value || 0;
          return valueB - valueA;
        });
        break;
        
      case 'recent':
        // Sort by most recent transfer (latest first)
        sortedNFTs.sort((a, b) => {
          const timestampA = a.latestTransferTimestamp || 0;
          const timestampB = b.latestTransferTimestamp || 0;
          return timestampB - timestampA;
        });
        break;
        
      default:
        // Default sorting
        break;
    }
    
    return sortedNFTs;
  }, [nfts, searchQuery, selectedChains, sortBy]);

  const value = {
    nfts: getSortedNFTs(),
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