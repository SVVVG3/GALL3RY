import React, { useEffect } from 'react';
import { useNFT } from '../contexts/NFTContext';
import { Link } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner';

const CollectionHoldersModal = ({ collectionAddress, userFid, onClose }) => {
  const { loading, collectionHolders, fetchCollectionHolders } = useNFT();

  useEffect(() => {
    fetchCollectionHolders(collectionAddress, userFid);
  }, [collectionAddress, userFid, fetchCollectionHolders]);

  const holders = collectionHolders[collectionAddress] || [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[#1c1c1c] rounded-xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Collection Holders You Follow</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-8">
            <LoadingSpinner size="small" />
          </div>
        ) : holders.length > 0 ? (
          <div className="space-y-4">
            {holders.map(holder => (
              <Link
                to={`/profile/${holder.username}`}
                key={holder.fid}
                className="flex items-center gap-4 p-4 rounded-lg hover:bg-[#2c2c2c] transition-colors"
              >
                <img
                  src={holder.imageUrl}
                  alt={holder.username}
                  className="w-12 h-12 rounded-full"
                />
                <div className="flex-1">
                  <div className="font-medium text-white">{holder.username}</div>
                  {holder.displayName && (
                    <div className="text-sm text-gray-400">{holder.displayName}</div>
                  )}
                </div>
                <div className="text-sm text-gray-400">
                  {holder.followersCount.toLocaleString()} followers
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            None of the people you follow hold NFTs from this collection
          </div>
        )}
      </div>
    </div>
  );
};

export default CollectionHoldersModal; 