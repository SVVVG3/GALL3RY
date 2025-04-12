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
      // Use the nftUsersTokens query which is still supported in Zapper API
      const query = `
        query NftUsersTokens($owners: [Address!]!, $first: Int, $withOverrides: Boolean) {
          nftUsersTokens(
            owners: $owners
            first: $first
            withOverrides: $withOverrides
          ) {
            edges {
              node {
                id
                name
                tokenId
                description
                mediasV2 {
                  ... on Image {
                    url
                    originalUri
                    original
                  }
                  ... on Animation {
                    url
                    originalUri
                    original
                  }
                }
                collection {
                  id
                  name
                  floorPriceEth
                  cardImageUrl
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

      const variables = {
        owners: addresses,
        first: PAGE_SIZE,
        withOverrides: true
      };

      console.log('Fetching NFTs with query:', { query, variables });

      const data = await fetchZapperData(query, variables);
      console.log('Received NFT data:', data);

      if (!data?.nftUsersTokens?.edges) {
        console.error('Invalid NFT data structure:', data);
        throw new Error('Invalid NFT data received');
      }

      const nftsWithImages = data.nftUsersTokens.edges.map(edge => {
        const node = edge.node;
        if (!node) return null;
        
        // Create a normalized NFT object that combines data from all possible sources
        return {
          id: node.id,
          tokenId: node.tokenId,
          name: node.name || `#${node.tokenId}`,
          description: node.description,
          cursor: edge.cursor,
          // Handle different image sources
          imageUrl: node.mediasV2 && node.mediasV2.length > 0 ? 
            (node.mediasV2[0].url || node.mediasV2[0].original || node.mediasV2[0].originalUri) : 
            node.collection?.cardImageUrl,
          collection: {
            id: node.collection?.id,
            name: node.collection?.name || 'Unknown Collection',
            address: node.collection?.address,
            imageUrl: node.collection?.cardImageUrl,
            floorPriceEth: node.collection?.floorPriceEth
          },
          // Add estimated value for sorting
          estimatedValue: {
            value: node.collection?.floorPriceEth || 0,
            symbol: 'ETH'
          }
        };
      }).filter(Boolean);
      
      setNfts(nftsWithImages);
      setHasMore(data.nftUsersTokens.pageInfo.hasNextPage);
      setPage(1);
      setSelectedWallets(addresses);
    } catch (err) {
      console.error('Error fetching NFTs:', err);
      setError(err.message || 'Failed to fetch NFTs');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMoreNFTs = useCallback(async () => {
    if (!hasMore || loading || !selectedWallets.length) return;

    setLoading(true);
    try {
      // Get the cursor of the last NFT
      const lastCursor = nfts.length > 0 ? nfts[nfts.length - 1].cursor : null;
      
      if (!lastCursor) {
        console.warn('No cursor available for pagination');
        setHasMore(false);
        return;
      }

      // Query for the next page
      const query = `
        query NftUsersTokens($owners: [Address!]!, $first: Int, $after: String, $withOverrides: Boolean) {
          nftUsersTokens(
            owners: $owners
            first: $first
            after: $after
            withOverrides: $withOverrides
          ) {
            edges {
              node {
                id
                name
                tokenId
                description
                mediasV2 {
                  ... on Image {
                    url
                    originalUri
                    original
                  }
                  ... on Animation {
                    url
                    originalUri
                    original
                  }
                }
                collection {
                  id
                  name
                  floorPriceEth
                  cardImageUrl
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

      const variables = {
        owners: selectedWallets,
        first: PAGE_SIZE,
        after: lastCursor,
        withOverrides: true
      };

      console.log('Loading more NFTs:', variables);

      const data = await fetchZapperData(query, variables);
      
      if (!data?.nftUsersTokens?.edges) {
        throw new Error('Invalid response format');
      }
      
      const newNfts = data.nftUsersTokens.edges.map(edge => {
        const node = edge.node;
        if (!node) return null;
        
        return {
          id: node.id,
          tokenId: node.tokenId,
          name: node.name || `#${node.tokenId}`,
          description: node.description,
          cursor: edge.cursor,
          imageUrl: node.mediasV2 && node.mediasV2.length > 0 ? 
            (node.mediasV2[0].url || node.mediasV2[0].original || node.mediasV2[0].originalUri) : 
            node.collection?.cardImageUrl,
          collection: {
            id: node.collection?.id,
            name: node.collection?.name || 'Unknown Collection',
            address: node.collection?.address,
            imageUrl: node.collection?.cardImageUrl,
            floorPriceEth: node.collection?.floorPriceEth
          },
          estimatedValue: {
            value: node.collection?.floorPriceEth || 0,
            symbol: 'ETH'
          }
        };
      }).filter(Boolean);

      setNfts(prev => [...prev, ...newNfts]);
      setHasMore(data.nftUsersTokens.pageInfo.hasNextPage);
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

      // Prepare the collection ID/address properly
      let collectionIdentifier = collectionAddress;
      
      // If it's a complex ID like "ethereum-0x123...", extract just the address part
      if (collectionAddress.includes('-')) {
        collectionIdentifier = collectionAddress.split('-')[1];
      }
      
      console.log("Using collection identifier:", collectionIdentifier);

      // Query for holders of this collection - notice we're not using collectionIds directly
      // as that was causing issues. Instead, we query against the node.collection.id
      const holdersQuery = `
        query NftUsersTokens($owners: [Address!]!, $first: Int, $withOverrides: Boolean) {
          nftUsersTokens(
            owners: $owners
            first: $first
            withOverrides: $withOverrides
          ) {
            edges {
              node {
                id
                name
                tokenId
                collection {
                  id
                  name
                  address
                }
              }
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
          const holderVariables = {
            owners: addresses,
            first: 100,  // Get up to 100 NFTs per user
            withOverrides: true
          };
          
          console.log("Query variables:", holderVariables);
          
          const holderData = await fetchZapperData(holdersQuery, holderVariables);
          
          // Check for edges in the response
          const edges = holderData.nftUsersTokens?.edges || [];
          
          // Now filter the NFTs to only include those from our target collection
          const matchingNfts = edges
            .map(edge => edge.node)
            .filter(nft => {
              if (!nft || !nft.collection) return false;
              
              // Check if this NFT is from our target collection
              // Compare both the ID and address to be safe
              const collectionId = nft.collection.id;
              const collectionAddr = nft.collection.address;
              
              return (
                (collectionId && collectionId.includes(collectionIdentifier)) ||
                (collectionAddr && collectionAddr.toLowerCase() === collectionIdentifier.toLowerCase())
              );
            });
          
          const totalCount = matchingNfts.length;
          
          console.log(`Holdings result for ${node.username}:`, { 
            totalCount,
            matchingCollection: collectionIdentifier
          });
          
          successfulChecks++;
          
          if (totalCount > 0) {
            return {
              ...node,
              holdingCount: totalCount,
              nfts: matchingNfts,
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
          // Get values, defaulting to 0 if missing
          const valueA = a.estimatedValue?.value || a.collection?.floorPriceEth || 0;
          const valueB = b.estimatedValue?.value || b.collection?.floorPriceEth || 0;
          
          // Convert to numbers if they're strings
          const numA = typeof valueA === 'string' ? parseFloat(valueA) : valueA;
          const numB = typeof valueB === 'string' ? parseFloat(valueB) : valueB;
          
          // Sort descending (highest value first)
          return numB - numA;
        });
        break;
        
      case 'recent':
        // Sort by most recently received NFTs
        // For our purposes:
        // 1. We'll use the cursor as a loose proxy for recency when timestamps aren't available
        // 2. Higher cursor values are generally more recent in GraphQL pagination
        sortedNFTs.sort((a, b) => {
          // If we have actual timestamps, use those first
          if (a.receivedAt && b.receivedAt) {
            return new Date(b.receivedAt) - new Date(a.receivedAt);
          }
          
          // Then try latestTransferTimestamp
          if (a.latestTransferTimestamp && b.latestTransferTimestamp) {
            return b.latestTransferTimestamp - a.latestTransferTimestamp;
          }
          
          // As a last resort, use cursor values as a proxy for recency
          // This isn't perfect but is better than random ordering
          if (a.cursor && b.cursor) {
            // In GraphQL cursors are often base64 encoded and longer ones tend to be newer
            return b.cursor.length - a.cursor.length || b.cursor.localeCompare(a.cursor);
          }
          
          // If no good sorting criteria, preserve original order
          return 0;
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