import React, { useState, useEffect } from 'react';
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
  
  // Define getCollectionName and getFloorPrice first so they can be safely used in the useEffect
  const getCollectionName = () => {
    if (!nft) return "Unknown Collection";
    if (nft.collection?.name) return nft.collection.name;
    if (nft.contractMetadata?.name) return nft.contractMetadata.name;
    if (nft.contractMetadata?.openSea?.collectionName) return nft.contractMetadata.openSea.collectionName;
    if (nft.title && nft.title.includes('#')) {
      // Extract collection name from title if it follows "Collection Name #123" format
      return nft.title.split('#')[0].trim();
    }
    return "Unknown Collection";
  };

  const getFloorPrice = () => {
    if (!nft) return "N/A";
    
    // Check collection floor price (most reliable source)
    if (nft.collection?.floorPrice) {
      // Check for valueUsd first for consistency
      if (nft.collection.floorPrice.valueUsd !== undefined && 
          nft.collection.floorPrice.valueUsd !== null) {
        const value = parseFloat(nft.collection.floorPrice.valueUsd);
        return value < 0.01 ? '< $0.01' : `$${value.toFixed(2)}`;
      }
      
      // Then check for ETH value
      if (nft.collection.floorPrice.value !== undefined && 
          nft.collection.floorPrice.value !== null) {
        const value = parseFloat(nft.collection.floorPrice.value);
        const symbol = nft.collection.floorPrice.currency || 'ETH';
        return value < 0.01 ? `< 0.01 ${symbol}` : `${value.toFixed(2)} ${symbol}`;
      }
    }
    
    // Check for OpenSea floor price in contractMetadata
    if (nft.contractMetadata?.openSea?.floorPrice !== undefined && 
        nft.contractMetadata.openSea.floorPrice !== null) {
      const value = parseFloat(nft.contractMetadata.openSea.floorPrice);
      return value < 0.01 ? '< 0.01 ETH' : `${value.toFixed(2)} ETH`;
    }
    
    // Check Alchemy estimatedValue
    if (nft.estimatedValue) {
      if (nft.estimatedValue.valueUsd !== undefined && 
          nft.estimatedValue.valueUsd !== null) {
        const value = parseFloat(nft.estimatedValue.valueUsd);
        return value < 0.01 ? '< $0.01' : `$${value.toFixed(2)}`;
      }
      
      if (nft.estimatedValue.valueWithDenomination !== undefined) {
        const value = parseFloat(nft.estimatedValue.valueWithDenomination);
        const symbol = nft.estimatedValue.denomination?.symbol || 'ETH';
        return value < 0.01 ? `< 0.01 ${symbol}` : `${value.toFixed(2)} ${symbol}`;
      }
    }
    
    // Check direct USD values
    if (nft.estimatedValueInUSD !== undefined && nft.estimatedValueInUSD !== null) {
      const value = parseFloat(nft.estimatedValueInUSD);
      return value < 0.01 ? '< $0.01' : `$${value.toFixed(2)}`;
    }
    
    if (nft.valuation?.balance_usd !== undefined && nft.valuation.balance_usd !== null) {
      const value = parseFloat(nft.valuation.balance_usd);
      return value < 0.01 ? '< $0.01' : `$${value.toFixed(2)}`;
    }
    
    return "N/A";
  };
  
  // Get image URL safely
  const getImageUrl = () => {
    if (!nft) return '/placeholder.png';
    
    // Follow Alchemy's recommended best practice order:
    // 1. First try media.gateway
    if (nft.media?.gateway && nft.media.gateway.startsWith('http')) {
      return nft.media.gateway;
    }
    
    // 2. Then try media.raw
    if (nft.media?.raw && nft.media.raw.startsWith('http')) {
      return nft.media.raw;
    }
    
    // 3. Check media array (if it's an array)
    if (nft.media && Array.isArray(nft.media) && nft.media.length > 0) {
      for (const media of nft.media) {
        if (media?.gateway && media.gateway.startsWith('http')) {
          return media.gateway;
        }
        if (media?.raw && media.raw.startsWith('http')) {
          return media.raw;
        }
      }
    }
    
    // If the NFT has an imageUrl property, use that
    if (nft.imageUrl && nft.imageUrl.startsWith('http')) {
      return nft.imageUrl;
    }

    // Try to get image from mediasV3 object with edges structure (Alchemy API format)
    if (nft.mediasV3) {
      // Check images edges first
      if (nft.mediasV3.images?.edges && nft.mediasV3.images.edges.length > 0) {
        const imageEdge = nft.mediasV3.images.edges[0];
        if (imageEdge?.node?.original && imageEdge.node.original.startsWith('http')) {
          return imageEdge.node.original;
        }
        if (imageEdge?.node?.thumbnail && imageEdge.node.thumbnail.startsWith('http')) {
          return imageEdge.node.thumbnail;
        }
        if (imageEdge?.node?.large && imageEdge.node.large.startsWith('http')) {
          return imageEdge.node.large;
        }
      }
      
      // Check animations edges as fallback
      if (nft.mediasV3.animations?.edges && nft.mediasV3.animations.edges.length > 0) {
        const animationEdge = nft.mediasV3.animations.edges[0];
        if (animationEdge?.node?.thumbnail && animationEdge.node.thumbnail.startsWith('http')) {
          return animationEdge.node.thumbnail;
        }
        if (animationEdge?.node?.original && animationEdge.node.original.startsWith('http')) {
          return animationEdge.node.original;
        }
      }
      
      // Handle older mediasV3 as array format (legacy support)
      if (Array.isArray(nft.mediasV3) && nft.mediasV3.length > 0) {
        for (const media of nft.mediasV3) {
          if (media?.originalUrl && media.originalUrl.startsWith('http')) {
            return media.originalUrl;
          }
          if (media?.thumbnailUrl && media.thumbnailUrl.startsWith('http')) {
            return media.thumbnailUrl;
          }
          if (media?.url && media.url.startsWith('http')) {
            return media.url;
          }
        }
      }
    }

    // Try to get image from mediasV2 array (legacy format)
    if (nft.mediasV2 && Array.isArray(nft.mediasV2) && nft.mediasV2.length > 0) {
      for (const media of nft.mediasV2) {
        if (media?.url && media.url.startsWith('http')) {
          return media.url;
        }
        if (media?.original && media.original.startsWith('http')) {
          return media.original;
        }
      }
    }

    // 4. If NFT has a metadata object with image (Alchemy's final recommendation)
    if (nft.metadata?.image && nft.metadata.image.startsWith('http')) {
      return nft.metadata.image;
    }

    // Try the contractMetadata for the collection logo as last resort
    if (nft.contractMetadata?.openSea?.imageUrl && nft.contractMetadata.openSea.imageUrl.startsWith('http')) {
      return nft.contractMetadata.openSea.imageUrl;
    }

    // If no valid image URL was found
    return '/placeholder.png';
  };
  
  // Pre-compute these values
  const imageUrl = nft ? getImageUrl() : '/placeholder.png';
  
  // Adding a useEffect at the top level that runs unconditionally
  useEffect(() => {
    // Debug logging for prices and URLs
    if (nft) {
      if (!imageUrl || imageUrl === '/placeholder.png') {
        console.debug(`NFT missing image URL - Debug info:`, {
          id: nft.id,
          name: nft.title || nft.name,
          collection: getCollectionName(),
          tokenId: nft.tokenId,
          hasMedia: Boolean(nft.media?.length),
          hasMediasV2: Boolean(nft.mediasV2?.length),
          hasMediasV3: Boolean(nft.mediasV3?.length),
          hasMetadataImage: Boolean(nft.metadata?.image)
        });
      }
      
      const floorPrice = getFloorPrice();
      if (floorPrice === "N/A") {
        console.debug(`NFT pricing debug info:`, {
          id: nft.id,
          name: nft.title || nft.name,
          valueInUSD: nft.valueInUSD,
          estimatedValue: nft.estimatedValueInUSD,
          balanceUSD: nft.valuation?.balance_usd,
          floorPrice: nft.collection?.floorPrice?.value,
          hasContractMetadata: Boolean(nft.contractMetadata)
        });
      }
    }
  }, [nft, imageUrl]);
  
  // Add empty useEffect for debugging that will run for all NFTs
  useEffect(() => {
    // Debugging hook
    return () => {
      // Cleanup when component unmounts
    };
  }, []);
  
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
  const collection = getCollectionName();
  const tokenId = getTokenId();
  
  // Debug logging
  if (!imageUrl) {
    console.warn(`NFT is missing image URL:`, {
      id: nft.id,
      name,
      collection,
      tokenId,
      mediaV3: nft.mediasV3 ? 'present' : 'missing',
      mediaV2: nft.mediasV2 ? 'present' : 'missing',
      media: nft.media ? 'present' : 'missing',
      imageUrl: nft.imageUrl || 'missing'
    });
  }
  
  // Additional price debugging
  const valueDebug = {
    id: nft.id,
    name,
    valueUsd: nft.valueUsd,
    estimatedValue: nft.estimatedValue,
    balanceUSD: nft.balanceUSD,
    floorPrice: getFloorPrice(),
    hasContractMetadata: !!nft.contractMetadata,
    contractMetadataOpenSea: nft.contractMetadata?.openSea ? 'present' : 'missing',
    collectionFloorPrice: nft.collection?.floorPrice ? 'present' : 'missing',
  };
  console.log('NFT price debug:', valueDebug);

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
      
      // Track event with a safer approach - remove analytics reference if it's causing circular dependency
      // analytics.track('NFT Holders Viewed', {
      //   collectionAddress: contractAddress,
      //   network: currentNetwork
      // });
      // Use console.log instead temporarily
      console.log('NFT Holders viewed:', {
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
    
    // Track the like action - replaced with console.log to avoid circular dependency
    // analytics.track('NFT Liked', {
    //   nftId: nft.id,
    //   collection: collection
    // });
    console.log('NFT Liked:', {
      nftId: nft.id,
      collection: collection
    });
  };

  const handleImageError = () => {
    setImageError(true);
  };

  const getValue = () => {
    // Try all possible ways this property might exist
    
    // 1. First check direct USD values
    if (nft.valueUsd !== undefined && nft.valueUsd !== null) {
      return {
        value: parseFloat(nft.valueUsd),
        symbol: 'USD',
        isUsd: true,
        label: 'Value'
      };
    }
    
    // 2. Check for Alchemy-style estimatedValue
    if (nft.estimatedValue) {
      if (nft.estimatedValue.valueUsd !== undefined && nft.estimatedValue.valueUsd !== null) {
        return {
          value: parseFloat(nft.estimatedValue.valueUsd),
          symbol: 'USD',
          isUsd: true,
          label: 'Est. Value'
        };
      }
      
      if (nft.estimatedValue.valueWithDenomination !== undefined) {
        return {
          value: parseFloat(nft.estimatedValue.valueWithDenomination),
          symbol: nft.estimatedValue.denomination?.symbol || 'ETH',
          isUsd: false,
          label: 'Est. Value'
        };
      }
      
      if (nft.estimatedValue.amount !== undefined) {
        return {
          value: parseFloat(nft.estimatedValue.amount),
          symbol: nft.estimatedValue.currency || 'USD',
          isUsd: (nft.estimatedValue.currency === 'USD'),
          label: 'Est. Value'
        };
      }
    }
    
    // 3. Check collection floor price as a fallback
    if (nft.collection?.floorPrice) {
      const floorPrice = nft.collection.floorPrice;
      
      if (floorPrice.valueUsd !== undefined && floorPrice.valueUsd !== null) {
        return {
          value: parseFloat(floorPrice.valueUsd),
          symbol: 'USD',
          isUsd: true,
          label: 'Floor'
        };
      }
      
      if (floorPrice.value !== undefined && floorPrice.value !== null) {
        return {
          value: parseFloat(floorPrice.value),
          symbol: floorPrice.currency || 'ETH',
          isUsd: false,
          label: 'Floor'
        };
      }
    }
    
    // 4. Check for other common price fields
    if (nft.balanceUSD !== undefined && nft.balanceUSD !== null) {
      return {
        value: parseFloat(nft.balanceUSD),
        symbol: 'USD',
        isUsd: true,
        label: 'Value'
      };
    }
    
    if (nft.valuation?.balance_usd !== undefined && nft.valuation.balance_usd !== null) {
      return {
        value: parseFloat(nft.valuation.balance_usd),
        symbol: 'USD',
        isUsd: true,
        label: 'Value'
      };
    }
    
    // 5. Look for contractMetadata with price info
    if (nft.contractMetadata?.openSea?.floorPrice !== undefined && 
        nft.contractMetadata.openSea.floorPrice !== null) {
      return {
        value: parseFloat(nft.contractMetadata.openSea.floorPrice),
        symbol: 'ETH',
        isUsd: false,
        label: 'Floor'
      };
    }
    
    // Return null if no value found to indicate absence
    return null;
  };
  
  // Format the estimated value with appropriate precision
  const formatEstimatedValue = (valueData) => {
    if (!valueData || valueData.value === undefined || valueData.value === null) return 'N/A';
    
    const { value, symbol, isUsd, label } = valueData;
    
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
    else {
      // Handle near-zero values
      if (value < 0.01) {
        return `< 0.01 ${symbol}`;
      }
      
      // Format with currency symbol
      return `${parseFloat(value).toFixed(2)} ${symbol}`;
    }
  };

  const estimatedValue = formatEstimatedValue(getValue());

  // Get price info for display (last sale price, etc.) - More robust implementation
  const getPriceInfo = () => {
    // Check multiple possible sources for price data
    if (nft.lastSaleValue) {
      return {
        amount: parseFloat(nft.lastSaleValue),
        currency: 'ETH'
      };
    }
    
    if (nft.lastSale?.valueWithDenomination) {
      return {
        amount: parseFloat(nft.lastSale.valueWithDenomination),
        currency: 'ETH'
      };
    }
    
    if (nft.lastSale?.value) {
      return {
        amount: parseFloat(nft.lastSale.value),
        currency: 'ETH'
      };
    }
    
    // Check for Alchemy API format
    if (nft.lastPrice || nft.lastPriceEth) {
      return {
        amount: parseFloat(nft.lastPrice || nft.lastPriceEth),
        currency: 'ETH'
      };
    }
    
    return null;
  };

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
            {/* Floor Price or Estimated Value display */}
            {getValue() ? (
              <PriceDisplay 
                label={getValue().label}
                amount={getValue().value}
                currency={getValue().symbol}
              />
            ) : getFloorPrice() !== "N/A" ? (
              <PriceDisplay 
                label="Floor"
                amount={getFloorPrice()}
              />
            ) : (
              <div className="price-container">
                <span className="price-label">Price:</span>
                <span className="price-value">N/A</span>
              </div>
            )}
          </PriceContainer>
          
          {hasValidContractAddress() && (
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

const PriceSection = styled.div`  font-size: 0.9rem;
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
