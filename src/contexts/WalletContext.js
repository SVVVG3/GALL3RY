import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { AuthContext } from './AuthContext';

export const WalletContext = createContext();

export const WalletProvider = ({ children }) => {
  const [connectedWallets, setConnectedWallets] = useState([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [ensNames, setEnsNames] = useState({});
  const [provider, setProvider] = useState(null);
  
  const { user } = useContext(AuthContext);
  
  // Initialize provider
  useEffect(() => {
    if (window.ethereum) {
      const provider = new ethers.providers.Web3Provider(window.ethereum);
      setProvider(provider);
    }
  }, []);
  
  // Load saved wallets from localStorage
  useEffect(() => {
    if (user) {
      try {
        const savedWallets = localStorage.getItem('connected_wallets');
        if (savedWallets) {
          const wallets = JSON.parse(savedWallets);
          setConnectedWallets(wallets);
          // Fetch ENS names for saved wallets
          wallets.forEach(wallet => {
            fetchEnsName(wallet.address);
          });
        }
      } catch (error) {
        console.error('Error loading saved wallets:', error);
      }
    }
  }, [user]);
  
  // Save wallets to localStorage when they change
  useEffect(() => {
    if (connectedWallets.length > 0) {
      localStorage.setItem('connected_wallets', JSON.stringify(connectedWallets));
    }
  }, [connectedWallets]);
  
  // Connect wallet using Metamask or WalletConnect
  const connectWallet = useCallback(async (connectionType = 'metamask') => {
    if (!window.ethereum && connectionType === 'metamask') {
      setConnectionError('Metamask not installed');
      return;
    }
    
    setIsConnecting(true);
    setConnectionError(null);
    
    try {
      let address;
      
      if (connectionType === 'metamask') {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        address = accounts[0];
      } else {
        // Placeholder for other wallet connection types
        throw new Error('Connection type not supported yet');
      }
      
      if (!connectedWallets.some(wallet => wallet.address.toLowerCase() === address.toLowerCase())) {
        const newWallet = {
          address,
          connectionType,
          connectedAt: new Date().toISOString()
        };
        
        setConnectedWallets(prev => [...prev, newWallet]);
        fetchEnsName(address);
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
      setConnectionError(error.message);
    } finally {
      setIsConnecting(false);
    }
  }, [connectedWallets]);
  
  // Disconnect a wallet
  const disconnectWallet = useCallback((address) => {
    setConnectedWallets(prev => prev.filter(wallet => wallet.address !== address));
    
    // Remove from localStorage
    const savedWallets = JSON.parse(localStorage.getItem('connected_wallets') || '[]');
    const updatedWallets = savedWallets.filter(wallet => wallet.address !== address);
    localStorage.setItem('connected_wallets', JSON.stringify(updatedWallets));
  }, []);
  
  // Fetch ENS name for an address
  const fetchEnsName = useCallback(async (address) => {
    if (!provider || !address) return;
    
    try {
      const ensName = await provider.lookupAddress(address);
      if (ensName) {
        setEnsNames(prev => ({
          ...prev,
          [address.toLowerCase()]: ensName
        }));
      }
    } catch (error) {
      console.error('Error fetching ENS name:', error);
    }
  }, [provider]);
  
  // Format address for display (shorten or use ENS)
  const formatAddress = useCallback((address) => {
    if (!address) return '';
    
    const lowerAddress = address.toLowerCase();
    
    if (ensNames[lowerAddress]) {
      return ensNames[lowerAddress];
    }
    
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }, [ensNames]);
  
  const value = {
    connectedWallets,
    isConnecting,
    connectionError,
    ensNames,
    provider,
    connectWallet,
    disconnectWallet,
    formatAddress
  };
  
  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}; 