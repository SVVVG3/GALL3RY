import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNFT } from '../contexts/NFTContext';
import { getFarcasterProfile } from '../services/zapperService';
import NFTGrid from './NFTGrid';
import { FaSort } from 'react-icons/fa';
import '../styles/FarcasterUserSearch.css';
import '../styles/FarcasterProfile.css';
import safeStorage from '../utils/storage';
import NFTSearchBar from './NFTSearchBar';
import NFTSortControls from './NFTSortControls';
import farcasterService from '../services/farcasterService';
import SuggestionPortal from './SuggestionPortal';
import ReactDOM from 'react-dom';

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
  
  // Username suggestions dropdown state
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchInputRef = useRef(null);
  const suggestionsRef = useRef(null);
  
  // Add new state for input position
  const [inputRect, setInputRect] = useState(null);
  
  // Add a ref to track if suggestions should be shown
  const shouldShowSuggestionsRef = useRef(true);
  
  // Define updateInputRect function at component level so it's available everywhere
  const updateInputRect = useCallback(() => {
    if (searchInputRef.current) {
      const rect = searchInputRef.current.getBoundingClientRect();
      setInputRect(rect);
      console.log('Input rect updated:', rect);
    }
  }, []);
  
  // Notify parent component when NFTs are displayed
  useEffect(() => {
    if (onNFTsDisplayChange && typeof onNFTsDisplayChange === 'function') {
      // We have NFTs to display if userProfile exists and userNfts has items
      const hasNFTsToDisplay = Boolean(userProfile && userNfts.length > 0);
      onNFTsDisplayChange(hasNFTsToDisplay);
    }
  }, [userProfile, userNfts, onNFTsDisplayChange]);
  
  // Handle clicks outside the suggestions dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        suggestionsRef.current && 
        !suggestionsRef.current.contains(event.target) &&
        searchInputRef.current && 
        !searchInputRef.current.contains(event.target)
      ) {
        setShowSuggestions(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Fetch username suggestions as the user types
  useEffect(() => {
    const fetchSuggestions = async () => {
      // Only show suggestions if user has typed at least 2 characters
      if (formSearchQuery.trim().length < 2) {
        console.log('Not enough characters to show suggestions (need at least 2)');
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }
      
      console.log('Fetching suggestions for:', formSearchQuery.trim());
      try {
        console.log('Calling farcasterService.searchUsers with:', formSearchQuery.trim());
        const users = await farcasterService.searchUsers(formSearchQuery.trim(), 5);
        console.log('Suggestion API response:', users);
        console.log('Response type:', typeof users, 'Is array:', Array.isArray(users), 'Length:', users?.length);
        
        // Set suggestions first
        setSuggestions(users);
        
        // Force-render the suggestions immediately if we have results
        if (users && users.length > 0) {
          console.log('FORCE SHOWING SUGGESTIONS: TRUE - with', users.length, 'suggestions');
          setShowSuggestions(true);
        } else {
          console.log('No suggestions found, hiding dropdown');
          setShowSuggestions(false);
        }
      } catch (error) {
        console.error('Error fetching suggestions:', error);
        setSuggestions([]);
        setShowSuggestions(false);
      }
    };
    
    fetchSuggestions();
  }, [formSearchQuery]);

  // Force-render a log message whenever showSuggestions changes
  useEffect(() => {
    console.log('🔴 showSuggestions state changed to:', showSuggestions);
    console.log('🔵 Current suggestions count:', suggestions.length);
    
    if (showSuggestions && suggestions.length > 0) {
      console.log('Should be showing dropdown now with', suggestions.length, 'items');
    }
  }, [showSuggestions, suggestions]);

  // Ensure suggestions are cleared when component unmounts
  useEffect(() => {
    return () => {
      setSuggestions([]);
      // Clean up any suggestion portals that might still exist
      const existingPortals = document.querySelectorAll('#suggestion-portal');
      existingPortals.forEach(portal => {
        if (document.body.contains(portal)) {
          document.body.removeChild(portal);
        }
      });
    };
  }, []);
  
  // Handle suggestion selection with immediate forceful cleanup
  const handleSelectSuggestion = (username) => {
    console.log('Selection made, forcefully clearing suggestions');
    
    // Set the ref to false to prevent showing suggestions
    shouldShowSuggestionsRef.current = false;
    
    // Set the form query
    setFormSearchQuery(username);
    
    // Clear suggestions array
    setSuggestions([]);
    
    // Force immediate portal removal
    const forceCleanup = () => {
      // Find all portal elements
      const portalElements = document.querySelectorAll('#suggestion-portal');
      console.log(`Found ${portalElements.length} portals to remove`);
      
      // Remove each portal
      portalElements.forEach(el => {
        try {
          // Try to unmount React components first
          ReactDOM.unmountComponentAtNode(el);
        } catch (err) {
          console.error('Error unmounting portal', err);
        }
        
        // Remove from DOM directly
        try {
          if (document.body.contains(el)) {
            document.body.removeChild(el);
            console.log('Portal removed from DOM');
          }
        } catch (err) {
          console.error('Error removing portal from DOM', err);
        }
      });
      
      // After a short delay, allow suggestions to be shown again
      setTimeout(() => {
        shouldShowSuggestionsRef.current = true;
      }, 500);
    };
    
    // Run cleanup immediately AND after a small delay for safety
    forceCleanup();
    setTimeout(forceCleanup, 50);
    
    // Trigger search
    handleSearch({ preventDefault: () => {} }, username);
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
    
    // Record the current position for proper dropdown rendering
    updateInputRect();
    
    const searchQuery = formSearchQuery?.trim() || '';
    if (!searchQuery) {
      setSearchError('Please enter a Farcaster username');
      return;
    }
    
    // Reset states
    setIsSearching(true);
    setSearchError(null);
    setUserProfile(null);
    setWalletAddresses([]);
    setUserNfts([]);
    
    try {
      let originalQuery = searchQuery;
      let cleanQuery = searchQuery.replace('@', '').trim();
      
      // Check if it's a Warpcast URL
      const isWarpcastLink = 
        searchQuery.includes('warpcast.com/') || 
        searchQuery.includes('farcaster.xyz/');
      
      if (isWarpcastLink) {
        // Extract username from warpcast.com/username format
        const matches = originalQuery.match(/warpcast\.com\/([^\/\?#]+)/i);
        if (matches && matches[1]) {
          cleanQuery = matches[1].trim();
          console.log(`Extracted username '${cleanQuery}' from Warpcast URL`);
        }
      }
      
      console.log(`Searching for Farcaster user: ${cleanQuery}`);
      
      // Try to find the Farcaster profile with better error handling
      let profile;
      try {
        // Try zapperService first
        profile = await getFarcasterProfile(cleanQuery);
      } catch (profileError) {
        console.error('Profile search error from zapperService:', profileError);
        
        // Fallback to farcasterService if zapperService fails
        try {
          console.log('Trying farcasterService as fallback...');
          const farcasterService = await import('../services/farcasterService');
          
          if (cleanQuery.match(/^\d+$/)) {
            // If numeric, treat as FID
            profile = await farcasterService.getProfile({ fid: parseInt(cleanQuery, 10) });
          } else {
            // Otherwise treat as username
            profile = await farcasterService.getProfile({ username: cleanQuery });
          }
          
          if (profile) {
            console.log('Profile found via farcasterService fallback:', profile);
          }
        } catch (fallbackError) {
          console.error('Fallback profile search also failed:', fallbackError);
          // If both attempts fail, throw a user-friendly error
          throw new Error(`Could not find Farcaster user "${cleanQuery}". Please check the username and try again.`);
        }
      }
      
      if (!profile) {
        throw new Error(`Could not find Farcaster user "${cleanQuery}". Please check the username and try again.`);
      }
      
      console.log('Farcaster profile found:', profile);
      
      // Get wallet addresses with enhanced error handling
      let addresses = [];
      
      try {
        // Try to get all addresses using zapperService first
        const allAddresses = await getFarcasterAddresses(cleanQuery);
        if (allAddresses && allAddresses.length > 0) {
          addresses = allAddresses;
          console.log(`Found ${addresses.length} addresses using getFarcasterAddresses`);
        } else {
          // Fallback: add individual addresses from the profile
          console.log('No addresses from getFarcasterAddresses, using profile data directly');
          
          // Add custody address if it exists
          if (profile.custodyAddress) {
            addresses.push(profile.custodyAddress);
          }
          
          // Add connected addresses if they exist
          if (profile.connectedAddresses && profile.connectedAddresses.length > 0) {
            addresses = [...addresses, ...profile.connectedAddresses];
          }
        }
      } catch (addressError) {
        console.error('Error getting addresses from zapperService:', addressError);
        
        // Fallback to farcasterService as a last resort
        try {
          console.log('Trying farcasterService for addresses as fallback...');
          const farcasterService = await import('../services/farcasterService');
          
          if (profile.fid) {
            const farcasterAddresses = await farcasterService.fetchAddressesForFid(profile.fid);
            if (farcasterAddresses && farcasterAddresses.length > 0) {
              addresses = farcasterAddresses;
              console.log(`Found ${addresses.length} addresses using farcasterService fallback`);
            }
          }
        } catch (fallbackAddressError) {
          console.error('Fallback address fetch also failed:', fallbackAddressError);
        }
      }
      
      // Filter out duplicates and invalid addresses
      addresses = [...new Set(addresses)].filter(addr => 
        addr && typeof addr === 'string' && addr.startsWith('0x') && addr.length === 42
      );
      
      if (addresses.length === 0) {
        console.warn(`No valid addresses found for user ${cleanQuery}`);
        throw new Error(`Found profile for ${cleanQuery} but no wallet addresses are connected.`);
      }
      
      console.log(`Filtered to ${addresses.length} valid wallet addresses`);
      
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
  }, [formSearchQuery, fetchAllNFTsForWallets, updateInputRect]);

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

  // Update the input rect whenever input is focused or window is resized
  useEffect(() => {
    // Update initially
    updateInputRect();
    
    // Update on resize
    window.addEventListener('resize', updateInputRect);
    
    // Update on focus
    if (searchInputRef.current) {
      searchInputRef.current.addEventListener('focus', updateInputRect);
    }
    
    return () => {
      window.removeEventListener('resize', updateInputRect);
      if (searchInputRef.current) {
        searchInputRef.current.removeEventListener('focus', updateInputRect);
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
      if (searchInputRef.current && searchInputRef.current.contains(event.target)) {
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

  // Define the dropdown content separately
  const renderSuggestionDropdown = () => (
    <div 
      className="username-suggestions"
      style={{
        backgroundColor: "#fff",
        border: "3px solid #8b5cf6", 
        borderRadius: "8px",
        maxHeight: "300px",
        overflowY: "auto",
        boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
      }}
    >
      {suggestions.map((user) => (
        <div 
          key={user.fid}
          className="username-suggestion-item"
          onClick={() => handleSelectSuggestion(user.username)}
          style={{
            padding: "12px 15px",
            display: "flex",
            alignItems: "center",
            borderBottom: "1px solid #e5e7eb",
            cursor: "pointer",
            backgroundColor: "#ffffff",
            transition: "background-color 0.2s"
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#f3f4f6"}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#ffffff"}
        >
          {user.imageUrl && (
            <img 
              src={user.imageUrl} 
              alt=""
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                marginRight: "12px",
                border: "2px solid #e5e7eb"
              }}
            />
          )}
          <div className="suggestion-user-info">
            <span 
              style={{
                fontWeight: "600",
                fontSize: "16px",
                color: "#111827",
                display: "block"
              }}
            >
              {user.displayName || user.username}
            </span>
            <span 
              style={{
                fontSize: "14px",
                color: "#6b7280",
                display: "block"
              }}
            >
              @{user.username}
            </span>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="farcaster-search-container">
      <div className="search-header">
        <p className="search-instructions">Enter a Farcaster username to explore their NFT collection</p>
      </div>
      
      <form onSubmit={handleSearch} className="search-form">
        <div className="search-input-wrapper">
          <div className="username-input-container" style={{ position: "relative", flex: "1" }}>
            <input
              type="text"
              ref={searchInputRef}
              value={formSearchQuery}
              onChange={(e) => setFormSearchQuery(e.target.value)}
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
            
            {/* 
              Render suggestions dropdown in a portal
              - Check shouldShowSuggestionsRef to decide whether to render
            */}
            {suggestions.length > 0 && inputRect && shouldShowSuggestionsRef.current && (
              <SuggestionPortal inputRect={inputRect}>
                {renderSuggestionDropdown()}
              </SuggestionPortal>
            )}
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