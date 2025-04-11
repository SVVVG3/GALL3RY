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

  // Handle different NFT data structures
  const name = nft.name || nft.metadata?.name || nft.token_id || 'Unnamed NFT';
  const collection = nft.collection?.name || nft.contract_name || 'Unknown Collection';
  
  // Look for image in multiple possible locations with fallbacks
  const imageUrl = nft.imageUrl || nft.image || nft.metadata?.image || null;

  return (
    <>
      <div
        className="nft-card bg-[#1c1c1c] rounded-xl overflow-hidden cursor-pointer transform transition-transform hover:scale-[1.02]"
        onClick={handleClick}
      >
        <div className="relative aspect-square">
          <NFTImage
            src={imageUrl}
            alt={name}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="p-4">
          <h3 className="text-lg font-semibold text-white truncate">
            {name}
          </h3>
          <p className="text-sm text-gray-400 truncate">
            {collection}
          </p>
          {nft.estimatedValue?.value && (
            <p className="text-sm text-gray-400 mt-1">
              {nft.estimatedValue.value.toLocaleString()} ETH
            </p>
          )}
        </div>
      </div>

      {showHolders && (
        <CollectionHoldersModal
          collectionAddress={nft.collection.address}
          userFid={user.fid}
          onClose={() => setShowHolders(false)}
        />
      )}
    </>
  );
};

export default NftCard; 