/**
 * Utility functions for formatting data
 */

/**
 * Formats an Ethereum address to a shortened form (0x123...abc)
 * @param {string} address - The Ethereum address to format
 * @param {number} startChars - Number of characters to show at the start
 * @param {number} endChars - Number of characters to show at the end
 * @returns {string} Formatted address
 */
export const formatAddress = (address, startChars = 4, endChars = 4) => {
  if (!address || typeof address !== 'string') {
    return '';
  }
  
  if (address.length <= startChars + endChars) {
    return address;
  }
  
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
};

/**
 * Formats a number to a string with the specified number of decimal places
 * @param {number} value - The number to format
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted number
 */
export const formatNumber = (value, decimals = 2) => {
  if (value === null || value === undefined) {
    return '';
  }
  
  return Number(value).toFixed(decimals);
};

/**
 * Formats a price in wei to ETH with the specified number of decimal places
 * @param {string|number} weiValue - The price in wei
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted price in ETH
 */
export const formatEthPrice = (weiValue, decimals = 4) => {
  if (!weiValue) {
    return '';
  }
  
  try {
    // Convert wei to ETH (1 ETH = 10^18 wei)
    const ethValue = Number(weiValue) / 1e18;
    return ethValue.toFixed(decimals);
  } catch (error) {
    console.error('Error formatting ETH price:', error);
    return '';
  }
};

/**
 * Formats a date to a human-readable string
 * @param {Date|string|number} date - The date to format
 * @returns {string} Formatted date
 */
export const formatDate = (date) => {
  if (!date) {
    return '';
  }
  
  try {
    const dateObj = new Date(date);
    return dateObj.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
}; 