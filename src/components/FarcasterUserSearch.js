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

  // Handle form submission and search
  const handleSearch = async (e) => {
    if (e) {
      e.preventDefault();
    }

    const username = formSearchQuery.trim();
    if (!username) {
      setSearchError('Please enter a username');
      return;
    }

    try {
      setIsSearching(true);
      setSearchError(null);
      
      // Clear previous user data
      setUserNfts([]);
      setWalletAddresses([]);
      
      // Get the profile
      let profile;
      try {
        profile = await zapperService.getFarcasterProfile(username);
        console.log('Zapper API returned profile:', profile);
      } catch (zapperError) {
        console.warn('Zapper API failed, falling back to farcasterService:', zapperError.message);
        profile = await farcasterService.getProfile({ username });
      }
      
      if (!profile) {
        throw new Error(`User ${username} not found`);
      }
      
      // Update user profile immediately
      setUserProfile(profile);
      
      // Get valid wallet addresses
      const walletAddresses = [
        ...new Set([
          profile.custodyAddress,
          ...(profile.connectedAddresses || [])
        ])
      ].filter(address => isValidAddress(address));
      
      console.log(`Processing ${walletAddresses.length} valid wallet addresses`);
      
      // Update wallet addresses state
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
      await fetchNftsForFarcaster(
        walletAddresses,
        {
          chains: ['eth', 'polygon', 'opt', 'arb', 'base'],
          excludeSpam: true,
          excludeAirdrops: true,
          pageSize: 100,
          useAdvancedSpamFilter: true,
          aggressiveSpamFiltering: true,
          updateCallback: updateProgressCallback
        }
      );
    } catch (error) {
      console.error('Error in search:', error);
      setSearchError(error.message);
      setIsSearching(false);
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
                        (a.contract?.openSeaMetadata?.floorPrice || 0) ||
                        (typeof a.collection?.floorPrice === 'number' ? a.collection.floorPrice : 0) ||
                        (typeof a.floorPrice === 'number' ? a.floorPrice : 0) ||
                        0;
                        
          const valueB = b.collection?.floorPrice?.valueUsd || 
                        b.floorPrice?.valueUsd ||
                        b.collection?.floorPrice?.value || 
                        b.floorPrice?.value || 
                        (b.contractMetadata?.openSea?.floorPrice || 0) ||
                        (b.contract?.openSeaMetadata?.floorPrice || 0) ||
                        (typeof b.collection?.floorPrice === 'number' ? b.collection.floorPrice : 0) ||
                        (typeof b.floorPrice === 'number' ? b.floorPrice : 0) ||
                        0;
          
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
          
          // If both have timestamps, compare them as dates
          if (timeA && timeB) {
            try {
              const dateA = new Date(timeA);
              const dateB = new Date(timeB);
              return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
            } catch (e) {
              console.warn('Error comparing dates:', e);
            }
          }
          
          // If one has timestamp and other doesn't, prioritize the one with timestamp
          if (timeA && !timeB) return sortOrder === 'asc' ? -1 : 1;
          if (!timeA && timeB) return sortOrder === 'asc' ? 1 : -1;
          
          // If neither has a timestamp, fall back to token ID
          const idA = parseInt(a.tokenId || a.token_id || '0') || 0;
          const idB = parseInt(b.tokenId || b.token_id || '0') || 0;
          
          return sortOrder === 'asc' ? idA - idB : idB - idA;
        });
        
      case 'collection':
      default:
        return nftsCopy.sort((a, b) => {
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
            return sortOrder === 'asc' ? 1 : -1;
          }
          if (collA !== '' && collB === '') {
            return sortOrder === 'asc' ? -1 : 1;
          }
          
          // If same collection, sort by token ID
          if (collA === collB) {
            const idA = parseInt(a.tokenId || a.token_id || '0') || 0;
            const idB = parseInt(b.tokenId || b.token_id || '0') || 0;
            
            return sortOrder === 'asc' ? idA - idB : idB - idA;
          }
          
          // If one starts with letter and other doesn't, letter comes first
          if (startsWithLetter(collA) && !startsWithLetter(collB)) {
            return sortOrder === 'asc' ? -1 : 1;
          }
          if (!startsWithLetter(collA) && startsWithLetter(collB)) {
            return sortOrder === 'asc' ? 1 : -1;
          }
          
          // Normal comparison
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
      return nfts;
    }
    
    return nfts.filter(nft => {
      const ownerWallet = (nft.ownerWallet || nft.ownerAddress || '').toLowerCase();
      return ownerWallet === selectedWallet.toLowerCase();
    });
  }, [selectedWallet]);

  // Apply filter to sorted NFTs
  const filteredAndSortedNfts = useCallback(() => {
    console.log('filteredAndSortedNfts called, userNfts length:', userNfts.length);
    
    try {
      const sorted = sortedNfts();
      const walletFiltered = filterNftsByWallet(sorted);
      const result = filterNftsBySearch(walletFiltered);
      
      if (!result || !Array.isArray(result)) {
        console.warn('filteredAndSortedNfts returned non-array result:', result);
        return [];
      }
      
      return result;
    } catch (error) {
      console.error('Error in filteredAndSortedNfts:', error);
      return [];
    }
  }, [filterNftsBySearch, filterNftsByWallet, sortedNfts, userNfts.length]);

  // Effect for initial search if username is provided
  useEffect(() => {
    if (initialUsername && initialUsername.trim()) {
      setFormSearchQuery(initialUsername.trim());
    }
  }, [initialUsername]);

  // Separate effect to handle searching when formSearchQuery changes from initialUsername
  useEffect(() => {
    const searchFromInitial = formSearchQuery && formSearchQuery === initialUsername && initialUsername.trim();
    
    if (searchFromInitial) {
      const performSearch = async () => {
        try {
          await handleSearch();
        } catch (err) {
          console.error("Error performing initial search:", err);
        }
      };
      
      performSearch();
    }
  }, [formSearchQuery, initialUsername]);

  return (
    <div className="farcaster-search-container">
      <div className="search-header">
        <p className="search-instructions">Enter a Farcaster username to explore their NFT collection</p>
      </div>
      
      <form onSubmit={handleSearch} className="search-form">
        <div className="search-input-wrapper">
          <div className="username-input-container">
            <input
              type="text"
              value={formSearchQuery}
              onChange={(e) => setFormSearchQuery(e.target.value)}
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
              
              {userNfts.length > 0 && (
                <div className="nft-header-right">
                  <NFTSortControls walletAddresses={walletAddresses} />
                </div>
              )}
            </div>
            
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