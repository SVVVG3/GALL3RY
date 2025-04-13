import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import CollectionHoldersModal from './CollectionHoldersModal';
import NFTImage from './NFTImage';
import styled from 'styled-components';
import { FaEthereum, FaUsers } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { AiOutlineHeart, AiFillHeart } from 'react-icons/ai';
import { useNFT } from '../contexts/NFTContext';
import './NftCard.css';
import CardLoadingAnimation from './CardLoadingAnimation';
import PriceDisplay from './PriceDisplay';
import { formatAddress } from '../utils/format';
import analytics from '../utils/analytics';

/**
 * NftCard component for displaying a single NFT
 */
const NftCard = ({ nft, showCollectionName = true, showLastPrice = false, disabled = false, onClick }) => {
  // Early return with a simpler placeholder if nft is null or undefined
  if (!nft) {
    console.warn('Attempted to render NftCard with null or undefined nft object');
    return (
      <div className="nft-card disabled">
        <div className="image-container">
          <div className="nft-image-loading">
            <div>Invalid NFT data</div>
          </div>
        </div>
        <div className="nft-details">
          <div className="nft-info">
            <h3 className="nft-name">Unknown NFT</h3>
          </div>
        </div>
      </div>
    );
  }

  const { likedNFTs, toggleLike, userFid } = useNFT();
  const navigate = useNavigate();
  const [showHolders, setShowHolders] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const { profile, isAuthenticated } = useAuth();

  // Add debugging
  console.log("NFT Card Auth State:", { isAuthenticated, profile, fid: profile?.fid });
  
  // Fix: Add defensive check for likedNFTs before using .some()
  const isLiked = Array.isArray(likedNFTs) && likedNFTs.some(
    (likedNft) => likedNft.id === nft?.id && likedNft.contractAddress === nft?.contractAddress
  );

  // Card loading skeleton shown until image is loaded
  const imageLoadingState = !imageLoaded && (
    <div className="nft-image-loading">
      <CardLoadingAnimation />
    </div>
  );

  const handleCardClick = (e) => {
    // Don't navigate if clicking on the like or holders button
    if (
      e.target.closest('.like-button') ||
      e.target.closest('.holders-button')
    ) {
      return;
    }

    if (onClick) {
      onClick(nft);
    }
  };
  
  const handleHoldersClick = (e) => {
    console.log('Holders button clicked', { contractAddress, profile });
    e.preventDefault();
    e.stopPropagation();
    setShowHolders(true);
    analytics.track('NFT Holders Viewed', {
      collectionAddress: contractAddress
    });
  };
  
  const handleLikeClick = (e) => {
    e.stopPropagation();
    
    // Use toggleLike from context directly
    if (typeof toggleLike === 'function' && nft) {
      toggleLike(nft);
    }
  };
  
  const handleCloseModal = () => {
    setShowHolders(false);
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
    
    // Check for mediasV3 (new in Zapper API)
    if (nft.mediasV3) {
      // Check images first
      if (nft.mediasV3.images?.edges && nft.mediasV3.images.edges.length > 0) {
        for (const edge of nft.mediasV3.images.edges) {
          const image = edge.node;
          if (!image) continue;
          
          // Try various sizes in order of preference
          if (image.large) return image.large;
          if (image.original) return image.original;
          if (image.thumbnail) return image.thumbnail;
        }
      }
      
      // Check animations if no images
      if (nft.mediasV3.animations?.edges && nft.mediasV3.animations.edges.length > 0) {
        for (const edge of nft.mediasV3.animations.edges) {
          const animation = edge.node;
          if (!animation) continue;
          
          if (animation.original) return animation.original;
        }
      }
    }
    
    // Check for mediasV2 (common in older Zapper API)
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
    if (nft.collection?.cardImage) return nft.collection.cardImage;
    if (nft.collection?.medias?.logo?.thumbnail) return nft.collection.medias.logo.thumbnail;
    
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
    // Debug log for value properties
    console.log('NFT value debug:', {
      id: nft.id,
      collection: nft.collection?.name,
      estimatedValue: nft.estimatedValue,
    });
    
    // Use a consistent ETH to USD conversion factor
    const ETH_USD_ESTIMATE = 2500;
    
    // Priority order for value sources (prioritizing USD values)
    
    // 1. valueUsd - direct USD value
    if (nft.valueUsd !== undefined && nft.valueUsd !== null) {
      return {
        value: nft.valueUsd,
        symbol: 'USD',
        isUsd: true
      };
    }
    
    // 2. Try estimatedValue.valueUsd
    if (nft.estimatedValue?.valueUsd !== undefined && 
        nft.estimatedValue.valueUsd !== null) {
      return {
        value: nft.estimatedValue.valueUsd,
        symbol: 'USD',
        isUsd: true
      };
    }
    
    // 3. New format: { estimatedValue: { amount: number, currency: string } }
    // If currency is USD, use that value
    if (nft.estimatedValue && typeof nft.estimatedValue === 'object' && 
        nft.estimatedValue.amount !== undefined) {
      // If it's in USD, use directly
      if (nft.estimatedValue.currency === 'USD') {
        return {
          value: nft.estimatedValue.amount,
          symbol: 'USD',
          isUsd: true
        };
      }
      // If it's in ETH, convert to USD for display
      else if (nft.estimatedValue.currency === 'ETH' || !nft.estimatedValue.currency) {
        return {
          value: nft.estimatedValue.amount * ETH_USD_ESTIMATE,
          symbol: 'USD',
          isUsd: true,
          originalValue: nft.estimatedValue.amount,
          originalSymbol: 'ETH'
        };
      }
      // For other currencies, use as is
      else {
        return {
          value: nft.estimatedValue.amount,
          symbol: nft.estimatedValue.currency,
          isUsd: nft.estimatedValue.currency === 'USD'
        };
      }
    }
    
    // 4. Check collection floor price in USD
    if (nft.collection?.floorPrice?.valueUsd !== undefined && 
        nft.collection.floorPrice.valueUsd !== null) {
      return {
        value: nft.collection.floorPrice.valueUsd,
        symbol: 'USD',
        isUsd: true
      };
    }
    
    // 5. valueEth (converted to USD)
    if (nft.valueEth !== undefined && nft.valueEth !== null) {
      return {
        value: nft.valueEth * ETH_USD_ESTIMATE,
        symbol: 'USD', 
        isUsd: true,
        originalValue: nft.valueEth,
        originalSymbol: 'ETH'
      };
    }
    
    // 6. Estimated value with denomination
    if (nft.estimatedValue?.valueWithDenomination !== undefined && 
        nft.estimatedValue.valueWithDenomination !== null) {
      const denomination = nft.estimatedValue.denomination?.symbol || 'ETH';
      if (denomination === 'ETH') {
        return {
          value: nft.estimatedValue.valueWithDenomination * ETH_USD_ESTIMATE,
          symbol: 'USD',
          isUsd: true,
          originalValue: nft.estimatedValue.valueWithDenomination,
          originalSymbol: 'ETH'
        };
      } else {
        return {
          value: nft.estimatedValue.valueWithDenomination,
          symbol: denomination,
          isUsd: denomination === 'USD'
        };
      }
    }
    
    // 7. Legacy estimated value format
    if (nft.estimatedValue?.value !== undefined && nft.estimatedValue.value !== null) {
      const symbol = nft.estimatedValue.token?.symbol || 'ETH';
      if (symbol === 'ETH') {
        return {
          value: nft.estimatedValue.value * ETH_USD_ESTIMATE,
          symbol: 'USD',
          isUsd: true,
          originalValue: nft.estimatedValue.value,
          originalSymbol: 'ETH'
        };
      } else {
        return {
          value: nft.estimatedValue.value,
          symbol: symbol,
          isUsd: symbol === 'USD'
        };
      }
    }
    
    // 8. Direct estimatedValue as a number (assume ETH)
    if (typeof nft.estimatedValue === 'number' && !isNaN(nft.estimatedValue)) {
      return {
        value: nft.estimatedValue * ETH_USD_ESTIMATE,
        symbol: 'USD',
        isUsd: true,
        originalValue: nft.estimatedValue,
        originalSymbol: 'ETH'
      };
    }
    
    // 9. Collection floor price 
    if (nft.collection?.floorPrice !== undefined) {
      if (typeof nft.collection.floorPrice === 'number') {
        return {
          value: nft.collection.floorPrice * ETH_USD_ESTIMATE,
          symbol: 'USD',
          isUsd: true,
          originalValue: nft.collection.floorPrice,
          originalSymbol: 'ETH'
        };
      } else if (nft.collection.floorPrice?.valueWithDenomination) {
        const symbol = nft.collection.floorPrice.denomination?.symbol || 'ETH';
        if (symbol === 'ETH') {
          return {
            value: nft.collection.floorPrice.valueWithDenomination * ETH_USD_ESTIMATE,
            symbol: 'USD',
            isUsd: true,
            originalValue: nft.collection.floorPrice.valueWithDenomination,
            originalSymbol: 'ETH'
          };
        } else {
          return {
            value: nft.collection.floorPrice.valueWithDenomination,
            symbol: symbol,
            isUsd: symbol === 'USD'
          };
        }
      }
    }
    
    // 10. Legacy collection floor price
    if (nft.collection?.floorPriceEth !== undefined && nft.collection.floorPriceEth !== null) {
      return {
        value: nft.collection.floorPriceEth * ETH_USD_ESTIMATE,
        symbol: 'USD',
        isUsd: true,
        originalValue: nft.collection.floorPriceEth,
        originalSymbol: 'ETH'
      };
    }
    
    // If no value found
    return {
      value: 0,
      symbol: 'USD',
      isUsd: true
    };
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

  // Format the estimated value with appropriate precision
  const formatEstimatedValue = (valueData) => {
    if (!valueData || valueData.value === undefined || valueData.value === null) return 'N/A';
    
    const { value, symbol, isUsd, originalValue, originalSymbol } = valueData;
    
    // Always display in USD format for consistency
    if (isUsd || symbol === 'USD') {
      // Handle near-zero values
      if (value < 0.01) {
        return '< $0.01';
      }
      
      // Format USD value
      return `$${parseFloat(value).toFixed(2)}`;
    }
    // If there's an original ETH value, show it in parentheses
    else if (originalValue !== undefined && originalSymbol) {
      // Handle near-zero values
      if (value < 0.01) {
        return `< 0.01 ${symbol}`;
      }
      
      // Format with original value
      return `${parseFloat(value).toFixed(2)} ${symbol} (${parseFloat(originalValue).toFixed(2)} ${originalSymbol})`;
    }
    // For other currencies
    else {
      // Handle near-zero values
      if (value < 0.01) {
        return `< 0.01 ${symbol}`;
      }
      
      // Format with currency symbol
      return `${parseFloat(value).toFixed(2)} ${symbol}`;
    }
  };

  return (
    <CardContainer 
      onClick={handleCardClick} 
      className={`nft-card ${disabled ? 'disabled' : ''}`}
      disabled={disabled}
    >
      <div className="image-container">
        {imageLoadingState}
        <img
          src={imageUrl}
          alt={name}
          className={`nft-image ${imageLoaded ? 'loaded' : ''}`}
          onLoad={() => setImageLoaded(true)}
        />
        
        <button
          className="like-button"
          onClick={handleLikeClick}
          aria-label={isLiked ? "Unlike NFT" : "Like NFT"}
        >
          {isLiked ? <AiFillHeart color="red" /> : <AiOutlineHeart />}
        </button>
      </div>

      <div className="nft-details">
        <div className="nft-info">
          <h3 className="nft-name">{name || `#${tokenId}`}</h3>
          {showCollectionName && (
            <p className="collection-name">{collection || 'Unknown Collection'}</p>
          )}
        </div>

        <div className="nft-meta">
          <div className="nft-price">
            {showLastPrice && nft.lastPrice ? (
              <PriceDisplay 
                label="Last Price" 
                amount={nft.lastPrice} 
                currency={nft.lastPriceCurrency} 
              />
            ) : (
              <PriceDisplay 
                label="Est. Value" 
                amount={nft.estimatedValue} 
                currency="USD"
                precision={2} 
              />
            )}
          </div>
          
          <button
            className="holders-button"
            onClick={handleHoldersClick}
            aria-label="View collection holders"
          >
            <FaUsers />
          </button>
        </div>
      </div>

      {showHolders && (
        <CollectionHoldersModal
          collectionAddress={contractAddress}
          userFid={profile?.fid}
          onClose={handleCloseModal}
        />
      )}
      {showHolders && !contractAddress && (
        <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', 
                    backgroundColor: 'white', padding: '20px', zIndex: 1000, borderRadius: '8px' }}>
          <p>Unable to display holders: Missing collection address</p>
          <button onClick={() => setShowHolders(false)}>Close</button>
        </div>
      )}
    </CardContainer>
  );
};

// Styled components
const CardContainer = styled.div`
  background-color: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05);
  transition: transform 0.2s, box-shadow 0.2s;
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
  }
`;

const ImageContainer = styled.div`
  position: relative;
  width: 100%;
  padding-top: 100%; /* 1:1 Aspect Ratio */
  background-color: #f0f0f0;
`;

const Image = styled.img`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const PlaceholderImage = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f0f0f0;
  color: #999;
`;

const CardContent = styled.div`
  padding: 1rem;
`;

const Title = styled.h3`
  margin: 0 0 0.25rem 0;
  font-size: 1rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const CollectionName = styled.p`
  margin: 0 0 0.75rem 0;
  font-size: 0.85rem;
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const CardFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.5rem;
`;

const EstimatedValue = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  color: #4caf50;
  font-weight: 600;
  font-size: 1rem;
`;

const HoldersButton = styled.button`
  background-color: rgba(0, 0, 0, 0.7);
  border: none;
  border-radius: 50%;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  color: white;
  cursor: pointer;
  transition: background-color 0.2s, transform 0.2s;
  margin-left: 0.5rem;
  
  &:hover {
    background-color: rgba(76, 175, 80, 0.8);
    transform: scale(1.1);
  }
`;

export default NftCard; 