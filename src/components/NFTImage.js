import React, { useState, useEffect } from 'react';
import './NFTImage.css';
import Spinner from './Spinner';
import { FaExclamationTriangle } from 'react-icons/fa';

/**
 * NFTImage component that displays an NFT image with loading and error states
 * @param {Object} props
 * @param {string} props.src - The image URL
 * @param {string} props.alt - Alt text for the image
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.fallbackSrc - Fallback image URL if main image fails
 * @param {boolean} props.isPlaceholder - Whether to show a placeholder
 */
const NFTImage = ({ 
  src, 
  alt = 'NFT Image', 
  className = '', 
  fallbackSrc = '/placeholder.png',
  isPlaceholder = false
}) => {
  const [imgSrc, setImgSrc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 2;

  // Process the image URL based on its type (IPFS, Arweave, etc.)
  const processImageUrl = (url) => {
    if (!url) return fallbackSrc;

    // Handle IPFS URLs
    if (url.startsWith('ipfs://')) {
      return url.replace('ipfs://', 'https://ipfs.io/ipfs/');
    }

    // Handle Arweave URLs
    if (url.startsWith('ar://')) {
      return url.replace('ar://', 'https://arweave.net/');
    }

    // Handle HTTP URLs that might need CORS proxy
    if (url.startsWith('http')) {
      // Skip CORS proxy for already proxied URLs
      if (url.includes('cors-anywhere') || url.includes('corsproxy') || url.includes('proxy-image')) {
        return url;
      }
    }

    return url || fallbackSrc;
  };

  useEffect(() => {
    // Reset loading state and retry count when src changes
    setLoading(true);
    setRetryCount(0);
    setImgSrc(processImageUrl(src));
  }, [src]);

  const handleImageError = () => {
    if (retryCount < MAX_RETRIES) {
      // Try with a CORS proxy on error
      setRetryCount(prevCount => prevCount + 1);
      setImgSrc(`https://corsproxy.io/?${encodeURIComponent(src)}`);
    } else {
      // After max retries, use placeholder
      setImgSrc(fallbackSrc);
      setLoading(false);
    }
  };

  const handleImageLoad = () => {
    setLoading(false);
  };

  // Show loading spinner while image is loading
  if (loading) {
    return (
      <div className="nft-image-container">
        <div className="absolute inset-0 flex justify-center items-center">
          <Spinner size="md" color="purple-500" />
        </div>
      </div>
    );
  }

  // Show error icon if image failed to load
  if (imgSrc === fallbackSrc) {
    return (
      <div className="nft-image-container">
        <div className="absolute inset-0 flex flex-col justify-center items-center bg-gray-100">
          <FaExclamationTriangle className="text-red-500 text-2xl mb-2" />
          <p className="text-xs text-gray-500">Image unavailable</p>
        </div>
      </div>
    );
  }

  // Show the image
  return (
    <div className={`nft-image-container ${className}`}>
      {imgSrc && (
        <img
          src={imgSrc}
          alt={alt}
          className="nft-image"
          onError={handleImageError}
          onLoad={handleImageLoad}
        />
      )}
    </div>
  );
};

export default NFTImage; 