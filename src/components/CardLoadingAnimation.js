import React from 'react';
import styled, { keyframes } from 'styled-components';

/**
 * Card loading animation component
 * Displays a skeleton loading animation for NFT cards
 */
const CardLoadingAnimation = () => {
  return (
    <LoadingContainer>
      <Shimmer />
    </LoadingContainer>
  );
};

// Animation keyframes
const shimmerAnimation = keyframes`
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
`;

// Styled components
const LoadingContainer = styled.div`
  width: 100%;
  height: 100%;
  background-color: #f0f0f0;
  position: relative;
  overflow: hidden;
`;

const Shimmer = styled.div`
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0),
    rgba(255, 255, 255, 0.5),
    rgba(255, 255, 255, 0)
  );
  background-size: 200% 100%;
  animation: ${shimmerAnimation} 1.5s infinite;
  position: absolute;
  top: 0;
  left: 0;
`;

export default CardLoadingAnimation; 