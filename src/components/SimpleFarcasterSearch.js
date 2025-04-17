import React, { useState, useEffect, useCallback } from 'react';
import { fetchFarcasterUser } from '../services/farcasterService';
import { fetchNftsForAddresses } from '../services/alchemyService';

/**
 * Simplified version of FarcasterUserSearch that avoids context dependencies
 * to prevent circular references and React hook issues
 */
const SimpleFarcasterSearch = ({ initialUsername }) => {
  const [searchQuery, setSearchQuery] = useState(initialUsername || '');
  const [isSearching, setIsSearching] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [userNfts, setUserNfts] = useState([]);
  const [searchError, setSearchError] = useState(null);
  
  const handleSearch = useCallback(async (e) => {
    if (e) e.preventDefault();
    
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    setSearchError(null);
    
    try {
      // Step 1: Get Farcaster user profile
      const response = await fetch(`/api/farcaster-profile?username=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) {
        throw new Error('Failed to fetch Farcaster profile');
      }
      
      const profileData = await response.json();
      if (!profileData || !profileData.username) {
        throw new Error('Invalid profile data returned');
      }
      
      setUserProfile(profileData);
      
      // Step 2: Get wallet addresses from profile
      let addresses = [];
      if (profileData.custodyAddress) {
        addresses.push(profileData.custodyAddress);
      }
      if (profileData.connectedAddresses && Array.isArray(profileData.connectedAddresses)) {
        addresses = [...addresses, ...profileData.connectedAddresses];
      }
      
      // Ensure we have valid addresses
      addresses = addresses.filter(addr => 
        addr && typeof addr === 'string' && addr.startsWith('0x') && addr.length === 42
      );
      
      if (addresses.length === 0) {
        setSearchError('No wallet addresses found for this user');
        return;
      }
      
      // Step 3: Fetch NFTs directly through the API
      const nftResponse = await fetch(`/api/alchemy?endpoint=getNFTsForOwner&addresses=${addresses.join(',')}`);
      if (!nftResponse.ok) {
        throw new Error('Failed to fetch NFTs');
      }
      
      const nftData = await nftResponse.json();
      if (nftData && nftData.nfts) {
        setUserNfts(nftData.nfts);
      } else {
        setUserNfts([]);
        setSearchError('No NFTs found for this user');
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchError(error.message || 'An error occurred');
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);
  
  // Call search on initial render if username is provided
  useEffect(() => {
    if (initialUsername && initialUsername.trim()) {
      setSearchQuery(initialUsername.trim());
      handleSearch();
    }
  }, [initialUsername, handleSearch]);
  
  return (
    <div className="farcaster-search-container">
      <div className="search-header">
        <h2>Farcaster NFT Explorer</h2>
        <p>Enter a Farcaster username to see their NFTs</p>
      </div>
      
      <form onSubmit={handleSearch} className="search-form">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Enter Farcaster username"
          className="search-input"
        />
        <button type="submit" className="search-button" disabled={isSearching}>
          {isSearching ? 'Searching...' : 'Search'}
        </button>
      </form>
      
      {searchError && (
        <div className="error-message">
          <p>{searchError}</p>
        </div>
      )}
      
      {userProfile && (
        <div className="user-profile">
          <h3>@{userProfile.username}</h3>
          {userProfile.metadata?.displayName && <p>{userProfile.metadata.displayName}</p>}
          <p>Found {userNfts.length} NFTs</p>
        </div>
      )}
      
      {/* Placeholder for NFTs - will need to be replaced with a proper component */}
      {userNfts.length > 0 && (
        <div className="nft-grid">
          {userNfts.map((nft, index) => (
            <div key={index} className="nft-card">
              <p>{nft.name || `NFT #${nft.tokenId || index}`}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SimpleFarcasterSearch; 