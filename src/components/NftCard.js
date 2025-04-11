import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import CollectionHoldersModal from './CollectionHoldersModal';
import NFTImage from './NFTImage';

/**
 * NftCard component for displaying a single NFT
 * @param {Object} nft - The NFT object to display
 * @param {Function} onClick - Function to call when the card is clicked
 */
const NftCard = ({ nft, onClick }) => {
  const [showHolders, setShowHolders] = useState(false);
  const { user } = useAuth();

  const handleClick = () => {
    if (user && user.fid) {
      setShowHolders(true);
    } else if (onClick) {
      onClick(nft);
    }
  };

  if (!nft) return null;

  // Enhanced data extraction with better fallbacks for different API responses
  const getName = () => {
    // Try all possible name locations in order of preference
    if (nft.name) return nft.name;
    if (nft.metadata?.name) return nft.metadata.name;
    if (nft.token?.name) return nft.token.name;
    if (nft.tokenId) return `#${nft.tokenId}`;
    if (nft.token?.tokenId) return `#${nft.token.tokenId}`;
    return 'Unnamed NFT';
  };

  const getCollection = () => {
    // Try all possible collection name locations
    if (nft.collection?.name) return nft.collection.name;
    if (nft.token?.collection?.name) return nft.token.collection.name;
    if (nft.contractName) return nft.contractName;
    if (nft.contract?.name) return nft.contract.name;
    if (nft.token?.symbol) return nft.token.symbol;
    return 'Unknown Collection';
  };

  const getImageUrl = () => {
    // Try all possible image URL locations
    console.log('Extracting image URL from NFT data:', JSON.stringify({
      imageUrl: nft.imageUrl,
      metadataImage: nft.metadata?.image,
      collectionImageUrl: nft.collection?.imageUrl,
      tokenImageUrl: nft.token?.imageUrl,
      mediasV2: nft.mediasV2
    }, null, 2));
    
    // Check for direct image URL
    if (nft.imageUrl) return nft.imageUrl;
    
    // Check for image URL in metadata
    if (nft.metadata?.image) return nft.metadata.image;
    
    // Check for collection image URL
    if (nft.collection?.imageUrl) return nft.collection.imageUrl;
    
    // Check for token image URL
    if (nft.token?.imageUrl) return nft.token.imageUrl;
    
    // Try to extract from mediasV2 if available (common in newer Zapper API)
    if (nft.mediasV2 && nft.mediasV2.length > 0) {
      for (const media of nft.mediasV2) {
        if (!media) continue;
        if (media.original) return media.original;
        if (media.originalUri) return media.originalUri;
        if (media.url) return media.url;
      }
    }
    
    // Check for media array in older Zapper formats
    if (Array.isArray(nft.media)) {
      for (const media of nft.media) {
        if (media.url) return media.url;
        if (media.originalUrl) return media.originalUrl;
      }
    }
    
    console.log('No image URL found for NFT:', nft.id || nft.tokenId);
    return null;
  };

  const getValue = () => {
    // Try different value formats in the current Zapper API response
    if (nft.estimatedValue?.value !== undefined) {
      return {
        value: nft.estimatedValue.value,
        symbol: nft.estimatedValue.token?.symbol || 'ETH'
      };
    }
    
    if (nft.collection?.floorPrice?.value !== undefined) {
      return {
        value: nft.collection.floorPrice.value,
        symbol: nft.collection.floorPrice.symbol || 'ETH',
        isFloorPrice: true
      };
    }
    
    if (nft.collection?.floorPriceEth !== undefined) {
      return {
        value: nft.collection.floorPriceEth,
        symbol: 'ETH',
        isFloorPrice: true
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

  const getContractAddress = () => {
    if (nft.token?.contractAddress) return nft.token.contractAddress;
    if (nft.contractAddress) return nft.contractAddress;
    if (nft.collection?.id?.includes(':')) {
      // Zapper format: 'ethereum:0x1234...'
      return nft.collection.id.split(':')[1];
    }
    if (nft.collection?.address) return nft.collection.address;
    return null;
  };

  const name = getName();
  const collection = getCollection();
  const imageUrl = getImageUrl();
  const valueData = getValue();
  const contractAddress = getContractAddress();

  return (
    <>
      <div
        className="nft-card bg-[#1c1c1c] rounded-xl overflow-hidden cursor-pointer transform transition-transform hover:scale-[1.02]"
        onClick={handleClick}
      >
        <div className="relative aspect-square w-full">
          <NFTImage
            src={imageUrl}
            alt={name}
            className="w-full h-full"
          />
        </div>
        <div className="p-4">
          <h3 className="text-lg font-semibold text-white truncate">
            {name}
          </h3>
          <p className="text-sm text-gray-400 truncate">
            {collection}
          </p>
          {valueData && (
            <p className="text-sm text-gray-400 mt-1">
              {valueData.isFloorPrice && 'Floor: '}
              {typeof valueData.value === 'number' 
                ? valueData.value.toLocaleString(undefined, { maximumFractionDigits: 4 }) 
                : valueData.value} {valueData.symbol}
            </p>
          )}
        </div>
      </div>

      {showHolders && contractAddress && (
        <CollectionHoldersModal
          collectionAddress={contractAddress}
          userFid={user.fid}
          onClose={() => setShowHolders(false)}
        />
      )}
    </>
  );
};

export default NftCard; 