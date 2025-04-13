import React from 'react';
import styled from 'styled-components';
import { FaEthereum } from 'react-icons/fa';

/**
 * PriceDisplay component
 * Handles displaying price/value information for NFTs with proper formatting
 */
const PriceDisplay = ({ 
  label = 'Est. Value', 
  amount, 
  currency = 'USD', 
  precision = 2,
  showIcon = true
}) => {
  // Format number to appropriate precision
  const formatAmount = (value) => {
    if (value === undefined || value === null) return 'N/A';
    
    // Handle objects with amount and currency properties
    if (typeof value === 'object' && value.amount !== undefined) {
      return formatAmount(value.amount);
    }
    
    const numValue = parseFloat(value);
    
    // Check if value is a valid number
    if (isNaN(numValue)) return 'N/A';
    
    // Format based on size of value
    if (numValue < 0.01) return `< ${currency === 'USD' ? '$' : ''}0.01`;
    
    // Standard formatting with appropriate precision
    return numValue.toFixed(precision);
  };
  
  // Get currency symbol
  const getCurrencySymbol = (currencyCode) => {
    if (!currencyCode) return '';
    
    if (currencyCode === 'USD') return '$';
    if (currencyCode === 'ETH') return <FaEthereum />;
    
    return '';
  };
  
  // Handle objects with amount and currency properties
  let displayCurrency = currency;
  let displayAmount = amount;
  
  if (typeof amount === 'object') {
    if (amount?.currency) displayCurrency = amount.currency;
    if (amount?.amount !== undefined) displayAmount = amount.amount;
  }
  
  const formattedAmount = formatAmount(displayAmount);
  const symbol = getCurrencySymbol(displayCurrency);
  
  return (
    <Container>
      {label && <Label>{label}</Label>}
      <Amount>
        {displayCurrency === 'USD' ? (
          <>
            {symbol}{formattedAmount}
          </>
        ) : displayCurrency === 'ETH' ? (
          <>
            {formattedAmount} {showIcon && symbol}
          </>
        ) : (
          <>
            {formattedAmount} {displayCurrency}
          </>
        )}
      </Amount>
    </Container>
  );
};

// Styled components
const Container = styled.div`
  display: flex;
  flex-direction: column;
`;

const Label = styled.span`
  font-size: 0.75rem;
  color: #666;
  margin-bottom: 2px;
`;

const Amount = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
  color: #4caf50;
  
  svg {
    font-size: 0.9em;
  }
`;

export default PriceDisplay; 