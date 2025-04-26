import React from 'react';
import '../styles/nft-unified.css';
import { FaTimes } from 'react-icons/fa';
import NFTDetailView from './NFTDetailView';

const NFTModal = ({ nft, isOpen, onClose }) => {
  if (!isOpen || !nft) return null;

  // Prevent clicks inside the modal from closing it
  const handleModalContentClick = (e) => {
    e.stopPropagation();
  };

  return (
    <div className="nft-modal-overlay" onClick={onClose}>
      <div className="nft-modal-content" onClick={handleModalContentClick}>
        <button className="nft-modal-close-btn" onClick={onClose}>
          <FaTimes />
        </button>
        
        <NFTDetailView nft={nft} />
      </div>
    </div>
  );
};

export default NFTModal; 