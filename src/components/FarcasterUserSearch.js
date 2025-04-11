import React, { useState, useEffect } from 'react';
import zapperService from '../services/zapperService';
import NftGrid from './NFTGrid';
import '../styles/FarcasterUserSearch.css';

/**
 * Component for searching Farcaster users and displaying their NFTs
 * @param {Object} props - Component props
 * @param {string} props.initialUsername - Optional initial username to search for
 */
const FarcasterUserSearch = ({ initialUsername }) => {
  // Search state
  const [searchQuery, setSearchQuery] = useState(initialUsername || '');
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingNfts, setIsLoadingNfts] = useState(false);
  const [isLoadingMoreNfts, setIsLoadingMoreNfts] = useState(false);
  const [searchError, setSearchError] = useState(null);
  
  // User data state
  const [userProfile, setUserProfile] = useState(null);
  const [userNfts, setUserNfts] = useState([]);
  const [fetchNftsError, setFetchNftsError] = useState(null);
  
  // Pagination state
  const [hasMoreNfts, setHasMoreNfts] = useState(false);
  const [endCursor, setEndCursor] = useState(null);
  const [walletAddresses, setWalletAddresses] = useState([]);
  
  // UI state
  const [selectedNft, setSelectedNft] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [walletsExpanded, setWalletsExpanded] = useState(false);

  // Effect for initial search if username is provided
  useEffect(() => {
    if (initialUsername) {
      performSearch(initialUsername);
    }
  }, [initialUsername]);

  // Shared search logic extracted to a function
  const performSearch = async (query) => {
    if (!query.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    setUserProfile(null);
    setUserNfts([]);
    setFetchNftsError(null);
    setWalletsExpanded(false);
    setHasMoreNfts(false);
    setEndCursor(null);
    setWalletAddresses([]);

    try {
      console.log(`Searching for Farcaster user: ${query}`);
      
      // Clean username input by removing @ symbol if present and trim whitespace
      const cleanQuery = query.trim().replace(/^@/, '');
      
      // Add a slight delay to prevent rapid clicking issues on mobile
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Show mobile-friendly error for empty searches
      if (!cleanQuery) {
        setSearchError('Please enter a Farcaster username');
        setIsSearching(false);
        return;
      }
      
      // Fetch the profile
      const profile = await zapperService.getFarcasterProfile(cleanQuery);
      
      // Set profile data in state immediately when received
      setUserProfile(profile);
      console.log('Profile found:', profile);
      
      // If profile found, fetch their NFTs
      if (profile) {
        // Collect all available addresses
        const addresses = [
          ...(profile.connectedAddresses || []),
          ...(profile.custodyAddress ? [profile.custodyAddress] : [])
        ].filter(Boolean);
        
        // Prevent concurrent fetches - important for mobile
        if (addresses.length > 0) {
          setWalletAddresses(addresses);
          await fetchUserNfts(addresses);
        } else {
          console.log('No addresses found for this user to fetch NFTs');
        }
      }
    } catch (error) {
      console.error('Error searching for user:', error);
      
      // Provide more specific error messages to help users
      if (error.message.includes('Could not find Farcaster profile')) {
        setSearchError(`Could not find a Farcaster profile for "${query}". Please check the username and try again.`);
      } else if (error.message.includes('Failed to fetch') || error.message.includes('Network request failed') || error.message.includes('Network error')) {
        setSearchError('Network error. Please check your internet connection and try again.');
      } else if (error.message.includes('timeout') || error.message.includes('Timeout')) {
        setSearchError('Request timed out. The server might be busy, please try again later.');
      } else {
        setSearchError(error.message || 'Failed to find Farcaster user. Please try again.');
      }
    } finally {
      setIsSearching(false);
    }
  };

  // Handle search form submission
  const handleSearch = async (e) => {
    e.preventDefault();
    await performSearch(searchQuery);
  };

  // Fetch NFTs for the user
  const fetchUserNfts = async (addresses, cursor = null, loadMore = false) => {
    if (loadMore) {
      setIsLoadingMoreNfts(true);
    } else {
      setIsLoadingNfts(true);
    }
    
    setFetchNftsError(null);
    
    try {
      console.log(`Fetching NFTs for ${addresses.length} wallet addresses:`, addresses);
      console.log(loadMore ? 'Loading more NFTs from cursor: ' + cursor : 'Initial NFT load');
      
      // Make direct request to the API using raw query for better control
      const query = `
        query GetNFTs($owners: [Address!]!, $first: Int, $after: String) {
          nftUsersTokens(
            owners: $owners
            first: $first
            after: $after
            withOverrides: true
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
      
      // Try the raw API call through our server
      try {
        const response = await fetch(`/api/zapper`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query,
            variables: { 
              owners: addresses,
              first: 50, // Reduced batch size for better performance
              after: cursor
            }
          })
        });
        
        if (!response.ok) {
          throw new Error(`API call failed with status: ${response.status}`);
        }
        
        const responseData = await response.json();
        console.log('API response:', responseData);
        
        if (responseData.errors) {
          throw new Error(`GraphQL errors: ${JSON.stringify(responseData.errors)}`);
        }
        
        if (!responseData.data || !responseData.data.nftUsersTokens) {
          throw new Error('Invalid response format: missing nftUsersTokens data');
        }
        
        const edges = responseData.data.nftUsersTokens.edges || [];
        const pageInfo = responseData.data.nftUsersTokens.pageInfo || {};
        
        console.log(`Found ${edges.length} NFTs via direct API call`);
        console.log(`Page info: hasNextPage = ${pageInfo.hasNextPage}, endCursor = ${pageInfo.endCursor}`);
        
        // Update pagination state
        setHasMoreNfts(pageInfo.hasNextPage);
        setEndCursor(pageInfo.endCursor);
        
        if (edges.length === 0 && !loadMore) {
          setUserNfts([]);
          return;
        }
        
        // Process the NFTs
        const processedNfts = edges.map(edge => {
          const nft = edge.node;
          if (!nft) return null;
          
          // Get image URL
          let imageUrl = null;
          
          // Try media URLs in order of preference
          if (nft.mediasV2 && nft.mediasV2.length > 0) {
            // Look for image URL in mediasV2
            for (const media of nft.mediasV2) {
              if (!media) continue;
              
              if (media.original) {
                imageUrl = media.original;
                break;
              } else if (media.originalUri) {
                imageUrl = media.originalUri;
                break;
              } else if (media.url) {
                imageUrl = media.url;
                break;
              }
            }
          }
          
          // Collection images as fallback
          if (!imageUrl && nft.collection) {
            imageUrl = nft.collection.cardImageUrl;
          }
          
          // Default placeholder
          if (!imageUrl) {
            imageUrl = 'https://via.placeholder.com/400x400?text=No+Image';
          }
          
          return {
            id: nft.id,
            name: nft.name || 'Unnamed NFT',
            tokenId: nft.tokenId,
            description: nft.description,
            imageUrl: imageUrl,
            collection: nft.collection ? {
              id: nft.collection.id,
              name: nft.collection.name || 'Unknown Collection',
              floorPriceEth: nft.collection.floorPriceEth,
              imageUrl: nft.collection.cardImageUrl
            } : null,
            token_id: nft.tokenId
          };
        }).filter(Boolean);
        
        console.log('Processed NFTs:', processedNfts);
        
        // Either append to existing NFTs or replace them
        if (loadMore) {
          setUserNfts(prevNfts => [...prevNfts, ...processedNfts]);
        } else {
          setUserNfts(processedNfts);
        }
        
      } catch (directApiError) {
        console.error('Direct API call failed:', directApiError);
        
        // Fallback to the service method
        console.log('Falling back to zapperService method...');
        try {
          const result = await zapperService.getNftsForAddresses(addresses, {
            first: 50,
            after: cursor
          });
          
          if (result && Array.isArray(result.nfts)) {
            console.log(`Found ${result.nfts.length} NFTs via service fallback`);
            
            // Update pagination state
            setHasMoreNfts(result.pageInfo?.hasNextPage || false);
            setEndCursor(result.pageInfo?.endCursor || null);
            
            // Either append to existing NFTs or replace them
            if (loadMore) {
              setUserNfts(prevNfts => [...prevNfts, ...result.nfts]);
            } else {
              setUserNfts(result.nfts);
            }
          } else {
            console.error('Invalid response from NFT service:', result);
            setFetchNftsError('Failed to fetch NFTs. Please try again.');
          }
        } catch (fallbackError) {
          console.error('Fallback also failed:', fallbackError);
          setFetchNftsError('Failed to fetch NFTs. Please try again.');
        }
      }
    } catch (error) {
      console.error('Error fetching NFTs:', error);
      setFetchNftsError(error.message || 'Failed to fetch NFTs. Please try again.');
    } finally {
      if (loadMore) {
        setIsLoadingMoreNfts(false);
      } else {
        setIsLoadingNfts(false);
      }
    }
  };
  
  // Handle loading more NFTs
  const handleLoadMore = async () => {
    if (isLoadingMoreNfts || !hasMoreNfts || !endCursor || walletAddresses.length === 0) {
      return;
    }
    
    await fetchUserNfts(walletAddresses, endCursor, true);
  };

  // Handle NFT click to open modal
  const handleNftClick = (nft) => {
    console.log('NFT clicked:', nft);
    setSelectedNft(nft);
    setIsModalOpen(true);
    setImageError(false);
  };

  // Handle image loading error in modal
  const handleImageError = () => {
    console.log('Image failed to load in NFT modal');
    setImageError(true);
  };

  // Toggle wallets dropdown
  const toggleWallets = () => {
    setWalletsExpanded(!walletsExpanded);
  };

  // Get wallet count
  const getWalletCount = () => {
    if (!userProfile) return 0;
    
    let count = 0;
    if (userProfile.connectedAddresses?.length) count += userProfile.connectedAddresses.length;
    if (userProfile.custodyAddress) count += 1;
    
    return count;
  };

  // Log when NFT data changes
  useEffect(() => {
    console.log(`NFT state updated: ${userNfts.length} NFTs available, has more: ${hasMoreNfts}`);
  }, [userNfts, hasMoreNfts]);

  // Render component
  return (
    <div className="farcaster-user-search">
      {/* Search Form */}
      <form onSubmit={handleSearch} className="search-form">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Enter Farcaster username or FID"
          className="search-input"
          disabled={isSearching}
        />
        <button 
          type="submit" 
          className="search-button"
          disabled={isSearching || !searchQuery.trim()}
        >
          Search
        </button>
      </form>
      
      {/* Loading or Error Messages */}
      {isSearching && <div className="loading-message">Searching...</div>}
      {searchError && <div className="error-message">{searchError}</div>}
      
      {/* User Profile */}
      {userProfile && (
        <div className="user-profile">
          <div className="profile-header">
            {userProfile.avatarUrl && (
              <img 
                src={userProfile.avatarUrl} 
                alt={`${userProfile.displayName || userProfile.username} avatar`}
                onError={(e) => { 
                  console.error('Profile avatar failed to load:', userProfile.avatarUrl);
                  e.target.src = 'https://via.placeholder.com/150?text=No+Image'; 
                }}
                className="profile-avatar"
              />
            )}
            <div className="profile-info">
              <h3 className="display-name">{userProfile.displayName || userProfile.username}</h3>
              <p className="username">@{userProfile.username} · FID: {userProfile.fid}</p>
            </div>
          </div>
          
          {/* Connected Wallets Dropdown */}
          {(userProfile.connectedAddresses?.length > 0 || userProfile.custodyAddress) && (
            <div className="connected-wallets">
              <div 
                className="wallets-header" 
                onClick={toggleWallets}
              >
                <h4>
                  <span>Connected Wallets ({getWalletCount()})</span>
                  <span className={`dropdown-arrow ${walletsExpanded ? 'expanded' : ''}`}>▼</span>
                </h4>
              </div>
              
              {walletsExpanded && (
                <ul className="wallet-list">
                  {userProfile.connectedAddresses?.map((address, index) => (
                    <li key={index} className="wallet-item">
                      <span className="wallet-address">
                        {address.substring(0, 6)}...{address.substring(address.length - 4)}
                      </span>
                      <a 
                        href={`https://etherscan.io/address/${address}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="etherscan-link"
                      >
                        View on Etherscan
                      </a>
                    </li>
                  ))}
                  {userProfile.custodyAddress && (
                    <li className="wallet-item">
                      <span className="wallet-address custody">
                        {userProfile.custodyAddress.substring(0, 6)}...
                        {userProfile.custodyAddress.substring(userProfile.custodyAddress.length - 4)}
                        <span className="custody-label">(Custody)</span>
                      </span>
                      <a 
                        href={`https://etherscan.io/address/${userProfile.custodyAddress}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="etherscan-link"
                      >
                        View on Etherscan
                      </a>
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {/* Debug Info */}
      {process.env.NODE_ENV === 'development' && userProfile && (
        <div className="debug-info" style={{margin: '10px 0', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px'}}>
          <h4>Debug Info:</h4>
          <p>Loading NFTs: {isLoadingNfts ? 'Yes' : 'No'}</p>
          <p>Loading More NFTs: {isLoadingMoreNfts ? 'Yes' : 'No'}</p>
          <p>NFT Count: {userNfts.length}</p>
          <p>Has More NFTs: {hasMoreNfts ? 'Yes' : 'No'}</p>
          <p>End Cursor: {endCursor || 'None'}</p>
          <p>Connected Addresses: {userProfile.connectedAddresses?.length || 0}</p>
          <p>Has Custody Address: {userProfile.custodyAddress ? 'Yes' : 'No'}</p>
        </div>
      )}

      {/* Fetch NFTs Error Message */}
      {fetchNftsError && (
        <div className="error-message">
          <p>{fetchNftsError}</p>
        </div>
      )}

      {/* NFT Grid */}
      {userProfile && (
        <div className="nft-section">
          <h3>NFT Collection</h3>
          <NftGrid 
            nfts={userNfts} 
            onNftClick={handleNftClick} 
            loading={isLoadingNfts} 
            emptyMessage={
              (!userProfile.connectedAddresses?.length && !userProfile.custodyAddress)
                ? "This user has no connected wallets to display NFTs from." 
                : isLoadingNfts 
                  ? "Loading NFTs..." 
                  : "No NFTs found for this user's wallets."
            }
          />
          
          {/* Load More Button */}
          {hasMoreNfts && userNfts.length > 0 && (
            <div className="load-more-container">
              <button 
                className="load-more-button"
                onClick={handleLoadMore}
                disabled={isLoadingMoreNfts}
              >
                {isLoadingMoreNfts ? 'Loading...' : 'Load More NFTs'}
              </button>
            </div>
          )}
          
          {/* Loading More Indicator */}
          {isLoadingMoreNfts && (
            <div className="loading-more">
              <div className="loading-spinner-small"></div>
              <p>Loading more NFTs...</p>
            </div>
          )}
        </div>
      )}

      {/* NFT Detail Modal */}
      {isModalOpen && selectedNft && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setIsModalOpen(false)}>×</button>
            
            <h3>{selectedNft.name || 'Unnamed NFT'}</h3>
            
            {!imageError ? (
              <img 
                src={selectedNft.imageUrl} 
                alt={selectedNft.name || 'NFT'} 
                className="modal-image"
                onError={handleImageError}
              />
            ) : (
              <div className="image-placeholder">Image unavailable</div>
            )}
            
            <div className="nft-details">
              {selectedNft.collection && (
                <p><strong>Collection:</strong> {selectedNft.collection.name}</p>
              )}
              <p><strong>Token ID:</strong> {selectedNft.tokenId || selectedNft.token_id}</p>
              {selectedNft.estimatedValueEth && (
                <p><strong>Estimated Value:</strong> {selectedNft.estimatedValueEth.toFixed(4)} ETH</p>
              )}
              {selectedNft.description && (
                <div className="nft-description">
                  <h4>Description:</h4>
                  <p>{selectedNft.description}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FarcasterUserSearch; 