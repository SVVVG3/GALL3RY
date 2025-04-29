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
import NFTCard from './NftCard';
import NFTGallery from './NFTGallery';

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
  } = useNFT();
  
  const dispatch = useDispatch();
  
  // Initialize state with Redux or default values
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
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
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
  
  // Get filter/sort state from Redux or use local defaults
  const { searchTerm, sortOption, sortDirection, selectedWallet } = useSelector(state => ({
    searchTerm: state.nftFilters?.searchTerm || '',
    sortOption: state.nftFilters?.sortOption || 'collection', 
    sortDirection: state.nftFilters?.sortDirection || 'asc',
    selectedWallet: state.nftFilters?.selectedWallet || 'all'
  }));
  
  // Create alias for better readability in component
  const sortBy = sortOption;
  const sortOrder = sortDirection;
  
  // Notify parent component when NFTs are displayed
  useEffect(() => {
    if (onNFTsDisplayChange && typeof onNFTsDisplayChange === 'function') {
      // We have NFTs to display if userProfile exists and userNfts has items
      const hasNFTsToDisplay = Boolean(userProfile && userNfts.length > 0);
      onNFTsDisplayChange(hasNFTsToDisplay);
    }
  }, [userProfile, userNfts, onNFTsDisplayChange]);
  
  // Handle input change and fetch suggestions
  const handleInputChange = async (e) => {
    const value = e.target.value;
    setFormSearchQuery(value);
    
    if (value.trim().length > 0) {
      setIsLoadingSuggestions(true);
      setShowSuggestions(true);
      try {
        const results = await farcasterService.searchUsers(value);
        setSuggestions(results);
      } catch (error) {
        console.error('Error fetching suggestions:', error);
        setSuggestions([]);
      }
      setIsLoadingSuggestions(false);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  // Handle suggestion selection
  const handleSuggestionSelect = async (user) => {
    const username = user.username;
    // Update form query
    setFormSearchQuery(username);
    // Clear suggestions
    setSuggestions([]);
    setShowSuggestions(false);
    
    // Ensure we're using the username directly in the search
    try {
      console.log('Searching for selected user:', username);
      // Clear any previous errors
      setSearchError(null);
      // Trigger search with the username
      await handleSearch(username);
    } catch (error) {
      console.error('Error searching for selected user:', error);
      setSearchError(error.message);
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

  // Filter NFTs by wallet if a specific wallet is selected
  const filterNftsByWallet = useCallback((nfts) => {
    if (!selectedWallet || selectedWallet === 'all') {
      return nfts; // Return all NFTs if no wallet is selected or 'all' is selected
    }
    
    // Filter NFTs to only those owned by the selected wallet
    return nfts.filter(nft => {
      const ownerWallet = (nft.ownerWallet || nft.ownerAddress || '').toLowerCase();
      return ownerWallet === selectedWallet.toLowerCase();
    });
  }, [selectedWallet]);

  // Apply filter to sorted NFTs
  const filteredAndSortedNfts = useCallback(() => {
    // Add debug logging
    console.log('filteredAndSortedNfts called, userNfts length:', userNfts.length);
    
    try {
      // First sort NFTs
      const sorted = sortedNfts();
      
      // Then filter by wallet
      const walletFiltered = filterNftsByWallet(sorted);
      
      // Then filter by search term
      const result = filterNftsBySearch(walletFiltered);
      
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
  }, [filterNftsBySearch, filterNftsByWallet, sortedNfts, userNfts.length]);
  
  /**
   * Handle search for Farcaster user and their NFTs
   */
  const handleSearch = useCallback(async (searchParam) => {
    // Get the query from either the search parameter, event, or current form state
    let query = '';
    
    // If searchParam is a string (direct username search)
    if (typeof searchParam === 'string') {
      query = searchParam.trim();
      console.log('Handling direct username search for:', query);
    }
    // If searchParam is an event (form submission)
    else if (searchParam && searchParam.preventDefault) {
      searchParam.preventDefault();
      query = formSearchQuery.trim();
      console.log('Handling form submission search for:', query);
    }
    // If no parameter provided, use current form state
    else {
      query = formSearchQuery.trim();
      console.log('Handling default search for:', query);
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
      
      console.log(`Initiating Farcaster user search for: ${query}`);
      
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
      
      if (!profile) {
        throw new Error(`User ${query} not found`);
      }
      
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

        // Define an update callback for progressive loading
        const updateProgressCallback = (progressData) => {
          if (progressData && progressData.nfts) {
            // Format the NFTs for display
            const formattedProgressNfts = formatNFTsForDisplay(progressData.nfts);
            
            console.log(`Progressive update: Received ${progressData.nfts.length} NFTs, after formatting: ${formattedProgressNfts.length}`);
            
            // Update the NFT state with the latest data
            setUserNfts(formattedProgressNfts);
            
            // If this is a final update (not in progress), set searching to false
            if (!progressData.inProgress) {
              setIsSearching(false);
            }
          }
        };

        // Use our dedicated method for Farcaster users with pagination enabled
        const result = await fetchNftsForFarcaster(
          walletAddresses,
          {
            chains: ['eth', 'polygon', 'opt', 'arb', 'base'],
            excludeSpam: true,
            excludeAirdrops: true,
            pageSize: 100,
            useAdvancedSpamFilter: true, // Enable advanced spam filtering
            aggressiveSpamFiltering: true, // Use aggressive mode
            updateCallback: updateProgressCallback // Pass the callback for progressive updates
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
        
        // Set the NFTs in component state
        setUserNfts(formattedNfts);
        
        // Update Redux store if available
        if (dispatch && setNftList) {
          dispatch(setNftList(formattedNfts));
        }
        
        // Ensure search state is complete
        setIsSearching(false);
        
        return {
          profile,
          nfts: formattedNfts
        };
      } catch (fetchError) {
        console.error('Error fetching NFTs:', fetchError);
        setSearchError(`Error fetching NFTs: ${fetchError.message}`);
        setIsSearching(false);
        throw fetchError;
      }
    } catch (error) {
      console.error('Error in Farcaster search:', error);
      setSearchError(error.message);
      setIsSearching(false);
      throw error;
    }
  }, [userProfile, formSearchQuery, dispatch, fetchAllNFTsForWallets]);

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
          <div className="username-input-container">
            <input
              type="text"
              ref={inputRef}
              value={formSearchQuery}
              onChange={handleInputChange}
              placeholder="Enter Farcaster username (e.g. dwr, vitalik)"
              className="search-input"
              aria-label="Farcaster username"
              disabled={isSearching}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
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

        <FarcasterSuggestions 
          suggestions={suggestions}
          onSelect={handleSuggestionSelect}
          visible={showSuggestions}
          loading={isLoadingSuggestions}
        />
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
                  <NFTSortControls walletAddresses={walletAddresses} />
                </div>
              )}
            </div>
            
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