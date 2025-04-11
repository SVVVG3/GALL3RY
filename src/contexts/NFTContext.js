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

      // Log some sample addresses to verify we have them
      if (following.length > 0) {
        const sampleFollowing = following.slice(0, 3);
        console.log("Sample following addresses:", sampleFollowing.map(f => ({
          username: f.node.username,
          custodyAddress: f.node.custodyAddress,
          connectedAddresses: f.node.connectedAddresses
        })));
      }

      // Parse collection address/ID
      const collectionId = parseInt(collectionAddress, 10);
      const isNumericCollection = !isNaN(collectionId);
      
      console.log("Collection identification:", {
        original: collectionAddress,
        parsedId: collectionId,
        isNumeric: isNumericCollection
      });

      // According to the Zapper API schema, we should use nftUsersTokens query with collectionIds
      const holdersQuery = `
        query CheckNFTHolding($owners: [Address!]!, $collectionIds: [ID!]) {
          nftUsersTokens(
            owners: $owners,
            collectionIds: $collectionIds,
            first: 100
          ) {
            edges {
              node {
                id
                name
                tokenId
                imageUrl
                collection {
                  id
                  name
                  imageUrl
                }
              }
              cursor
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `;

      // Monitor successful queries
      let successfulChecks = 0;
      let failedChecks = 0;

      // Helper function to check one user's addresses
      const checkUserHoldings = async (node, relationshipType) => {
        const addresses = [node.custodyAddress, ...(node.connectedAddresses || [])].filter(Boolean);
        
        if (!addresses.length) {
          console.log(`No addresses for ${node.username}`);
          return null;
        }
        
        // Log which addresses we're checking
        console.log(`Checking ${relationshipType} ${node.username} with addresses:`, addresses);
        
        try {
          // Create proper query variables based on the schema
          const holderVariables = {
            owners: addresses,
            collectionIds: [isNumericCollection ? String(collectionId) : collectionAddress]
          };
          
          console.log("Query variables:", holderVariables);
          
          const holderData = await fetchZapperData(holdersQuery, holderVariables);
          
          // Check for edges in the response
          const edges = holderData.nftUsersTokens?.edges || [];
          const totalCount = edges.length;
          
          console.log(`Holdings result for ${node.username}:`, { 
            totalCount, 
            hasData: !!holderData.nftUsersTokens 
          });
          
          successfulChecks++;
          
          if (totalCount > 0) {
            // Extract all NFTs from the edges
            const nfts = edges.map(edge => edge.node).filter(Boolean);
            
            return {
              ...node,
              holdingCount: totalCount,
              nfts,
              relationship: relationshipType
            };
          }
        } catch (error) {
          console.error(`Error checking holdings for ${node.username}:`, error);
          failedChecks++;
        }
        
        return null;
      };

      // Process following list (with better error handling)
      const followingHolders = await Promise.all(
        following.map(({ node }) => checkUserHoldings(node, 'following'))
      );

      // Process followers list
      const followerHolders = await Promise.all(
        followers.map(({ node }) => checkUserHoldings(node, 'follower'))
      );
      
      console.log(`Holdings check stats: ${successfulChecks} successful, ${failedChecks} failed`);

      // Combine and filter out null values, sort by followers count
      const filteredFollowingHolders = followingHolders.filter(Boolean);
      const filteredFollowerHolders = followerHolders.filter(Boolean);
      
      console.log("Filtered holder counts:", {
        following: filteredFollowingHolders.length,
        followers: filteredFollowerHolders.length
      });
      
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

      console.log("Final holders list:", allHolders);
      
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