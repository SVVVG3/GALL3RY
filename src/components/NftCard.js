import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import CollectionHoldersModal from './CollectionHoldersModal';
import NFTImage from './NFTImage';
import styled from 'styled-components';
import { FaEthereum, FaUsers, FaHeart } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import { useNFT } from '../contexts/NFTContext';
import './NftCard.css';
import CardLoadingAnimation from './CardLoadingAnimation';
import PriceDisplay from './PriceDisplay';
import { formatAddress } from '../utils/format';
import analytics from '../utils/analytics';

/**
 * Enhanced NFT Card component with better styling and animations
 */
const NftCard = ({ 
  nft, 
  onClick, 
  disabled, 
  showLastPrice = false, 
  showCollectionName = true,
  showLikeButton = false,
  onLike = null,
}) => {
  // Move all hooks to the top, before any conditionals
  const { userFid } = useNFT();
  const navigate = useNavigate();
  const [showHolders, setShowHolders] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const { profile, isAuthenticated } = useAuth();
  const [currentContractAddress, setCurrentContractAddress] = useState(null);
  const [currentNetwork, setCurrentNetwork] = useState('ETHEREUM_MAINNET');
  
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

  const getTokenId = () => {
    if (nft.tokenId) return nft.tokenId;
    if (nft.token?.tokenId) return nft.token.tokenId;
    // Try to extract from NFT ID if it includes a colon and a dash (common format)
    if (nft.id && typeof nft.id === 'string') {
      const parts = nft.id.split(':');
      if (parts.length > 1) {
        const secondPart = parts[1];
        if (secondPart.includes('-')) {
          const tokenIdPart = secondPart.split('-')[1];
          if (tokenIdPart) return tokenIdPart;
        }
      }
    }
    return null;
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
  
  // Check if we can extract a valid contract address WITHOUT actually extracting it yet
  // This is just to determine if we should show the holders button
  const hasValidContractAddress = () => {
    // Check for direct contract address
    if (nft.collection?.address && typeof nft.collection.address === 'string' && nft.collection.address.length > 0) {
      return true;
    }
    
    if (nft.contractAddress && typeof nft.contractAddress === 'string' && nft.contractAddress.length > 0) {
      return true;
    }
    
    if (nft.contract?.address && typeof nft.contract.address === 'string' && nft.contract.address.length > 0) {
      return true;
    }
    
    if (nft.token?.collection?.address && typeof nft.token.collection.address === 'string' && nft.token.collection.address.length > 0) {
      return true;
    }
    
    // Try to extract from collection ID only if it exists and appears to be a valid format
    if (nft.collection?.id && typeof nft.collection.id === 'string') {
      // Check if it looks like a base64 encoded ID or contains expected separators
      if (nft.collection.id.match(/^[A-Za-z0-9+/=]+$/) || nft.collection.id.includes('-')) {
        return true;
      }
    }
    
    // Try to extract from NFT ID if it contains a colon and appears to be a valid format
    if (nft.id && typeof nft.id === 'string' && nft.id.includes(':')) {
      const parts = nft.id.split(':');
      if (parts.length >= 2 && parts[1] && parts[1].length > 0) {
        return true;
      }
    }
    
    return false;
  };
  
  // Extract collection address and network - Only called when needed, not during initial render
  const getContractAddress = () => {
    try {
      // Default network to ethereum mainnet if not specified
      let network = 'ETHEREUM_MAINNET';
      let contractAddress = null;
      
      // First try direct access to address property
      if (nft.collection?.address && typeof nft.collection.address === 'string' && nft.collection.address.length > 0) {
        contractAddress = nft.collection.address;
        // Update network if available
        if (nft.collection.network) {
          // Format properly for GraphQL query - all caps with _MAINNET suffix
          network = formatNetworkForGraphQL(nft.collection.network);
        } else if (nft.network) {
          network = formatNetworkForGraphQL(nft.network);
        }
      } 
      // Then try to extract from collection ID (which is base64 encoded)
      else if (nft.collection?.id && typeof nft.collection.id === 'string') {
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
                if (parts.length > 1 && parts[1] && parts[1].length > 0) {
                  contractAddress = parts[1];
                  console.log("Successfully extracted collection ID:", contractAddress);
                  
                  // Try to extract network from the first part if possible
                  if (parts[0]) {
                    network = formatNetworkForGraphQL(parts[0]);
                  }
                }
              }
            } catch (e) {
              console.error("Error decoding collection ID:", e);
            }
          } 
          // If it's already in the format of a collection ID, use it directly
          else if (collectionId.includes('-')) {
            const parts = collectionId.split('-');
            if (parts.length > 1 && parts[1] && parts[1].length > 0) {
              contractAddress = parts[1];
              console.log("Using collection ID directly:", collectionId);
              
              // Try to extract network from the first part if possible
              if (parts[0]) {
                network = formatNetworkForGraphQL(parts[0]);
              }
            }
          }
        } catch (e) {
          console.error("Error processing collection ID:", e);
        }
      }
      
      // Fallback to other potential sources
      if (!contractAddress) {
        // Check each potential source and ensure it's a string with content
        if (nft.contractAddress && typeof nft.contractAddress === 'string' && nft.contractAddress.length > 0) {
          contractAddress = nft.contractAddress;
        } else if (nft.contract?.address && typeof nft.contract.address === 'string' && nft.contract.address.length > 0) {
          contractAddress = nft.contract.address;
        } else if (nft.token?.collection?.address && typeof nft.token.collection.address === 'string' && 
                  nft.token.collection.address.length > 0) {
          contractAddress = nft.token.collection.address;
        }
        
        // Update network if available
        if (nft.network) {
          network = formatNetworkForGraphQL(nft.network);
        } else if (nft.token?.collection?.network) {
          network = formatNetworkForGraphQL(nft.token.collection.network);
        }
      }
      
      // Try one more approach if we still don't have a contract address
      if (!contractAddress && nft.id && typeof nft.id === 'string' && nft.id.includes(':')) {
        // NFT IDs often include collection info
        const idParts = nft.id.split(':');
        if (idParts.length >= 2 && idParts[1] && idParts[1].length > 0) {
          contractAddress = idParts[1];
          
          // If we can extract network from the ID, update it
          if (idParts[0]) {
            network = formatNetworkForGraphQL(idParts[0]);
          }
          
          console.log("Extracted contract address from NFT ID:", contractAddress);
        }
      }
      
      // Validate the contract address format - simple check for hex format with 0x prefix
      if (contractAddress && (!contractAddress.startsWith('0x') || !contractAddress.match(/^0x[a-fA-F0-9]+$/))) {
        console.warn("Contract address doesn't match expected format:", contractAddress);
        
        // Continue using it, but log the concern
        // This is needed because some Zapper data uses non-standard address formats
      }
      
      // Store the network for later use
      setCurrentNetwork(network);
      
      return contractAddress;
    } catch (error) {
      console.error("Error extracting contract address:", error);
      return null;
    }
  };
  
  // Helper to format network name for GraphQL
  const formatNetworkForGraphQL = (network) => {
    if (!network) return 'ETHEREUM_MAINNET';
    
    // Convert to uppercase
    const normalizedNetwork = network.toUpperCase();
    
    // Add _MAINNET suffix if not already present
    if (!normalizedNetwork.includes('_MAINNET')) {
      // Handle known network names
      if (normalizedNetwork === 'ETHEREUM' || normalizedNetwork === 'ETH') {
        return 'ETHEREUM_MAINNET';
      } else if (normalizedNetwork === 'POLYGON' || normalizedNetwork === 'MATIC') {
        return 'POLYGON_MAINNET';
      } else if (normalizedNetwork === 'ARBITRUM') {
        return 'ARBITRUM_MAINNET';
      } else if (normalizedNetwork === 'OPTIMISM') {
        return 'OPTIMISM_MAINNET';
      } else if (normalizedNetwork === 'BASE') {
        return 'BASE_MAINNET';
      } else if (normalizedNetwork === 'ZORA') {
        return 'ZORA_MAINNET';
      }
      
      // Default to adding _MAINNET suffix
      return `${normalizedNetwork}_MAINNET`;
    }
    
    return normalizedNetwork;
  };

  // Get data for rendering
  const name = getName();
  const collection = getCollection();
  const imageUrl = getImageUrl();
  const hasCollectionAddress = hasValidContractAddress();
  const tokenId = getTokenId();
  
  // Card loading skeleton shown until image is loaded
  const imageLoadingState = !imageLoaded && (
    <div className="nft-image-loading">
      <CardLoadingAnimation />
    </div>
  );

  const handleCardClick = (e) => {
    // Don't navigate if clicking on holders button or like button
    if (e.target.closest('.holders-button') || e.target.closest('.like-button')) {
      return;
    }

    if (onClick) {
      onClick(nft);
    }
  };
  
  const handleHoldersClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only extract the contract address when the button is clicked
    const contractAddress = getContractAddress();
    setCurrentContractAddress(contractAddress);
    
    console.log('Holders button clicked', { contractAddress, network: currentNetwork, profile });
    
    if (contractAddress) {
      setShowHolders(true);
      
      analytics.track('NFT Holders Viewed', {
        collectionAddress: contractAddress,
        network: currentNetwork
      });
    } else {
      // Show an error if we couldn't extract the contract address
      console.error('Could not extract a valid contract address for this NFT');
      alert('Unable to show holders: Missing collection address');
    }
  };
  
  const handleCloseModal = () => {
    setShowHolders(false);
  };

  const handleLikeClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    console.log('Like button clicked for NFT:', nft.id);
    
    // If an onLike callback was provided, call it with this NFT
    if (onLike) {
      onLike(nft);
    }
    
    // Track the like action
    analytics.track('NFT Liked', {
      nftId: nft.id,
      collection: collection
    });
  };

  const handleImageError = () => {
    setImageError(true);
  };

  const getValue = () => {
    // Debug log for value properties
    console.log('NFT value debug:', {
      id: nft.id,
      collection: nft.collection?.name,
      estimatedValue: nft.estimatedValue,
      balanceUSD: nft.balanceUSD,
      valueUsd: nft.valueUsd
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

    // 4. Check balanceUSD which is commonly returned in portfolio endpoints
    if (nft.balanceUSD !== undefined && nft.balanceUSD !== null) {
      return {
        value: nft.balanceUSD,
        symbol: 'USD',
        isUsd: true
      };
    }
    
    // 5. Check collection floor price in USD
    if (nft.collection?.floorPrice?.valueUsd !== undefined && 
        nft.collection.floorPrice.valueUsd !== null) {
      return {
        value: nft.collection.floorPrice.valueUsd,
        symbol: 'USD',
        isUsd: true
      };
    }
    
    // 6. valueEth (converted to USD)
    if (nft.valueEth !== undefined && nft.valueEth !== null) {
      return {
        value: nft.valueEth * ETH_USD_ESTIMATE,
        symbol: 'USD', 
        isUsd: true,
        originalValue: nft.valueEth,
        originalSymbol: 'ETH'
      };
    }
    
    // 7. Estimated value with denomination
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
    
    // 8. Legacy estimated value format
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
    
    // 9. Direct estimatedValue as a number (assume ETH)
    if (typeof nft.estimatedValue === 'number' && !isNaN(nft.estimatedValue)) {
      return {
        value: nft.estimatedValue * ETH_USD_ESTIMATE,
        symbol: 'USD',
        isUsd: true,
        originalValue: nft.estimatedValue,
        originalSymbol: 'ETH'
      };
    }
    
    // 10. Collection floor price 
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
    
    // 11. If no value is found, return a default
    return {
      value: 0,
      symbol: 'USD',
      isUsd: true
    };
  };

  const valueData = getValue();
  
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

  const estimatedValue = formatEstimatedValue(valueData);

  return (
    <CardContainer 
      onClick={handleCardClick} 
      className={`nft-card ${disabled ? 'disabled' : ''}`}
      disabled={disabled}
    >
      <ImageContainer>
        {showLikeButton && (
          <LikeButton 
            onClick={handleLikeClick}
            className="like-button"
            liked={nft.isLiked}
          >
            <FaHeart />
          </LikeButton>
        )}
        
        {imageLoadingState}
        
        <NFTImage 
          src={imageUrl} 
          alt={name} 
          onLoad={() => setImageLoaded(true)} 
          onError={handleImageError}
          className={`nft-image ${imageLoaded ? 'loaded' : ''}`}
        />
      </ImageContainer>
      
      <CardContent>
        <CardTitle title={name}>{name}</CardTitle>
        
        {showCollectionName && collection && (
          <CollectionName>{collection}</CollectionName>
        )}
        
        <CardFooter>
          <PriceContainer>
            {getValue() > 0 ? (
              <PriceDisplay 
                label="Est. Value"
                amount={getValue()}
                currency="USD"
              />
            ) : showLastPrice && getPriceInfo() ? (
              <PriceDisplay 
                label="Last Price"
                amount={getPriceInfo().amount}
                currency={getPriceInfo().currency}
              />
            ) : (
              <PriceDisplay 
                label="Floor Price"
                amount={getFloorPrice()}
                currency="ETH"
              />
            )}
          </PriceContainer>
          
          {hasCollectionAddress && (
            <HoldersButton 
              onClick={handleHoldersClick}
              className="holders-button"
              title="View Collection Holders"
            >
              <FaUsers />
            </HoldersButton>
          )}
        </CardFooter>
      </CardContent>
      
      {showHolders && (
        <CollectionHoldersModal 
          collectionAddress={currentContractAddress}
          userFid={userFid}
          onClose={handleCloseModal}
        />
      )}
    </CardContainer>
  );
};

// Styled components for enhanced NFT Card
const CardContainer = styled.div`
  background-color: white;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
  cursor: ${props => props.$disabled ? 'default' : 'pointer'};
  opacity: ${props => props.$disabled ? 0.7 : 1};
  height: 100%;
  
  &:hover {
    transform: ${props => props.$disabled ? 'none' : 'translateY(-5px)'};
    box-shadow: ${props => props.$disabled ? '0 4px 8px rgba(0, 0, 0, 0.05)' : '0 8px 16px rgba(0, 0, 0, 0.1)'};
  }
`;

const ImageContainer = styled.div`
  position: relative;
  width: 100%;
  padding-top: 100%; /* 1:1 Aspect Ratio */
  background-color: #f5f5f5;
  overflow: hidden;
`;

const CardImage = styled.img`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 0.3s ease;
  
  &.loaded {
    opacity: 1;
  }
`;

const FallbackImage = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: #e9ecef;
  color: #495057;
`;

const CollectionInitial = styled.div`
  font-size: 3rem;
  font-weight: bold;
  text-transform: uppercase;
`;

const TokenIdDisplay = styled.div`
  font-size: 1rem;
  margin-top: 0.5rem;
`;

const CardDetails = styled.div`
  padding: 1rem;
`;

const CardInfo = styled.div`
  margin-bottom: 0.75rem;
`;

const CardName = styled.h3`
  margin: 0 0 0.25rem 0;
  font-size: 1rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const CollectionName = styled.p`
  margin: 0;
  font-size: 0.85rem;
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const CardMeta = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const PriceSection = styled.div`
  font-size: 0.9rem;
`;

const LikeButton = styled.button`
  position: absolute;
  top: 10px;
  right: 10px;
  background-color: rgba(0, 0, 0, 0.5);
  border: none;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s;
  z-index: 2;
  
  &:hover {
    transform: scale(1.1);
  }
`;

const HoldersButton = styled.button`
  background-color: rgba(0, 0, 0, 0.1);
  border: none;
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.2s, transform 0.2s;
  color: #666;
  
  &:hover {
    background-color: rgba(76, 175, 80, 0.2);
    transform: scale(1.1);
    color: #4CAF50;
  }
`;

const CardContent = styled.div`
  padding: 1rem;
`;

const CardTitle = styled.h3`
  margin: 0 0 0.25rem 0;
  font-size: 1rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const CardFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const PriceContainer = styled.div`
  font-size: 0.9rem;
`;

export default NftCard; 