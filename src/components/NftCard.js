import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import CollectionHoldersModal from './CollectionHoldersModal';
import NFTImage from './NFTImage';

/**
 * NftCard component for displaying a single NFT
 */
const NftCard = ({ nft, onClick }) => {
  const [showHolders, setShowHolders] = useState(false);
  const { profile, isAuthenticated } = useAuth();

  // Add debugging
  console.log("NFT Card Auth State:", { isAuthenticated, profile, fid: profile?.fid });
  
  const handleClick = () => {
    console.log("NFT Card clicked, auth state:", { isAuthenticated, profile, fid: profile?.fid });
    
    if (isAuthenticated && profile && profile.fid) {
      console.log("Opening collection holders modal for collection address:", nft.collection?.address);
      setShowHolders(true);
    } else if (onClick) {
      onClick(nft);
    }
  };

  if (!nft) return null;

  // Data extraction with fallbacks for different API responses
  const getName = () => {
    if (nft.name) return nft.name;
    if (nft.metadata?.name) return nft.metadata.name;
    if (nft.token?.name) return nft.token.name;
    if (nft.tokenId) return `#${nft.tokenId}`;
    if (nft.token?.tokenId) return `#${nft.token.tokenId}`;
    return 'Unnamed NFT';
  };

  const getCollection = () => {
    if (nft.collection?.name) return nft.collection.name;
    if (nft.token?.collection?.name) return nft.token.collection.name;
    if (nft.contractName) return nft.contractName;
    if (nft.contract?.name) return nft.contract.name;
    if (nft.token?.symbol) return nft.token.symbol;
    return 'Unknown Collection';
  };

  const getImageUrl = () => {
    // Check for direct image URL
    if (nft.imageUrl) return nft.imageUrl;
    
    // Check for mediasV2 (common in Zapper API)
    if (nft.mediasV2 && nft.mediasV2.length > 0) {
      for (const media of nft.mediasV2) {
        if (!media) continue;
        if (media.original) return media.original;
        if (media.originalUri) return media.originalUri;
        if (media.url) return media.url;
      }
    }
    
    // Check for image URL in metadata
    if (nft.metadata?.image) return nft.metadata.image;
    
    // Check for collection image
    if (nft.collection?.imageUrl) return nft.collection.imageUrl;
    if (nft.collection?.cardImageUrl) return nft.collection.cardImageUrl;
    
    // Check for token image
    if (nft.token?.imageUrl) return nft.token.imageUrl;
    
    // Check for legacy media array
    if (Array.isArray(nft.media)) {
      for (const media of nft.media) {
        if (media.url) return media.url;
        if (media.originalUrl) return media.originalUrl;
      }
    }
    
    return null;
  };

  const getValue = () => {
    // Try different value formats in API responses
    if (nft.estimatedValue?.value !== undefined) {
      return {
        value: nft.estimatedValue.value,
        symbol: nft.estimatedValue.token?.symbol || 'ETH'
      };
    }
    
    if (nft.collection?.floorPrice?.value !== undefined) {
      return {
        value: nft.collection.floorPrice.value,
        symbol: nft.collection.floorPrice.symbol || 'ETH'
      };
    }
    
    if (nft.collection?.floorPriceEth !== undefined) {
      return {
        value: nft.collection.floorPriceEth,
        symbol: 'ETH'
      };
    }
    
    if (typeof nft.value !== 'undefined') {
      return {
        value: nft.value,
        symbol: nft.symbol || 'ETH'
      };
    }
    
    return null;
  };

  const getTokenId = () => {
    if (nft.tokenId) return nft.tokenId;
    if (nft.token?.tokenId) return nft.token.tokenId;
    return null;
  };

  const name = getName();
  const collection = getCollection();
  const imageUrl = getImageUrl();
  const valueData = getValue();
  const tokenId = getTokenId();
  
  // Extract contract address from collection ID
  let contractAddress = null;
  
  // First try direct access to address property
  if (nft.collection?.address) {
    contractAddress = nft.collection.address;
  } 
  // Then try to extract from collection ID (which is base64 encoded)
  else if (nft.collection?.id) {
    // Format appears to be "NftCollection-XXXXXXXX" where X is the collection ID
    // Try to extract the ID and use it as the address
    try {
      const decoded = atob(nft.collection.id);
      console.log("Decoded collection ID:", decoded);
      
      // If the decoded ID contains an address, extract it
      if (decoded.includes('-')) {
        const parts = decoded.split('-');
        if (parts.length > 1) {
          const collectionId = parts[1];
          // Use the collection ID as the address
          contractAddress = collectionId;
        }
      }
    } catch (e) {
      console.error("Error decoding collection ID:", e);
    }
  }
  
  // Fallback to other potential sources
  if (!contractAddress) {
    contractAddress = (
      nft.contractAddress || 
      nft.contract?.address ||
      nft.token?.collection?.address
    );
  }
  
  // Debug contract address
  console.log("NFT Contract Address:", {
    extracted: contractAddress,
    collectionAddress: nft.collection?.address,
    collectionId: nft.collection?.id,
    contractAddress: nft.contractAddress,
    contractAddressFromContract: nft.contract?.address,
    tokenCollectionAddress: nft.token?.collection?.address
  });

  return (
    <>
      <div 
        className="nft-card overflow-hidden rounded-xl bg-white shadow-sm cursor-pointer hover:shadow-md transition-shadow"
        onClick={handleClick}
      >
        <NFTImage 
          src={imageUrl} 
          alt={name}
        />
        
        <div className="p-3">
          <h3 className="font-semibold text-lg truncate">{name}</h3>
          
          <div className="flex flex-col mt-1">
            <p className="text-sm text-gray-500 truncate">{collection}</p>
            {tokenId && (
              <p className="text-xs text-gray-400">#{tokenId}</p>
            )}
          </div>
          
          {valueData && (
            <p className="text-sm font-medium mt-2">
              {valueData.value !== undefined && typeof valueData.value === 'number' 
                ? `${valueData.value.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${valueData.symbol}`
                : `${valueData.value} ${valueData.symbol}`}
            </p>
          )}
          
          {isAuthenticated && profile && profile.fid && (
            <div className="text-xs text-blue-500 mt-2 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              See who has this
            </div>
          )}
        </div>
      </div>

      {showHolders && contractAddress && profile && (
        <CollectionHoldersModal
          collectionAddress={contractAddress}
          userFid={profile.fid}
          onClose={() => setShowHolders(false)}
        />
      )}
    </>
  );
};

export default NftCard; 