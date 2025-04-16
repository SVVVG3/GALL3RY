import React, { useState, useEffect, useCallback } from 'react';
import { useNFT } from '../contexts/NFTContext';
import { getFarcasterProfile } from '../services/zapperService';
import NFTGallery from './NFTGallery';
import '../styles/FarcasterUserSearch.css';
import safeStorage from '../utils/storage';
import SimpleNFTGrid from './SimpleNFTGrid';

/**
 * NFT Sort Controls Component
 */
const NFTSortControls = ({ sortBy, setSortBy, sortOrder, setSortOrder }) => {
  const toggleSortOrder = () => {
    setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
  };

  return (
    <div className="nft-sort-controls">
      <div className="sort-options">
        <button
          className={`sort-option ${sortBy === 'recent' ? 'active' : ''}`}
          onClick={() => setSortBy('recent')}
        >
          Recent
        </button>
        <button
          className={`sort-option ${sortBy === 'name' ? 'active' : ''}`}
          onClick={() => setSortBy('name')}
        >
          Name
        </button>
        <button
          className={`sort-option ${sortBy === 'collection' ? 'active' : ''}`}
          onClick={() => setSortBy('collection')}
        >
          Collection
        </button>
        <button
          className={`sort-option ${sortBy === 'value' ? 'active' : ''}`}
          onClick={() => setSortBy('value')}
        >
          Value
        </button>
      </div>
      <button className="sort-order-toggle" onClick={toggleSortOrder}>
        {sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
      </button>
    </div>
  );
};

/**
 * FarcasterUserSearch component - simplified to avoid circular dependencies
 */
const FarcasterUserSearch = ({ initialUsername }) => {
  const { fetchAllNFTsForWallets, isLoading: isNftLoading } = useNFT();
  
  // Search state
  const [searchQuery, setSearchQuery] = useState(initialUsername || '');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  
  // User data state
  const [userProfile, setUserProfile] = useState(null);
  const [userNfts, setUserNfts] = useState([]);
  const [walletAddresses, setWalletAddresses] = useState([]);
  
  // UI state
  const [walletsExpanded, setWalletsExpanded] = useState(false);
  
  // Sorting state
  const [sortBy, setSortBy] = useState('recent');
  const [sortOrder, setSortOrder] = useState('desc');
  
  // Add state for NFT filtering
  const [nftSearchQuery, setNftSearchQuery] = useState('');
  
  // Get sorted NFTs
  const sortedNfts = useCallback(() => {
    if (!userNfts || userNfts.length === 0) return [];
    
    const nftsCopy = [...userNfts];
    
    switch (sortBy) {
      case 'name':
        return nftsCopy.sort((a, b) => {
          const nameA = (a.name || '').toLowerCase();
          const nameB = (b.name || '').toLowerCase();
          return sortOrder === 'asc' 
            ? nameA.localeCompare(nameB) 
            : nameB.localeCompare(nameA);
        });
        
      case 'value':
        return nftsCopy.sort((a, b) => {
          const valueA = a.collection?.floorPrice?.valueUsd || 0;
          const valueB = b.collection?.floorPrice?.valueUsd || 0;
          return sortOrder === 'asc' 
            ? valueA - valueB 
            : valueB - valueA;
        });
        
      case 'recent':
        return nftsCopy.sort((a, b) => {
          const timeA = a.lastActivityTimestamp || a.acquiredAt || a.lastTransferTimestamp || 0;
          const timeB = b.lastActivityTimestamp || b.acquiredAt || b.lastTransferTimestamp || 0;
          return sortOrder === 'asc' 
            ? timeA - timeB 
            : timeB - timeA;
        });
        
      case 'collection':
      default:
        return nftsCopy.sort((a, b) => {
          const collA = (a.collection?.name || '').toLowerCase();
          const collB = (b.collection?.name || '').toLowerCase();
          
          if (collA === collB) {
            // Sort by token ID within the same collection
            const idA = parseInt(a.tokenId) || 0;
            const idB = parseInt(b.tokenId) || 0;
            return sortOrder === 'asc' ? idA - idB : idB - idA;
          }
          
          return sortOrder === 'asc' 
            ? collA.localeCompare(collB) 
            : collB.localeCompare(collA);
        });
    }
  }, [userNfts, sortBy, sortOrder]);
  
  // Function to filter NFTs by search term
  const filterNftsBySearch = useCallback((nfts) => {
    if (!nftSearchQuery.trim()) return nfts;
    
    const searchTerm = nftSearchQuery.toLowerCase();
    return nfts.filter(nft => {
      const name = (nft.name || nft.title || `#${nft.tokenId || '0'}`).toLowerCase();
      const collection = ((nft.collection && nft.collection.name) || 
                          (nft.collectionName) || 
                          (nft.contract && nft.contract.name) || '').toLowerCase();
      
      return name.includes(searchTerm) || collection.includes(searchTerm);
    });
  }, [nftSearchQuery]);

  // Apply filter to sorted NFTs
  const filteredAndSortedNfts = useCallback(() => {
    return filterNftsBySearch(sortedNfts());
  }, [filterNftsBySearch, sortedNfts]);
  
  // Wrap handleSearch in useCallback to use in useEffect
  const handleSearch = useCallback(async (e) => {
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchError(null);
    setUserProfile(null);
    setUserNfts([]);
    setWalletAddresses([]);

    try {
      console.log(`Searching for Farcaster user: ${searchQuery}`);
      
      // Try to find the Farcaster profile using Zapper API
      let profile;
      try {
        profile = await getFarcasterProfile(searchQuery);
      } catch (profileError) {
        console.error('Profile search error:', profileError);
        throw new Error(`Could not find Farcaster user "${searchQuery}". Please check the username and try again.`);
      }
      
      if (!profile) {
        throw new Error(`Could not find Farcaster user "${searchQuery}". Please check the username and try again.`);
      }
      
      console.log('Farcaster profile found:', profile);
      
      // Get wallet addresses
      let addresses = [];
      
      // Add custody address if it exists
      if (profile.custodyAddress) {
        addresses.push(profile.custodyAddress);
      }
      
      // Add connected addresses if they exist
      if (profile.connectedAddresses && profile.connectedAddresses.length > 0) {
        addresses = [...addresses, ...profile.connectedAddresses];
      }
      
      // Filter out duplicates and invalid addresses
      addresses = [...new Set(addresses)].filter(addr => 
        addr && typeof addr === 'string' && addr.startsWith('0x') && addr.length === 42
      );
      
      if (addresses.length === 0) {
        console.warn(`No valid addresses found for user ${searchQuery}`);
        throw new Error(`Found profile for ${searchQuery} but no wallet addresses are connected.`);
      }
      
      setUserProfile(profile);
      setWalletAddresses(addresses);
      
      // Save recently searched profile to storage if available
      try {
        const recentSearches = JSON.parse(safeStorage.getItem('recentSearches') || '[]');
        const updatedSearches = [profile.username, ...recentSearches.filter(name => name !== profile.username)].slice(0, 5);
        safeStorage.setItem('recentSearches', JSON.stringify(updatedSearches));
      } catch (storageError) {
        console.warn('Could not save recent search:', storageError);
      }
      
      // Fetch NFTs if we have wallet addresses
      if (addresses.length > 0) {
        try {
          // Add a console.log right before the API call
          console.log(`Fetching NFTs for addresses:`, addresses);
          
          // Fetch with proper error handling
          try {
            const result = await fetchAllNFTsForWallets(addresses);
            
            // Enhanced debugging logs
            console.log('NFT fetch result:', {
              resultExists: !!result,
              hasNftsProperty: result ? 'nfts' in result : false,
              nftsIsArray: result && result.nfts ? Array.isArray(result.nfts) : false,
              nftsCount: result && result.nfts && Array.isArray(result.nfts) ? result.nfts.length : 0,
              hasError: result && result.error ? true : false,
              errorMessage: result && result.error ? result.error : null
            });

            // Direct debugging - show first NFT if available
            if (result && result.nfts && Array.isArray(result.nfts) && result.nfts.length > 0) {
              console.log('First NFT in results:', {
                id: result.nfts[0].id,
                name: result.nfts[0].name || 'Unnamed',
                network: result.nfts[0].network || 'No network',
                owner: result.nfts[0].ownerAddress || 'No owner'
              });
            }
            
            // Ensure result contains nfts array
            if (!result) {
              console.warn('fetchAllNFTsForWallets returned undefined result');
              setUserNfts([]);
              setSearchError('Could not fetch NFTs: Received empty response from server');
            } else if (result.error) {
              // Display error from the result if present
              console.warn('fetchAllNFTsForWallets returned error:', result.error);
              setUserNfts(result.nfts || []);
              setSearchError(`Could not fetch all NFTs: ${result.error}`);
            } else if (!result.nfts) {
              console.warn('fetchAllNFTsForWallets result is missing nfts property:', result);
              setUserNfts([]);
              setSearchError('Could not fetch NFTs: Invalid response format from server');
            } else if (!Array.isArray(result.nfts)) {
              console.warn('fetchAllNFTsForWallets returned invalid format - nfts is not an array:', result);
              setUserNfts([]);
              setSearchError('Could not fetch NFTs: Received invalid NFT data format');
            } else {
              console.log(`Fetched ${result.nfts.length} NFTs for user ${searchQuery}`);
              
              // CRITICAL: Actually use the NFTs we received
              setUserNfts(result.nfts); 
              
              // Clear error if we got NFTs successfully
              if (result.nfts.length > 0) {
                setSearchError(null);
                console.log(`Successfully set ${result.nfts.length} NFTs to state`);
              } else {
                // Set a gentle message if there are no NFTs but no error
                setSearchError(`No NFTs found for user ${searchQuery}. They might not own any NFTs on the supported chains.`);
              }
            }
          } catch (nftAPIError) {
            console.error('API Error fetching NFTs:', nftAPIError);
            setSearchError(`Found profile but could not fetch NFTs: ${nftAPIError.message}`);
            setUserNfts([]); // Ensure userNfts is always an array
          }
        } catch (nftError) {
          console.error('Error in NFT fetch process:', nftError);
          setSearchError(`Found profile but could not load NFTs: ${nftError.message}`);
          setUserNfts([]); // Ensure userNfts is always an array
        }
      } else {
        // No wallet addresses found
        console.log('No wallet addresses found for this user');
        setUserNfts([]);
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchError(error.message || 'Failed to find user');
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, fetchAllNFTsForWallets]);

  // Effect for initial search if username is provided
  useEffect(() => {
    if (initialUsername) {
      handleSearch();
    }
  }, [initialUsername, handleSearch]);

  const fetchUserNfts = async (profile) => {
    setIsSearching(true);
    setSearchError(null);
    
    try {
      if (!profile || !profile.custodyAddress) {
        setSearchError('No wallet address found for this Farcaster user');
        setUserNfts([]);
        return;
      }
      
      // Get all connected addresses
      let addresses = [];
      
      // Primary custody address
      if (profile.custodyAddress) {
        addresses.push(profile.custodyAddress);
      }
      
      // Connected wallets (if any)
      if (profile.connectedAddresses && Array.isArray(profile.connectedAddresses)) {
        addresses = [...addresses, ...profile.connectedAddresses];
      }
      
      // Filter out any duplicates or invalid addresses
      addresses = addresses
        .filter(Boolean) // Remove null/undefined
        .filter(addr => addr.startsWith('0x') && addr.length === 42) // Ensure valid format
        .filter((addr, index, self) => self.indexOf(addr) === index); // Remove duplicates
      
      if (addresses.length === 0) {
        console.warn('No valid addresses found for user');
        setSearchError('No valid wallet addresses found for this user');
        setUserNfts([]);
        return;
      }
      
      console.log(`Fetching NFTs for ${addresses.length} addresses:`, addresses);
      
      // Attempt to fetch NFTs with retry mechanism
      let attempt = 0;
      let result = null;
      let success = false;
      
      while (attempt < 3 && !success) {
        try {
          // Add small delay between retries
          if (attempt > 0) {
            console.log(`Retry attempt ${attempt} for fetchAllNFTsForWallets`);
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
          
          result = await fetchAllNFTsForWallets(addresses);
          
          // Verify the result structure
          if (result && Array.isArray(result.nfts)) {
            success = true;
          } else {
            console.error('Invalid result format:', result);
            throw new Error('Received invalid data format from NFT service');
          }
        } catch (err) {
          console.error(`Attempt ${attempt + 1} failed:`, err);
          attempt++;
          
          // If this is the last attempt, propagate the error
          if (attempt >= 3) {
            throw err;
          }
        }
      }
      
      // Ensure we have a valid result with nfts array
      if (!result || !Array.isArray(result.nfts)) {
        console.error('Failed to get valid NFT data after retries');
        setSearchError('Could not fetch NFTs. Please try again later.');
        setUserNfts([]);
        return;
      }
      
      console.log(`Successfully fetched ${result.nfts.length} NFTs for ${profile.username}`);
      
      // Process and update the UI
      setUserNfts(result.nfts || []);
      
      // Track for analytics
      if (typeof window !== 'undefined') {
        window.plausible && window.plausible('Farcaster User NFTs Viewed', {
          props: { 
            username: profile.username,
            nft_count: result.nfts.length
          }
        });
      }
    } catch (error) {
      console.error('Error fetching user NFTs:', error);
      setSearchError(`Failed to load NFTs: ${error.message || 'Unknown error'}`);
      setUserNfts([]); // Set empty array to avoid null/undefined issues
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="farcaster-search-container">
      <div className="search-header">
        <p className="search-instructions">Enter a Farcaster username to explore their NFT collection</p>
      </div>
      
      <form onSubmit={handleSearch} className="search-form">
        <div className="search-input-wrapper">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Enter Farcaster username (e.g. dwr, vitalik)"
            className="search-input"
            aria-label="Farcaster username"
            disabled={isSearching}
          />
          <button 
            type="submit"
            className="search-button"
            disabled={!searchQuery.trim() || isSearching}
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </div>
      </form>
      
      {searchError && (
        <div className="error-message">
          <p>{searchError}</p>
        </div>
      )}
      
      {userProfile && (
        <div className="user-profile">
          <div className="profile-info">
            <div className="profile-header">
              <div className="profile-image-name">
                <div className="profile-image">
                  {userProfile.metadata?.imageUrl ? (
                    <img 
                      src={userProfile.metadata.imageUrl} 
                      alt={`${userProfile.username}'s profile`} 
                      onError={(e) => {
                        e.target.onerror = null;
                        e.target.src = '/assets/placeholder-profile.png';
                      }}
                    />
                  ) : (
                    <img src="/assets/placeholder-profile.png" alt="Default profile" />
                  )}
                </div>
                <p className="display-name">{userProfile.metadata?.displayName || ''}</p>
                <div className="username-fid-container">
                  <a 
                    href={`https://warpcast.com/${userProfile.username}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="username-link"
                  >
                    @{userProfile.username}
                  </a>
                  <span className="fid-display">FID: {userProfile.fid}</span>
                </div>
                
                {/* NFT count between username and wallets */}
                <div className="nft-total-count">
                  <p>🖼️ Found {userNfts.length} NFTs</p>
                </div>
              </div>
              <div className="wallet-info">
                <button 
                  className="wallet-toggle" 
                  onClick={() => setWalletsExpanded(!walletsExpanded)}
                >
                  {walletsExpanded ? 'Hide' : 'Connected Wallets'} ({walletAddresses.length})
                  <span className={`dropdown-arrow ${walletsExpanded ? 'expanded' : ''}`}>
                    ▼
                  </span>
                </button>
                {walletsExpanded && (
                  <ul className="wallet-list">
                    {walletAddresses.map((address, index) => (
                      <li key={index} className="wallet-item">
                        <a 
                          href={`https://etherscan.io/address/${address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="wallet-link"
                        >
                          {address.substring(0, 6)}...{address.substring(address.length - 4)}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
          
          <div className="nft-container">
            <div className="nft-header">
              <div className="nft-header-left">
                <div className="nft-search-bar">
                  <input
                    type="text"
                    placeholder="Search NFTs by name or collection..."
                    value={nftSearchQuery}
                    onChange={(e) => setNftSearchQuery(e.target.value)}
                    className="nft-filter-input"
                  />
                  {nftSearchQuery && (
                    <button 
                      className="nft-filter-clear" 
                      onClick={() => setNftSearchQuery('')}
                      aria-label="Clear search"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
              
              {/* Add sort controls if NFTs are available */}
              {userNfts.length > 0 && (
                <div className="nft-header-right">
                  <NFTSortControls 
                    sortBy={sortBy} 
                    setSortBy={setSortBy} 
                    sortOrder={sortOrder} 
                    setSortOrder={setSortOrder}
                  />
                </div>
              )}
            </div>
            
            {/* Use the existing NFTGallery component to display NFTs */}
            {isNftLoading ? (
              <div className="loading-spinner"></div>
            ) : (
              <div className="nft-display">
                <SimpleNFTGrid 
                  nfts={filteredAndSortedNfts()} 
                  isLoading={isSearching && userNfts.length === 0}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FarcasterUserSearch; 