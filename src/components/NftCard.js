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
      console.log("Opening collection holders modal for collection address:", contractAddress);
      
      // Make sure we have a collection address before trying to show the modal
      if (contractAddress) {
        // Add more debugging for the collection address
        console.log("Collection address details:", {
          address: contractAddress,
          collection: nft.collection,
          collectionId: nft.collection?.id
        });
        
        setShowHolders(true);
      } else {
        console.error("Cannot open modal: No collection address available for this NFT");
        // Could show a toast or alert here
        if (onClick) {
          onClick(nft);
        }
      }
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
    // Debug logging for value data
    console.log("NFT Value Data:", {
      id: nft.id,
      name: nft.name,
      directValue: nft.value,
      valueEth: nft.valueEth,
      estimatedValue: nft.estimatedValue,
      estimatedValueEth: nft.estimatedValueEth,
      floorPrice: nft.floorPrice,
      collectionFloorPrice: nft.collection?.floorPrice,
      collectionFloorPriceEth: nft.collection?.floorPriceEth,
      debugValue: nft._debug_value,
    });
    
    // Priority order for value sources (most accurate first)
    
    // 1. Direct valueEth - this is usually most accurate
    if (nft.valueEth !== undefined && nft.valueEth !== null) {
      return {
        value: nft.valueEth,
        symbol: 'ETH'
      };
    }
    
    // 2. estimatedValueEth - next best source
    if (nft.estimatedValueEth !== undefined && nft.estimatedValueEth !== null) {
      return {
        value: nft.estimatedValueEth,
        symbol: 'ETH'
      };
    }
    
    // 3. directValue with token symbol
    if (nft.value !== undefined && nft.value !== null) {
      return {
        value: nft.value,
        symbol: nft.symbol || 'ETH'
      };
    }
    
    // 4. estimatedValue object
    if (nft.estimatedValue?.value !== undefined) {
      return {
        value: nft.estimatedValue.value,
        symbol: nft.estimatedValue.token?.symbol || 'ETH'
      };
    }
    
    // 5. NFT's own floorPrice
    if (nft.floorPrice?.value !== undefined) {
      return {
        value: nft.floorPrice.value,
        symbol: nft.floorPrice.token?.symbol || 'ETH'
      };
    }
    
    // 6. Collection floor price
    if (nft.collection?.floorPrice?.value !== undefined) {
      return {
        value: nft.collection.floorPrice.value,
        symbol: nft.collection.floorPrice.token?.symbol || 'ETH'
      };
    }
    
    // 7. Collection ETH floor price
    if (nft.collection?.floorPriceEth !== undefined && nft.collection.floorPriceEth !== null) {
      return {
        value: nft.collection.floorPriceEth,
        symbol: 'ETH'
      };
    }
    
    // 8. Debug value data
    if (nft._debug_value) {
      if (nft._debug_value.estimatedValueEth) {
        return {
          value: nft._debug_value.estimatedValueEth,
          symbol: 'ETH'
        };
      }
      if (nft._debug_value.estimatedValue?.value) {
        return {
          value: nft._debug_value.estimatedValue.value,
          symbol: nft._debug_value.estimatedValue.token?.symbol || 'ETH'
        };
      }
      if (nft._debug_value.floorPriceEth) {
        return {
          value: nft._debug_value.floorPriceEth,
          symbol: 'ETH'
        };
      }
    }
    
    // Last fallback - return 0 ETH if collection exists
    if (nft.collection) {
      return {
        value: 0,
        symbol: 'ETH'
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
  
  // Extract collection address from collection ID
  let contractAddress = null;
  
  // First try direct access to address property
  if (nft.collection?.address) {
    contractAddress = nft.collection.address;
  } 
  // Then try to extract from collection ID (which is base64 encoded)
  else if (nft.collection?.id) {
    try {
      const collectionId = nft.collection.id;
      console.log("Collection ID:", collectionId);
      
      // If it's a base64 encoded string, decode it
      if (collectionId.match(/^[A-Za-z0-9+/=]+$/)) {
        try {
          const decoded = atob(collectionId);
          console.log("Decoded collection ID:", decoded);
          
          // If the decoded ID contains a hyphen, extract the second part as the collection ID
          if (decoded.includes('-')) {
            const parts = decoded.split('-');
            if (parts.length > 1) {
              contractAddress = parts[1];
              console.log("Successfully extracted collection ID:", contractAddress);
            }
          }
        } catch (e) {
          console.error("Error decoding collection ID:", e);
        }
      } 
      // If it's already in the format of a collection ID, use it directly
      else {
        contractAddress = collectionId;
        console.log("Using collection ID directly:", contractAddress);
      }
    } catch (e) {
      console.error("Error processing collection ID:", e);
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
  
  // Try one more approach if we still don't have a contract address
  if (!contractAddress && nft.id) {
    // NFT IDs often include collection info
    const idParts = nft.id.split(':');
    if (idParts.length >= 2) {
      contractAddress = idParts[1];
      console.log("Extracted contract address from NFT ID:", contractAddress);
    }
  }
  
  // Debug contract address
  console.log("NFT Contract Address:", {
    extracted: contractAddress,
    collectionAddress: nft.collection?.address,
    collectionId: nft.collection?.id,
    nftId: nft.id,
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
            <p className="text-sm font-medium mt-2 text-green-600">
              {valueData.value !== undefined && typeof valueData.value === 'number' 
                ? `${valueData.value.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${valueData.symbol}`
                : typeof valueData.value === 'string'
                  ? `${parseFloat(valueData.value).toLocaleString(undefined, { maximumFractionDigits: 4 })} ${valueData.symbol}`
                  : `${valueData.value} ${valueData.symbol}`}
            </p>
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