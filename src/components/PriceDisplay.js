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
    if (value === undefined || value === null || value === '' || value === 'N/A') {
      return 'N/A';
    }
    
    // Handle objects with amount and currency properties
    if (typeof value === 'object' && value.amount !== undefined) {
      return formatAmount(value.amount);
    }
    
    // Handle string values
    if (typeof value === 'string' && value.toLowerCase() === 'n/a') {
      return 'N/A';
    }
    
    const numValue = parseFloat(value);
    
    // Check if value is a valid number
    if (isNaN(numValue)) {
      return 'N/A';
    }
    
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
  
  // Handle different input formats
  let displayCurrency = currency;
  let displayAmount = amount;
  
  // Debug logging
  console.log('PriceDisplay input:', { amount, currency, type: typeof amount });
  
  // Handle case where amount is an object with amount/currency
  if (amount && typeof amount === 'object') {
    // New format from getValue
    if (amount.amount !== undefined) {
      displayAmount = amount.amount;
      if (amount.currency) displayCurrency = amount.currency;
    } 
    // Legacy format
    else if (amount.value !== undefined) {
      displayAmount = amount.value;
      if (amount.symbol) displayCurrency = amount.symbol;
    }
  }
  
  // Format the amount for display
  const formattedAmount = formatAmount(displayAmount);
  const symbol = getCurrencySymbol(displayCurrency);
  
  // If we have no valid amount to display, return null
  if (formattedAmount === 'N/A' || displayAmount === 0) {
    return null;
  }
  
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