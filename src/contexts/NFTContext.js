import React, { createContext, useContext, useState, useCallback } from 'react';
import zapperService from '../services/zapperService';

const NFTContext = createContext();

export const NFTProvider = ({ children }) => {
  const [nfts, setNfts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [endCursor, setEndCursor] = useState(null);
  const [addresses, setAddresses] = useState([]);

  const fetchNFTs = useCallback(async (newAddresses = null) => {
    try {
      setLoading(true);
      setError(null);
      
      const addressesToUse = newAddresses || addresses;
      if (!addressesToUse || addressesToUse.length === 0) {
        setNfts([]);
        setHasMore(false);
        return;
      }

      console.log("NFTContext: Fetching NFTs for addresses:", addressesToUse);
      const result = await zapperService.getNftsForAddresses(addressesToUse, {
        limit: 24,
        cursor: null
      });

      console.log("NFTContext: Got NFT results:", result.nfts.length);
      setNfts(result.nfts);
      setHasMore(result.pageInfo.hasNextPage);
      setEndCursor(result.pageInfo.endCursor);
      if (newAddresses) {
        setAddresses(newAddresses);
      }
    } catch (err) {
      console.error('Error fetching NFTs:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [addresses]);

  const loadMoreNFTs = useCallback(async () => {
    if (!hasMore || loading) return;

    try {
      setLoading(true);
      const result = await zapperService.getNftsForAddresses(addresses, {
        limit: 24,
        cursor: endCursor
      });

      setNfts(prevNfts => [...prevNfts, ...result.nfts]);
      setHasMore(result.pageInfo.hasNextPage);
      setEndCursor(result.pageInfo.endCursor);
    } catch (err) {
      console.error('Error loading more NFTs:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [addresses, endCursor, hasMore, loading]);

  const loadNFTsForUser = useCallback(async (usernameOrFid) => {
    try {
      setLoading(true);
      setError(null);
      setNfts([]);
      
      const profile = await zapperService.getFarcasterProfile(usernameOrFid);
      
      if (!profile) {
        throw new Error(`No user found with the provided identifier`);
      }
      
      // Collect all user addresses
      const userAddresses = [];
      
      if (profile.custodyAddress) {
        userAddresses.push(profile.custodyAddress);
      }
      
      if (profile.connectedAddresses && profile.connectedAddresses.length) {
        userAddresses.push(...profile.connectedAddresses);
      }
      
      if (userAddresses.length === 0) {
        setNfts([]);
        setHasMore(false);
        setError("No wallet addresses found for this user");
        return;
      }
      
      console.log(`Loading NFTs for addresses: ${userAddresses.join(', ')}`);
      await fetchNFTs(userAddresses);
      
    } catch (err) {
      console.error('Error loading NFTs for user:', err);
      setError(err.message);
      setNfts([]);
    } finally {
      setLoading(false);
    }
  }, [fetchNFTs]);

  const value = {
    nfts,
    loading,
    error,
    hasMore,
    fetchNFTs,
    loadMoreNFTs,
    loadNFTsForUser
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