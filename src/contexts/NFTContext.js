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
      // Simplified query with proper format for the current Zapper API
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
                  address
                  floorPriceEth
                  cardImageUrl
                }
                estimatedValue {
                  valueWithDenomination
                  denomination {
                    symbol
                  }
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

      // Simple variables with exactly what the API expects
      const variables = {
        owners: addresses,
        first: PAGE_SIZE,
        withOverrides: true
      };

      console.log('Fetching NFTs with query:', { 
        queryType: 'nftUsersTokens',
        addressCount: addresses.length
      });

      const data = await fetchZapperData(query, variables);
      console.log('Received NFT data:', { 
        hasData: !!data,
        hasEdges: !!data?.nftUsersTokens?.edges,
        edgeCount: data?.nftUsersTokens?.edges?.length,
        hasNextPage: data?.nftUsersTokens?.pageInfo?.hasNextPage
      });

      if (!data?.nftUsersTokens?.edges) {
        console.error('Invalid NFT data structure:', data);
        throw new Error('Invalid NFT data received');
      }

      // Process the response data correctly
      const nftsWithImages = data.nftUsersTokens.edges.map(edge => {
        const node = edge.node;
        if (!node) return null;
        
        // Get the best available image
        let imageUrl = null;
        if (node.mediasV2 && node.mediasV2.length > 0) {
          const media = node.mediasV2[0];
          imageUrl = media.url || media.original || media.originalUri;
        }
        
        if (!imageUrl && node.collection?.cardImageUrl) {
          imageUrl = node.collection.cardImageUrl;
        }
        
        // Extract the estimated value - prioritize the new format
        let estimatedValue = {
          value: node.collection?.floorPriceEth || 0,
          symbol: 'ETH'
        };
        
        // Check for the new format from the API
        if (node.estimatedValue?.valueWithDenomination) {
          estimatedValue = {
            value: node.estimatedValue.valueWithDenomination,
            symbol: node.estimatedValue.denomination?.symbol || 'ETH'
          };
        }
        
        // Create the normalized NFT object
        return {
          id: node.id,
          tokenId: node.tokenId,
          name: node.name || `#${node.tokenId}`,
          description: node.description,
          cursor: edge.cursor,
          imageUrl: imageUrl,
          collection: {
            id: node.collection?.id,
            name: node.collection?.name || 'Unknown Collection',
            address: node.collection?.address,
            imageUrl: node.collection?.cardImageUrl,
            floorPriceEth: node.collection?.floorPriceEth
          },
          // Add estimated value for sorting
          estimatedValue: estimatedValue
        };
      }).filter(Boolean);
      
      // Deduplicate NFTs in the frontend as well
      const uniqueNfts = deduplicateNftsArray(nftsWithImages);
      console.log(`Deduplicated NFTs: ${uniqueNfts.length} (removed ${nftsWithImages.length - uniqueNfts.length} duplicates)`);
      
      // Make sure we set hasMore correctly
      const hasNextPage = data.nftUsersTokens.pageInfo?.hasNextPage === true;
      console.log(`Setting hasMore to: ${hasNextPage ? 'true' : 'false'}`);
      
      setNfts(uniqueNfts);
      setHasMore(hasNextPage);
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
    // Only proceed if there are more NFTs to load
    if (!hasMore || loading || !selectedWallets.length) {
      console.log('Not loading more NFTs:', { hasMore, loading, selectedWalletsCount: selectedWallets.length });
      return;
    }

    setLoading(true);
    try {
      // Get the endCursor from the last batch - more reliable than the last item's cursor
      const endCursor = nfts.length > 0 ? nfts[nfts.length - 1].cursor : null;
      
      if (!endCursor) {
        console.warn('No cursor available for pagination');
        setHasMore(false);
        return;
      }

      // Use endCursor for the after parameter
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
                  address
                  floorPriceEth
                  cardImageUrl
                }
                estimatedValue {
                  valueWithDenomination
                  denomination {
                    symbol
                  }
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
        after: endCursor,
        withOverrides: true
      };

      console.log('Loading more NFTs:', { 
        endCursor,
        selectedWallets: selectedWallets.length
      });

      const data = await fetchZapperData(query, variables);
      
      if (!data?.nftUsersTokens?.edges) {
        throw new Error('Invalid response format');
      }
      
      console.log('Received more NFT data:', { 
        edgeCount: data.nftUsersTokens.edges.length,
        hasNextPage: data.nftUsersTokens.pageInfo?.hasNextPage
      });
      
      // Process the new batch of NFTs
      const newNfts = data.nftUsersTokens.edges.map(edge => {
        const node = edge.node;
        if (!node) return null;
        
        // Get the best available image
        let imageUrl = null;
        if (node.mediasV2 && node.mediasV2.length > 0) {
          const media = node.mediasV2[0];
          imageUrl = media.url || media.original || media.originalUri;
        }
        
        if (!imageUrl && node.collection?.cardImageUrl) {
          imageUrl = node.collection.cardImageUrl;
        }
        
        // Extract the estimated value - prioritize the new format
        let estimatedValue = {
          value: node.collection?.floorPriceEth || 0,
          symbol: 'ETH'
        };
        
        // Check for the new format from the API
        if (node.estimatedValue?.valueWithDenomination) {
          estimatedValue = {
            value: node.estimatedValue.valueWithDenomination,
            symbol: node.estimatedValue.denomination?.symbol || 'ETH'
          };
        }
        
        return {
          id: node.id,
          tokenId: node.tokenId,
          name: node.name || `#${node.tokenId}`,
          description: node.description,
          cursor: edge.cursor,
          imageUrl: imageUrl,
          collection: {
            id: node.collection?.id,
            name: node.collection?.name || 'Unknown Collection',
            address: node.collection?.address,
            imageUrl: node.collection?.cardImageUrl,
            floorPriceEth: node.collection?.floorPriceEth
          },
          estimatedValue: estimatedValue
        };
      }).filter(Boolean);

      // Check if we actually received new NFTs
      if (newNfts.length === 0) {
        console.log('No additional NFTs received, setting hasMore to false');
        setHasMore(false);
        return;
      }

      console.log(`Loaded ${newNfts.length} more NFTs`);
      
      // Deduplicate new NFTs against existing ones
      const allNfts = [...nfts, ...newNfts];
      const uniqueAllNfts = deduplicateNftsArray(allNfts);
      
      console.log(`Combined ${nfts.length} existing + ${newNfts.length} new = ${allNfts.length} total NFTs`);
      console.log(`After deduplication: ${uniqueAllNfts.length} unique NFTs`);
      
      // Get the hasMore value from the API response
      const hasNextPage = data.nftUsersTokens.pageInfo?.hasNextPage === true;
      console.log(`Setting hasMore to: ${hasNextPage ? 'true' : 'false'}`);
      
      // Append the deduplicated NFTs to the existing list
      setNfts(uniqueAllNfts);
      setHasMore(hasNextPage);
      setPage(p => p + 1);
    } catch (err) {
      console.error('Error loading more NFTs:', err);
      setError(err.message || 'Failed to load more NFTs');
    } finally {
      setLoading(false);
    }
  }, [hasMore, loading, nfts, selectedWallets]);

  // Helper function to deduplicate NFTs by collection address + token ID
  const deduplicateNftsArray = useCallback((nftsArray) => {
    const uniqueMap = new Map();
    const uniqueNfts = [];
    
    for (const nft of nftsArray) {
      const collectionAddr = nft.collection?.address || '';
      const tokenId = nft.tokenId || '';
      const uniqueKey = `${collectionAddr.toLowerCase()}-${tokenId}`;
      
      if (!uniqueMap.has(uniqueKey)) {
        uniqueMap.set(uniqueKey, true);
        uniqueNfts.push(nft);
      }
    }
    
    return uniqueNfts;
  }, []);

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
      console.log("Profile data received:", {
        hasFollowing: !!profileData?.farcasterProfile?.following?.edges,
        hasFollowers: !!profileData?.farcasterProfile?.followers?.edges,
      });
      
      if (!profileData || !profileData.farcasterProfile) {
        console.error("Invalid profile data received:", profileData);
        throw new Error("Invalid profile data");
      }
      
      const following = profileData.farcasterProfile.following?.edges || [];
      const followers = profileData.farcasterProfile.followers?.edges || [];
      
      console.log("Relationship counts:", { 
        followingCount: following.length, 
        followersCount: followers.length 
      });

      // Normalize the collection address for comparison
      let collectionIdentifier = collectionAddress.toLowerCase();
      
      // If it's already a complex ID like "ethereum-0x123...", extract just the address part
      if (collectionIdentifier.includes('-')) {
        collectionIdentifier = collectionIdentifier.split('-')[1].toLowerCase();
      }
      
      // Handle special characters in collection address
      collectionIdentifier = collectionIdentifier.replace(/[^a-z0-9]/g, '');
      
      console.log("Using normalized collection identifier:", collectionIdentifier);

      // Enhanced query to check if a user owns NFTs from this collection
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

      // Helper function to check one user's addresses
      const checkUserHoldings = async (node, relationshipType) => {
        if (!node.username) {
          console.log("Skipping user with no username");
          return null;
        }
        
        const addresses = [node.custodyAddress, ...(node.connectedAddresses || [])].filter(Boolean);
        
        if (!addresses.length) {
          console.log(`No addresses for ${node.username}`);
          return null;
        }
        
        console.log(`Checking ${relationshipType} ${node.username} with ${addresses.length} addresses`);
        
        try {
          const holderVariables = {
            owners: addresses,
            first: 100,  // Get up to 100 NFTs per user
            withOverrides: true
          };
          
          const holderData = await fetchZapperData(holdersQuery, holderVariables);
          
          // Check for edges in the response
          const edges = holderData.nftUsersTokens?.edges || [];
          console.log(`${node.username} has ${edges.length} total NFTs`);
          
          // Now filter the NFTs to only include those from our target collection
          const matchingNfts = edges
            .map(edge => edge.node)
            .filter(nft => {
              if (!nft || !nft.collection) return false;
              
              // Check collection ID, which may contain the address
              const collectionId = (nft.collection.id || '').toLowerCase().replace(/[^a-z0-9]/g, '');
              // Check direct collection address
              const collectionAddr = (nft.collection.address || '').toLowerCase().replace(/[^a-z0-9]/g, '');
              
              const isMatch = (
                collectionId.includes(collectionIdentifier) ||
                collectionAddr === collectionIdentifier ||
                collectionIdentifier.includes(collectionAddr)
              );
              
              if (isMatch) {
                console.log(`Match found for ${node.username}: Collection ID ${collectionId} matches ${collectionIdentifier}`);
              }
              
              return isMatch;
            });
          
          const totalCount = matchingNfts.length;
          
          if (totalCount > 0) {
            console.log(`${node.username} holds ${totalCount} NFTs from collection ${collectionIdentifier}`);
            return {
              ...node,
              holdingCount: totalCount,
              nfts: matchingNfts,
              relationship: relationshipType
            };
          } else {
            console.log(`${node.username} holds no NFTs from collection ${collectionIdentifier}`);
          }
        } catch (error) {
          console.error(`Error checking holdings for ${node.username}:`, error);
        }
        
        return null;
      };

      // Process following and followers in smaller chunks to avoid rate limiting
      console.log("Processing followers and following...");
      
      const followingHolders = [];
      const followerHolders = [];
      
      // Process following in chunks of 5
      for (let i = 0; i < following.length; i += 5) {
        const chunk = following.slice(i, i + 5);
        const results = await Promise.all(
          chunk.map(({ node }) => checkUserHoldings(node, 'following'))
        );
        followingHolders.push(...results.filter(Boolean));
        
        // Small delay to avoid rate limiting
        if (i + 5 < following.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      // Process followers in chunks of 5
      for (let i = 0; i < followers.length; i += 5) {
        const chunk = followers.slice(i, i + 5);
        const results = await Promise.all(
          chunk.map(({ node }) => checkUserHoldings(node, 'follower'))
        );
        followerHolders.push(...results.filter(Boolean));
        
        // Small delay to avoid rate limiting
        if (i + 5 < followers.length) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      console.log("Holder counts:", {
        following: followingHolders.length,
        followers: followerHolders.length
      });
      
      // Identify mutual connections (both following and followers)
      const mutualHolderIds = new Set();
      
      followingHolders.forEach(following => {
        const isAlsoFollower = followerHolders.some(follower => follower.fid === following.fid);
        if (isAlsoFollower) {
          mutualHolderIds.add(following.fid);
          following.relationship = 'mutual';
        }
      });
      
      followerHolders.forEach(follower => {
        if (mutualHolderIds.has(follower.fid)) {
          follower.relationship = 'mutual';
        }
      });
      
      // Remove duplicates (when someone is both a follower and following)
      const allHolders = [
        ...followingHolders,
        ...followerHolders.filter(follower => !mutualHolderIds.has(follower.fid))
      ].sort((a, b) => b.followersCount - a.followersCount);

      console.log(`Found ${allHolders.length} total collection holders`);
      
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