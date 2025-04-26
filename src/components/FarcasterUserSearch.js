import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNFT } from '../contexts/NFTContext';
import { getFarcasterProfile } from '../services/zapperService';
import VirtualizedNFTGrid from './VirtualizedNFTGrid';
import { FaSort, FaTimes } from 'react-icons/fa';
import '../styles/FarcasterUserSearch.css';
import '../styles/FarcasterProfile.css';
import safeStorage from '../utils/storage';
import NFTSearchBar from './NFTSearchBar';
import NFTSortControls from './NFTSortControls';
import farcasterService from '../services/farcasterService';
import FarcasterSuggestions from './FarcasterSuggestions';
import { useDispatch, useSelector } from 'react-redux';
import { formatNFTsForDisplay, removeDuplicates } from '../utils/nftUtils';
import alchemyService, { fetchNftsForAddresses, fetchNftsSimple, fetchNftsForFarcaster } from '../services/alchemyService';
import { setNftList } from '../redux/nftFiltersSlice';
import * as zapperService from '../services/zapperService';
import NFTDebugView from './NFTDebugView';

// Validates if a string is a valid Ethereum address
const isValidAddress = (address) => {
  return address && 
         typeof address === 'string' && 
         address.startsWith('0x') && 
         address.length === 42 &&
         /^0x[0-9a-fA-F]{40}$/.test(address);
};

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
  
  const dispatch = useDispatch();
  
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
  const [suggestions, setSuggestions] = useState([]);
  const [inputRect, setInputRect] = useState(null);
  
  // Input reference for positioning the dropdown
  const inputRef = useRef(null);
  
  // Define the updateInputRect function
  const updateInputRect = useCallback(() => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setInputRect(rect);
      console.log('Updated input rect:', rect);
    }
  }, [inputRef]);
  
  // NFT filtering and sorting from redux
  const { searchTerm, sortOption, sortDirection } = useSelector(state => ({
    searchTerm: state.nftFilters?.searchTerm || '',
    sortOption: state.nftFilters?.sortOption || 'acquisition',
    sortDirection: state.nftFilters?.sortDirection || 'desc'
  }));
  
  // Notify parent component when NFTs are displayed
  useEffect(() => {
    if (onNFTsDisplayChange && typeof onNFTsDisplayChange === 'function') {
      // We have NFTs to display if userProfile exists and userNfts has items
      const hasNFTsToDisplay = Boolean(userProfile && userNfts.length > 0);
      onNFTsDisplayChange(hasNFTsToDisplay);
    }
  }, [userProfile, userNfts, onNFTsDisplayChange]);
  
  // Handle selection from suggestions dropdown
  const handleSuggestionSelect = (username) => {
    console.log('Selected username:', username);
    
    // Set form query
    setFormSearchQuery(username);
    
    // Execute search immediately
    handleSearch({ preventDefault: () => {} });
    
    // Blur the input to hide mobile keyboard
    if (inputRef.current) {
      inputRef.current.blur();
    }
  };
  
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
                        // Direct floor price values
                        (typeof a.collection?.floorPrice === 'number' ? a.collection.floorPrice : 0) ||
                        (typeof a.floorPrice === 'number' ? a.floorPrice : 0) ||
                        0;
                        
          const valueB = b.collection?.floorPrice?.valueUsd || 
                        b.floorPrice?.valueUsd ||
                        b.collection?.floorPrice?.value || 
                        b.floorPrice?.value || 
                        (b.contractMetadata?.openSea?.floorPrice || 0) ||
                        // Additional paths for Alchemy v3 API response format
                        (b.contract?.openSeaMetadata?.floorPrice || 0) ||
                        // Direct floor price values
                        (typeof b.collection?.floorPrice === 'number' ? b.collection.floorPrice : 0) ||
                        (typeof b.floorPrice === 'number' ? b.floorPrice : 0) ||
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
                openSeaV3: a.contract?.openSeaMetadata?.floorPrice,
                directCollectionFloorPrice: typeof a.collection?.floorPrice === 'number' ? a.collection.floorPrice : null,
                directFloorPrice: typeof a.floorPrice === 'number' ? a.floorPrice : null
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
    // Add debug logging
    console.log('filteredAndSortedNfts called, userNfts length:', userNfts.length);
    
    try {
      const result = filterNftsBySearch(sortedNfts());
      console.log('Returning filtered and sorted NFTs:', {
        count: result.length,
        sample: result.length > 0 ? result[0] : null
      });
      
      // Ensure result is not null/undefined and is an array
      if (!result || !Array.isArray(result)) {
        console.warn('filteredAndSortedNfts returned non-array result:', result);
        return { count: 0, data: [], isLoading: false };
      }
      
      // Return properly formatted data for VirtualizedNFTGrid
      return {
        count: result.length,
        data: result,
        sample: result.length > 0 ? result[0] : null,
        isLoading: false
      };
    } catch (error) {
      console.error('Error in filteredAndSortedNfts:', error);
      return { count: 0, data: [], isLoading: false };
    }
  }, [filterNftsBySearch, sortedNfts, userNfts.length]);
  
  /**
   * Handle search for Farcaster user and their NFTs
   */
  const handleSearch = useCallback(async (e) => {
    // Prevent default form submission if this is an event
    if (e && e.preventDefault) {
      e.preventDefault();
    }
    
    // Get the query either from the event or use the current formSearchQuery
    let query = '';
    if (e && e.target && e.target.value) {
      query = e.target.value.trim();
    } else {
      query = formSearchQuery.trim();
    }
    
    if (query.length < 1) {
      setUserProfile(null);
      setSearchError(null);
      return;
    }
    
    try {
      setIsSearching(true);
      setSearchError(null);
      
      // Clear previous user data to prevent lingering display
      if (userProfile && userProfile.username !== query) {
        setUserNfts([]);
        setWalletAddresses([]);
      }
      
      console.log(`Searching for Farcaster user: ${query}`);
      
      // Check if we already have this profile cached
      let profile = userProfile;
      if (!profile || profile.username !== query) {
        try {
          profile = await zapperService.getFarcasterProfile(query);
          console.log('Zapper API returned profile:', profile);
        } catch (zapperError) {
          console.warn('Zapper API failed, falling back to farcasterService:', zapperError.message);
          // Fallback to farcasterService if Zapper fails
          profile = await farcasterService.getProfile({ username: query });
        }
      }
      
      if (profile) {
        // Only proceed with NFT fetching if this is a new profile or forced refresh
        if (!userProfile || userProfile.username !== profile.username) {
          setUserProfile(profile);
          await handleUserProfileFound(profile);
        }
      } else {
        // Provide a more detailed error message, especially for .eth addresses
        if (query.includes('.eth')) {
          setSearchError(
            `No user found with username '${query}'. Note that Farcaster usernames might not include the .eth suffix. Try searching for '${query.split('.')[0]}' instead.`
          );
        } else {
          setSearchError(`No user found with username '${query}'. Please check the spelling and try again.`);
        }
      }
    } catch (error) {
      console.error('Error searching for user:', error);
      
      // Provide more helpful error messages based on the type of error
      if (error.response && error.response.status === 404) {
        setSearchError(`User '${query}' not found in the Farcaster network.`);
      } else if (error.code === 'ECONNABORTED') {
        setSearchError('Search timed out. Please try again or check your internet connection.');
      } else {
        setSearchError(error.message || 'Failed to search user. Please try again later.');
      }
    } finally {
      setIsSearching(false);
    }
  }, [formSearchQuery, userProfile]);

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

  // Handle when a user profile is found
  const handleUserProfileFound = async (profile) => {
    // Set loading state
    setIsSearching(true);
    setSearchError(null);
    
    try {
      console.log('User profile found:', profile);
      
      // Prepare wallet addresses
      const walletAddresses = [
        ...new Set([
          profile.custodyAddress,
          ...(profile.connectedAddresses || [])
        ])
      ].filter(address => isValidAddress(address));
      
      console.log(`Processing ${walletAddresses.length} valid wallet addresses`);
      
      // Update user profile and wallet addresses immediately
      setUserProfile(profile);
      setWalletAddresses(walletAddresses);
      
      if (walletAddresses.length === 0) {
        throw new Error('No valid wallet addresses found');
      }

      // Use our dedicated method for Farcaster users with pagination enabled
      const result = await fetchNftsForFarcaster(
        walletAddresses,
        {
          chains: ['eth', 'polygon', 'opt', 'arb', 'base'],
          excludeSpam: true,
          excludeAirdrops: true, // Add filtering for airdrops as supported by Alchemy
          pageSize: 100
        }
      );
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      const nfts = result.nfts || [];
      
      console.log(`Fetched ${nfts.length} unique NFTs for user ${profile.username}`);
      console.log(`NFT distribution by wallets:`, result.walletNftCounts);
      
      // Format NFTs for display - no need for additional deduplication
      // as fetchNftsForFarcaster already handles this with createConsistentUniqueId
      const formattedNfts = formatNFTsForDisplay(nfts);
      
      // Log stats without additional deduplication
      console.log(`Original unique NFTs: ${nfts.length}, Formatted for display: ${formattedNfts.length}`);
      
      // After formatting the NFTs for display but before returning
      if (formattedNfts.length > 0) {
        console.log('Sample NFT structure:', JSON.stringify(formattedNfts[0], null, 2));
      }
      
      // Update NFTs state and Redux store
      setUserNfts(formattedNfts);
      dispatch(setNftList(formattedNfts));

    } catch (error) {
      console.error('Error in handleUserProfileFound:', error);
      setSearchError(`Error fetching NFTs: ${error.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  // Update the input rect whenever input is focused or window is resized
  useEffect(() => {
    // Update initially
    updateInputRect();
    
    // Update on resize
    window.addEventListener('resize', updateInputRect);
    
    // Update on focus
    if (inputRef.current) {
      inputRef.current.addEventListener('focus', updateInputRect);
    }
    
    return () => {
      window.removeEventListener('resize', updateInputRect);
      if (inputRef.current) {
        inputRef.current.removeEventListener('focus', updateInputRect);
      }
    };
  }, [updateInputRect]);

  // Add an effect that clears suggestions on search
  useEffect(() => {
    // When user is searching, clear any existing suggestions
    if (isSearching) {
      setSuggestions([]);
    }
  }, [isSearching]);

  // Add event listener to dismiss suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Don't dismiss if clicking on the search input or its children
      if (inputRef.current && inputRef.current.contains(event.target)) {
        return;
      }
      
      // Don't dismiss if clicking within the suggestions dropdown
      const suggestionPortal = document.getElementById('suggestion-portal');
      if (suggestionPortal && suggestionPortal.contains(event.target)) {
        return;
      }
      
      // Otherwise, dismiss suggestions
      if (suggestions.length > 0) {
        setSuggestions([]);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [suggestions.length]);

  return (
    <div className="farcaster-search-container">
      <div className="search-header">
        <p className="search-instructions">Enter a Farcaster username to explore their NFT collection</p>
      </div>
      
      <form onSubmit={(e) => {
        e.preventDefault();
        handleSearch(e);
      }} className="search-form">
        <div className="search-input-wrapper">
          <div className="username-input-container" style={{ position: "relative", flex: "1" }}>
            <input
              type="text"
              ref={inputRef}
              value={formSearchQuery}
              onChange={(e) => {
                setFormSearchQuery(e.target.value);
              }}
              placeholder="Enter Farcaster username (e.g. dwr, vitalik)"
              className="search-input"
              style={{
                width: "100%",
                padding: "12px 16px",
                fontSize: "16px",
                border: "1px solid #d1d5db",
                borderRadius: "8px 0 0 8px",
                outline: "none"
              }}
              aria-label="Farcaster username"
              disabled={isSearching}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
            />
            
            {/* Use our new standalone suggestions component */}
            <FarcasterSuggestions 
              inputValue={formSearchQuery}
              onSelectSuggestion={handleSuggestionSelect}
              inputRef={inputRef}
            />
          </div>
          
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
                  {isSearching ? (
                    <p className="loading-nft-count">
                      <span className="spinner-small"></span> Loading NFTs...
                    </p>
                  ) : (
                    <p>🖼️ Found {userNfts.length} NFTs</p>
                  )}
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
            
            {/* Debug view for NFT data */}
            {userNfts.length > 0 && (
              <NFTDebugView 
                nfts={userNfts.slice(0, 5)} 
                isLoading={isSearching} 
              />
            )}
            
            {/* Use the virtualized grid to display NFTs */}
            <div className="nft-section nft-display">
              <VirtualizedNFTGrid 
                nfts={filteredAndSortedNfts()} 
                isLoading={isSearching} 
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FarcasterUserSearch; 