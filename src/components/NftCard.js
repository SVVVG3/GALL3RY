import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import CollectionHoldersModal from './CollectionHoldersModal';
import NFTImage from './NFTImage';
import styled from 'styled-components';
import { FaEthereum } from 'react-icons/fa';

/**
 * NftCard component for displaying a single NFT
 */
const NftCard = ({ nft, onClick }) => {
  const [showHolders, setShowHolders] = useState(false);
  const { profile, isAuthenticated } = useAuth();

  // Add debugging
  console.log("NFT Card Auth State:", { isAuthenticated, profile, fid: profile?.fid });
  
  const handleClick = () => {
    console.log("NFT Card clicked, auth state:", { isAuthenticated, profile, fid: profile?.fid });
    
    if (isAuthenticated && profile && profile.fid) {
      console.log("Opening collection holders modal for collection address:", contractAddress);
      
      // Make sure we have a collection address before trying to show the modal
      if (contractAddress) {
        // Add more debugging for the collection address
        console.log("Collection address details:", {
          address: contractAddress,
          collection: nft.collection,
          collectionId: nft.collection?.id
        });
        
        setShowHolders(true);
      } else {
        console.error("Cannot open modal: No collection address available for this NFT");
        // Could show a toast or alert here
        if (onClick) {
          onClick(nft);
        }
      }
    } else if (onClick) {
      onClick(nft);
    }
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
    
    // Prioritize valueEth directly
    if (nft.valueEth !== undefined && nft.valueEth !== null) {
      return {
        value: nft.valueEth,
        symbol: 'ETH'
      };
    }
    
    // Then check for estimatedValue with valueWithDenomination
    if (nft.estimatedValue?.valueWithDenomination !== undefined && 
        nft.estimatedValue.valueWithDenomination !== null) {
      return {
        value: nft.estimatedValue.valueWithDenomination,
        symbol: nft.estimatedValue.denomination?.symbol || 'ETH'
      };
    }
    
    // Then check for consistent format we added
    if (nft.valueEth !== undefined && nft.valueEth !== null) {
      return {
        value: nft.valueEth,
        symbol: 'ETH'
      };
    }
    
    // Fallback to collection floor price
    if (nft.collection?.floorPriceEth !== undefined && nft.collection.floorPriceEth !== null) {
      return {
        value: nft.collection.floorPriceEth,
        symbol: 'ETH'
      };
    }
    
    // Final fallback - return 0 ETH if collection exists
    if (nft.collection) {
      return {
        value: 0,
        symbol: 'ETH'
      };
    }
    
    return null;
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
  const formatEstimatedValue = (value) => {
    if (!value) return 'N/A';
    
    if (value < 0.01) {
      return '< 0.01 ETH';
    }
    
    return `${parseFloat(value).toFixed(2)} ETH`;
  };

  return (
    <CardContainer>
      <ImageContainer>
        {imageUrl ? (
          <NFTImage src={imageUrl} alt={name} />
        ) : (
          <PlaceholderImage>No Image</PlaceholderImage>
        )}
      </ImageContainer>
      
      <CardContent>
        <Title>{name || `#${tokenId}`}</Title>
        <CollectionName>{collection || 'Unknown Collection'}</CollectionName>
        
        <EstimatedValue>
          <FaEthereum />
          <span>{formatEstimatedValue(valueData?.value)}</span>
        </EstimatedValue>
      </CardContent>
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

const EstimatedValue = styled.div`
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
  color: #4caf50;
  font-weight: 600;
  font-size: 1rem;
`;

export default NftCard; 