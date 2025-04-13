import React, { useEffect, useState } from 'react';
import { useNFT } from '../contexts/NFTContext';
import { Link } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner';
import './CollectionHoldersModal.css';

const CollectionHoldersModal = ({ collectionAddress, userFid, onClose }) => {
  const { loadingCollectionHolders, collectionHolders, fetchCollectionHolders } = useNFT();
  const [error, setError] = useState(null);

  // Debug props
  console.log("CollectionHoldersModal mounted with:", { collectionAddress, userFid });

  useEffect(() => {
    console.log("CollectionHoldersModal useEffect running with:", { collectionAddress, userFid });
    if (collectionAddress) {
      try {
        // Ensure collection address is a string and clean it
        const cleanAddress = collectionAddress.toString().toLowerCase().trim();
        console.log("Fetching holders with cleaned address:", cleanAddress);
        
        // Check if we already have the data for this collection
        if (!collectionHolders[cleanAddress]) {
          fetchCollectionHolders(cleanAddress)
            .then(result => {
              console.log("Fetch collection holders result:", result);
            })
            .catch(err => {
              console.error("Error fetching collection holders:", err);
              setError(err.message || "Failed to fetch collection holders");
            });
        } else {
          console.log("Using cached collection holders data");
        }
      } catch (err) {
        console.error("Error in fetchCollectionHolders:", err);
        setError(err.message || "Failed to fetch collection holders");
      }
    } else {
      console.error("Missing required props:", { collectionAddress });
      setError("Missing collection address");
    }
  }, [collectionAddress, fetchCollectionHolders, collectionHolders]);

  // Get the holders for this collection
  const holders = collectionHolders[collectionAddress?.toLowerCase()] || [];
  console.log("Holders for collection:", { collectionAddress, holdersCount: holders.length, holders });

  // Get relationship badge styles and text
  const getRelationshipBadge = (relationship) => {
    if (!relationship) return null;
    
    switch(relationship) {
      case 'following':
        return (
          <span className="holder-badge badge-following">
            Following
          </span>
        );
      case 'follower':
        return (
          <span className="holder-badge badge-follower">
            Follower
          </span>
        );
      case 'mutual':
        return (
          <span className="holder-badge badge-mutual">
            Mutual
          </span>
        );
      default:
        return null;
    }
  };

  const handleClose = () => {
    if (onClose) onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 collection-holders-modal">
      <div className="bg-[#1c1c1c] rounded-xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Collection Holders</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {error ? (
          <div className="text-center py-8 text-red-400">
            {error}
          </div>
        ) : loadingCollectionHolders ? (
          <div className="flex justify-center items-center py-8">
            <LoadingSpinner size="small" />
          </div>
        ) : holders.length > 0 ? (
          <div className="space-y-4">
            {holders.map(holder => (
              <Link
                to={`/user/${holder.username}`}
                key={holder.fid}
                className="flex items-center gap-4 p-4 holder-item"
              >
                <img
                  src={holder.imageUrl}
                  alt={holder.username}
                  className="w-12 h-12 rounded-full"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = "/placeholder.png";
                  }}
                />
                <div className="flex-1">
                  <div className="font-medium text-white flex items-center">
                    {holder.username}
                    {getRelationshipBadge(holder.relationship)}
                  </div>
                  {holder.displayName && (
                    <div className="text-sm text-gray-400">{holder.displayName}</div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-400">
                    {holder.followersCount.toLocaleString()} followers
                  </div>
                  <div className="text-sm text-purple-400">
                    {holder.holdingCount} {holder.holdingCount === 1 ? 'NFT' : 'NFTs'}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            No Farcaster users found holding NFTs from this collection
          </div>
        )}
      </div>
    </div>
  );
};

export default CollectionHoldersModal; 