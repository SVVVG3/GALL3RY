import React, { useState, useEffect, useCallback } from 'react';
import { useNFT } from '../contexts/NFTContext';
import { getFarcasterProfile } from '../services/zapperService';
import NFTGrid from './NFTGrid';
import { FaSort } from 'react-icons/fa';
import '../styles/FarcasterUserSearch.css';
import '../styles/FarcasterProfile.css';
import safeStorage from '../utils/storage';
import NFTSearchBar from './NFTSearchBar';
import NFTSortControls from './NFTSortControls';
import { fetchFarcasterUser, fetchAddressesForFid } from '../services/farcasterService';
import { fetchNftsForAddresses } from '../services/alchemyService';

/**
 * FarcasterUserSearch component - simplified to avoid circular dependencies
 */
const FarcasterUserSearch = ({ initialUsername, onNFTsDisplayChange }) => {
  const { 
    fetchAllNFTsForWallets, 
    isLoading: isNftLoading,
    searchQuery, // NFT filter search query from context
    sortBy,
    sortOrder
  } = useNFT();
  
  // Form search state (for Farcaster username, not NFT filtering)
  const [formSearchQuery, setFormSearchQuery] = useState(initialUsername || '');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  
  // User data state
  const [userProfile, setUserProfile] = useState(null);
  const [userNfts, setUserNfts] = useState([]);
  const [walletAddresses, setWalletAddresses] = useState([]);
  
  // UI state
  const [walletsExpanded, setWalletsExpanded] = useState(false);
  
  // Notify parent component when NFTs are displayed
  useEffect(() => {
    if (onNFTsDisplayChange && typeof onNFTsDisplayChange === 'function') {
      // We have NFTs to display if userProfile exists and userNfts has items
      const hasNFTsToDisplay = Boolean(userProfile && userNfts.length > 0);
      onNFTsDisplayChange(hasNFTsToDisplay);
    }
  }, [userProfile, userNfts, onNFTsDisplayChange]);
  
  // Get sorted NFTs
  const sortedNfts = useCallback(() => {
    if (!userNfts || userNfts.length === 0) return [];
    
    console.log(`Sorting ${userNfts.length} NFTs by ${sortBy} in ${sortOrder} order`);
    
    // Debug first NFT's structure for understanding available fields
    if (userNfts.length > 0) {
      const sampleNft = userNfts[0];
      console.log('Sample NFT structure for sorting:', {
        name: sampleNft.name || sampleNft.title,
        collection: sampleNft.collection?.name,
        contractName: sampleNft.contract?.name,
        value: sampleNft.collection?.floorPrice?.valueUsd,
        ethValue: sampleNft.collection?.floorPrice?.value,
        timestamps: {
          lastActivity: sampleNft.lastActivityTimestamp,
          acquired: sampleNft.acquiredAt,
          lastTransfer: sampleNft.lastTransferTimestamp
        }
      });
    }
    
    const nftsCopy = [...userNfts];
    
    switch (sortBy) {
      case 'name':
        return nftsCopy.sort((a, b) => {
          // Enhanced name extraction with more fallbacks and cleaning
          const rawNameA = (a.name || a.title || a.metadata?.name || `#${a.tokenId || a.token_id || '0'}`);
          const rawNameB = (b.name || b.title || b.metadata?.name || `#${b.tokenId || b.token_id || '0'}`);
          
          // Clean names by removing NFT prefix
          const nameA = rawNameA.replace(/^NFT\s+#/i, '#').toLowerCase();
          const nameB = rawNameB.replace(/^NFT\s+#/i, '#').toLowerCase();
          
          // Helper function to determine if a character is a letter
          const isLetter = (char) => /[a-z]/i.test(char);
          
          // Helper function to determine if name starts with letter
          const startsWithLetter = (str) => str.length > 0 && isLetter(str[0]);
          
          // Get first character for sorting
          const firstCharA = nameA.charAt(0);
          const firstCharB = nameB.charAt(0);
          
          // If one starts with letter and other doesn't, letter comes first
          if (startsWithLetter(nameA) && !startsWithLetter(nameB)) {
            return sortOrder === 'asc' ? -1 : 1;
          }
          if (!startsWithLetter(nameA) && startsWithLetter(nameB)) {
            return sortOrder === 'asc' ? 1 : -1;
          }
          
          // Normal comparison for two strings that both start with letters or both don't
          const result = sortOrder === 'asc' 
            ? nameA.localeCompare(nameB, undefined, { numeric: true }) 
            : nameB.localeCompare(nameA, undefined, { numeric: true });
            
          return result;
        });
        
      case 'value':
        return nftsCopy.sort((a, b) => {
          // Enhanced value extraction with more fallbacks
          const valueA = a.collection?.floorPrice?.valueUsd || 
                        a.floorPrice?.valueUsd || 
                        a.collection?.floorPrice?.value || 
                        a.floorPrice?.value || 
                        (a.contractMetadata?.openSea?.floorPrice || 0) ||
                        // Additional paths for Alchemy v3 API response format
                        (a.contract?.openSeaMetadata?.floorPrice || 0) ||
                        0;
                        
          const valueB = b.collection?.floorPrice?.valueUsd || 
                        b.floorPrice?.valueUsd ||
                        b.collection?.floorPrice?.value || 
                        b.floorPrice?.value || 
                        (b.contractMetadata?.openSea?.floorPrice || 0) ||
                        // Additional paths for Alchemy v3 API response format
                        (b.contract?.openSeaMetadata?.floorPrice || 0) ||
                        0;
          
          // Debug log for troubleshooting (only for first few NFTs)
          if (a.name && a.name === userNfts[0]?.name || b.name === userNfts[0]?.name) {
            console.log('Value comparison NFT structure:', {
              nameA: a.name, 
              valueA, 
              paths: {
                floorPriceValueUsd: a.collection?.floorPrice?.valueUsd,
                floorPriceValueUsdDirect: a.floorPrice?.valueUsd,
                floorPriceEth: a.collection?.floorPrice?.value,
                floorPriceEthDirect: a.floorPrice?.value,
                openSea: a.contractMetadata?.openSea?.floorPrice,
                openSeaV3: a.contract?.openSeaMetadata?.floorPrice
              }
            });
          }
          
          // Convert to numbers to ensure proper comparison
          const numA = parseFloat(valueA) || 0;
          const numB = parseFloat(valueB) || 0;
          
          const result = sortOrder === 'asc' 
            ? numA - numB 
            : numB - numA;
            
          return result;
        });
        
      case 'recent':
        return nftsCopy.sort((a, b) => {
          // Prioritize transferTimestamp which comes from Alchemy's getAssetTransfers
          // Then fall back to other timestamp fields if available
          const timeA = a.transferTimestamp || 
                       a.lastActivityTimestamp || 
                       a.acquiredAt || 
                       a.lastTransferTimestamp || 
                       a.mintedAt ||
                       a.timeLastUpdated ||
                       a.createdAt;
                       
          const timeB = b.transferTimestamp || 
                       b.lastActivityTimestamp || 
                       b.acquiredAt || 
                       b.lastTransferTimestamp || 
                       b.mintedAt ||
                       b.timeLastUpdated ||
                       b.createdAt;
          
          // Debug timestamps for the first few NFTs to help troubleshoot
          if (a === userNfts[0] || b === userNfts[0]) {
            console.log('Recent sorting timestamp info:', {
              name: a.name || a.title,
              transferTimestampA: a.transferTimestamp,
              otherTimestampA: a.lastActivityTimestamp || a.acquiredAt || a.lastTransferTimestamp || a.timeLastUpdated,
              allTimestampsA: {
                transfer: a.transferTimestamp,
                lastActivity: a.lastActivityTimestamp,
                acquired: a.acquiredAt,
                lastTransfer: a.lastTransferTimestamp,
                timeLastUpdated: a.timeLastUpdated
              },
              transferTimestampB: b.transferTimestamp,
              otherTimestampB: b.lastActivityTimestamp || b.acquiredAt || b.lastTransferTimestamp || b.timeLastUpdated
            });
          }
          
          // If both have timestamps, compare them as dates
          if (timeA && timeB) {
            try {
              const dateA = new Date(timeA);
              const dateB = new Date(timeB);
              return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
            } catch (e) {
              console.warn('Error comparing dates:', e);
              // Fall through to numeric comparison
            }
          }
          
          // If one has timestamp and other doesn't, prioritize the one with timestamp
          if (timeA && !timeB) return sortOrder === 'asc' ? -1 : 1;
          if (!timeA && timeB) return sortOrder === 'asc' ? 1 : -1;
          
          // If neither has a timestamp or date comparison failed, fall back to token ID
          const idA = parseInt(a.tokenId || a.token_id || '0') || 0;
          const idB = parseInt(b.tokenId || b.token_id || '0') || 0;
          
          return sortOrder === 'asc' ? idA - idB : idB - idA;
        });
        
      case 'collection':
      default:
        return nftsCopy.sort((a, b) => {
          // Enhanced collection name extraction with more fallbacks
          const collA = (a.collection?.name || 
                       a.collectionName || 
                       a.contract?.name || 
                       a.contractMetadata?.name ||
                       '').toLowerCase();
                       
          const collB = (b.collection?.name || 
                       b.collectionName || 
                       b.contract?.name || 
                       b.contractMetadata?.name ||
                       '').toLowerCase();
          
          // Helper function to determine if a character is a letter
          const isLetter = (char) => /[a-z]/i.test(char);
          
          // Helper function to determine if collection starts with letter
          const startsWithLetter = (str) => str.length > 0 && isLetter(str[0]);
          
          // Empty collections (with '') should be sorted last
          if (collA === '' && collB !== '') {
            return sortOrder === 'asc' ? 1 : -1; // Empty collections last
          }
          if (collA !== '' && collB === '') {
            return sortOrder === 'asc' ? -1 : 1; // Empty collections last
          }
          
          // If same collection, sort by token ID
          if (collA === collB) {
            // Parse token IDs as numbers when possible
            const idA = parseInt(a.tokenId || a.token_id || '0') || 0;
            const idB = parseInt(b.tokenId || b.token_id || '0') || 0;
            
            return sortOrder === 'asc' ? idA - idB : idB - idA;
          }
          
          // If one starts with letter and other doesn't, letter comes first
          if (startsWithLetter(collA) && !startsWithLetter(collB)) {
            return sortOrder === 'asc' ? -1 : 1; // Letters first
          }
          if (!startsWithLetter(collA) && startsWithLetter(collB)) {
            return sortOrder === 'asc' ? 1 : -1; // Letters first
          }
          
          // Normal comparison for collections that both start with letters or both don't
          const result = sortOrder === 'asc' 
            ? collA.localeCompare(collB, undefined, { numeric: true }) 
            : collB.localeCompare(collA, undefined, { numeric: true });
            
          return result;
        });
    }
  }, [userNfts, sortBy, sortOrder]);
  
  // Function to filter NFTs by search term
  const filterNftsBySearch = useCallback((nfts) => {
    if (!searchQuery.trim()) return nfts;
    
    const searchTerm = searchQuery.toLowerCase();
    return nfts.filter(nft => {
      const name = (nft.name || nft.title || `#${nft.tokenId || '0'}`).toLowerCase();
      const collection = ((nft.collection && nft.collection.name) || 
                          (nft.collectionName) || 
                          (nft.contract && nft.contract.name) || '').toLowerCase();
      
      return name.includes(searchTerm) || collection.includes(searchTerm);
    });
  }, [searchQuery]);

  // Apply filter to sorted NFTs
  const filteredAndSortedNfts = useCallback(() => {
    return filterNftsBySearch(sortedNfts());
  }, [filterNftsBySearch, sortedNfts]);
  
  /**
   * Handle search for Farcaster user and their NFTs
   */
  const handleSearch = useCallback(async (e) => {
    if (e) e.preventDefault();
    
    if (!formSearchQuery || formSearchQuery.trim() === '') {
      setSearchError('Please enter a username');
      return;
    }
    
    setIsSearching(true);
    setSearchError(null);
    setUserProfile(null);
    setWalletAddresses([]);
    setUserNfts([]);
    
    // Message to users with .eth usernames
    const originalQuery = formSearchQuery.trim();
    const isEthDomain = originalQuery.toLowerCase().endsWith('.eth');
    const isWarpcastLink = originalQuery.includes('warpcast.com/');
    
    try {
      // Extract username from Warpcast URLs
      let cleanQuery = originalQuery;
      
      if (isWarpcastLink) {
        // Extract username from warpcast.com/username format
        const matches = originalQuery.match(/warpcast\.com\/([^\/\?#]+)/i);
        if (matches && matches[1]) {
          cleanQuery = matches[1].trim();
          console.log(`Extracted username '${cleanQuery}' from Warpcast URL`);
        }
      }
      
      console.log(`Searching for Farcaster user: ${cleanQuery}`);
      
      // Try to find the Farcaster profile using Zapper API
      let profile;
      try {
        profile = await getFarcasterProfile(cleanQuery);
      } catch (profileError) {
        console.error('Profile search error:', profileError);
        throw new Error(`Could not find Farcaster user "${cleanQuery}". Please check the username and try again.`);
      }
      
      if (!profile) {
        throw new Error(`Could not find Farcaster user "${cleanQuery}". Please check the username and try again.`);
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
        console.warn(`No valid addresses found for user ${cleanQuery}`);
        throw new Error(`Found profile for ${cleanQuery} but no wallet addresses are connected.`);
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
        console.log(`Fetching NFTs for addresses:`, addresses);
        
        try {
          // Use the NFTContext to fetch NFTs - this eliminates duplicate fetching
          const result = await fetchAllNFTsForWallets(addresses, {
            excludeSpam: true,
            fetchAll: true
          });
          
          // Process result
          if (!result) {
            setUserNfts([]);
            setSearchError('Could not fetch NFTs: Received empty response from server');
          } else if (result.error) {
            setUserNfts(result.nfts || []);
            setSearchError(`Could not fetch all NFTs: ${result.error}`);
          } else if (!result.nfts) {
            setUserNfts([]);
            setSearchError('Could not fetch NFTs: Invalid response format from server');
          } else {
            console.log(`Fetched ${result.nfts.length} NFTs for user ${cleanQuery}`);
            setUserNfts(result.nfts);
            
            if (result.nfts.length > 0) {
              setSearchError(null);
            } else {
              setSearchError(`No NFTs found for user ${cleanQuery}. They might not own any NFTs on the supported chains.`);
            }
          }
        } catch (nftError) {
          console.error('Error in NFT fetch process:', nftError);
          setSearchError(`Found profile but could not load NFTs: ${nftError.message}`);
          setUserNfts([]);
        }
      } else {
        console.log('No wallet addresses found for this user');
        setUserNfts([]);
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchError(error.message || 'Failed to find user');
    } finally {
      setIsSearching(false);
    }
  }, [formSearchQuery, fetchAllNFTsForWallets]);

  /**
   * Effect for initial search if username is provided
   * This must be at the top level, not conditionally called
   */
  useEffect(() => {
    // Only trigger search if we have an initialUsername
    if (initialUsername && initialUsername.trim()) {
      setFormSearchQuery(initialUsername.trim());
      // We'll handle the actual search in a separate effect to avoid calling handleSearch directly
    }
  }, [initialUsername]); // Note: do NOT include handleSearch in dependencies

  // Separate effect to handle searching when formSearchQuery changes from initialUsername
  useEffect(() => {
    // Only perform search if formSearchQuery was set from initialUsername
    const searchFromInitial = formSearchQuery && formSearchQuery === initialUsername && initialUsername.trim();
    
    if (searchFromInitial) {
      // Call handleSearch with no arguments to avoid event handling issues
      const performSearch = async () => {
        try {
          await handleSearch();
        } catch (err) {
          console.error("Error performing initial search:", err);
        }
      };
      
      performSearch();
    }
  }, [formSearchQuery, initialUsername, handleSearch]);

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
          
          result = await fetchAllNFTsForWallets(addresses, {
            excludeSpam: true,
            fetchAll: true
          });
          
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
            value={formSearchQuery}
            onChange={(e) => setFormSearchQuery(e.target.value)}
            placeholder="Enter Farcaster username (e.g. dwr, vitalik)"
            className="search-input"
            aria-label="Farcaster username"
            disabled={isSearching}
          />
          <button 
            type="submit"
            className="search-button"
            disabled={!formSearchQuery.trim() || isSearching}
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
                <NFTSearchBar />
              </div>
              
              {/* Add sort controls if NFTs are available */}
              {userNfts.length > 0 && (
                <div className="nft-header-right">
                  <NFTSortControls />
                </div>
              )}
            </div>
            
            {/* Use the existing NFTGallery component to display NFTs */}
            {isNftLoading ? (
              <div className="loading-spinner"></div>
            ) : (
              <div className="nft-section nft-display">
                <NFTGrid nfts={filteredAndSortedNfts()} isLoading={isSearching && userNfts.length === 0} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FarcasterUserSearch; 