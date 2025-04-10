import React, { useState } from 'react';
import NFTImage from './NFTImage';
import AddToFolderModal from './AddToFolderModal';
import { useAuth } from '../contexts/AuthContext';

/**
 * NFTGrid component 
 * Displays a grid of NFTs with their details
 */
const NFTGrid = ({ nfts, onRemoveNft, isOwner = false }) => {
  const { isAuthenticated } = useAuth();
  const [selectedNft, setSelectedNft] = useState(null);
  const [showAddToFolderModal, setShowAddToFolderModal] = useState(false);

  // Filter out NFTs without an ID
  const validNfts = nfts?.filter(nft => nft?.id) || [];

  console.log('Valid NFTs:', validNfts.length);
  if (validNfts.length > 0) {
    console.log('First NFT:', validNfts[0]);
  }

  // Function to format USD values
  const formatUSD = (value) => {
    if (!value && value !== 0) return 'N/A';
    
    // Convert to number if it's a string
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    // Check if it's a valid number
    if (isNaN(numValue)) return 'N/A';
    
    // Format based on value range
    if (numValue >= 1000000) {
      return `$${(numValue / 1000000).toFixed(2)}M`;
    } else if (numValue >= 1000) {
      return `$${(numValue / 1000).toFixed(2)}K`;
    } else if (numValue >= 1) {
      return `$${numValue.toFixed(2)}`;
    } else {
      return `$${numValue.toFixed(4)}`;
    }
  };

  // Function to convert ETH to USD
  const toUSD = (ethValue, ethPrice) => {
    if (!ethValue || !ethPrice) return 'N/A';
    const numEthValue = typeof ethValue === 'string' ? parseFloat(ethValue) : ethValue;
    const numEthPrice = typeof ethPrice === 'string' ? parseFloat(ethPrice) : ethPrice;
    
    if (isNaN(numEthValue) || isNaN(numEthPrice)) return 'N/A';
    
    return formatUSD(numEthValue * numEthPrice);
  };

  // Handle adding NFT to folder
  const handleAddToFolder = (nft) => {
    setSelectedNft(nft);
    setShowAddToFolderModal(true);
  };

  // Handle closing the modal
  const handleCloseModal = () => {
    setShowAddToFolderModal(false);
    setSelectedNft(null);
  };

  // Determine if "Add to Folder" action is allowed
  // Only show if authenticated and not in a folder owned by another user
  const canAddToFolder = isAuthenticated && !isOwner;
  // Show remove button only if the handler is provided and user owns the folder
  const canRemoveNft = onRemoveNft && isOwner;

  return (
    <div className="w-full container mx-auto px-4">
      <div className="nft-grid">
        {validNfts.length > 0 ? (
          validNfts.map((nft) => (
            <div 
              key={nft.id} 
              className="nft-grid-item bg-white shadow-sm p-3"
            >
              <div className="nft-image-container">
                <NFTImage 
                  src={nft.imageUrl} 
                  alt={nft.name || `NFT`}
                  className="w-full h-full object-cover"
                  fallbackSrc="https://placehold.co/400x400?text=NFT"
                />
              </div>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <h3 className="text-md font-medium truncate">
                    {nft.name || nft.collection?.name || 'Unnamed NFT'}
                  </h3>
                </div>
                
                {(nft.collection?.name) && (
                  <div className="flex items-center text-sm text-gray-500 bg-gray-50 px-2 py-1 rounded-md border border-gray-100">
                    <span className="truncate">
                      {nft.collection?.name}
                    </span>
                  </div>
                )}
                
                {(nft.estimatedValueEth !== undefined || nft.estimatedValueUsd !== undefined) && (
                  <div className="mt-2">
                    <span className="block text-sm text-green-600 font-semibold bg-green-50 px-3 py-1.5 rounded-lg hover:shadow-sm hover:bg-green-100 transition-all border border-green-100">
                      Est. Value: {nft.estimatedValueUsd !== undefined ? formatUSD(nft.estimatedValueUsd) : (nft.estimatedValueEth ? `${nft.estimatedValueEth.toFixed(4)} ETH` : 'N/A')}
                    </span>
                  </div>
                )}
                
                {/* Actions section */}
                <div className="mt-3 pt-2 border-t border-gray-100">
                  {canAddToFolder && (
                    <button
                      onClick={() => handleAddToFolder(nft)}
                      className="w-full text-purple-600 bg-purple-50 hover:bg-purple-100 font-medium rounded-lg text-sm px-3 py-2 text-center transition-colors hover:shadow-sm border border-purple-100"
                    >
                      Add to Folder
                    </button>
                  )}
                  
                  {canRemoveNft && (
                    <button
                      onClick={() => onRemoveNft(nft.id)}
                      className="w-full text-red-600 bg-red-50 hover:bg-red-100 font-medium rounded-lg text-sm px-3 py-2 text-center transition-colors hover:shadow-sm border border-red-100 mt-2"
                    >
                      Remove from Folder
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full text-center py-10 border border-gray-200 rounded-lg bg-gray-50">
            <p className="text-gray-500">No NFTs found</p>
          </div>
        )}
      </div>

      {/* Add to Folder Modal */}
      {selectedNft && showAddToFolderModal && (
        <AddToFolderModal
          nft={selectedNft}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
};

export default NFTGrid; 