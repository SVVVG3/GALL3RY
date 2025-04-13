/**
 * Utility functions for formatting data
 */

/**
 * Format a blockchain address to a shortened form
 * @param {string} address - The blockchain address to format
 * @param {number} chars - Number of characters to show at start and end
 * @returns {string} Formatted address
 */
export const formatAddress = (address, chars = 4) => {
  if (!address) return '';
  if (typeof address !== 'string') return '';
  if (address.length <= chars * 2) return address;
  
  return `${address.substring(0, chars)}...${address.substring(address.length - chars)}`;
};

/**
 * Format a numeric value to a display string with appropriate precision
 * @param {number} value - The numeric value to format
 * @param {string} currency - The currency symbol (USD, ETH, etc.)
 * @param {number} precision - Number of decimal places
 * @returns {string} Formatted value string
 */
export const formatValue = (value, currency = 'USD', precision = 2) => {
  if (value === undefined || value === null) return 'N/A';
  
  const numValue = parseFloat(value);
  if (isNaN(numValue)) return 'N/A';
  
  // Handle small values
  if (numValue < 0.01) return `< ${currency === 'USD' ? '$' : ''}0.01`;
  
  // Format based on currency
  if (currency === 'USD') {
    return `$${numValue.toFixed(precision)}`;
  }
  
  return `${numValue.toFixed(precision)} ${currency}`;
};

/**
 * Format a date to a human-readable string
 * @param {Date|string} date - Date object or date string
 * @param {boolean} includeTime - Whether to include the time
 * @returns {string} Formatted date string
 */
export const formatDate = (date, includeTime = false) => {
  if (!date) return '';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  if (!(dateObj instanceof Date) || isNaN(dateObj)) return '';
  
  const options = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {})
  };
  
  return dateObj.toLocaleDateString('en-US', options);
};

/**
 * Format a number with comma separators
 * @param {number} num - The number to format
 * @returns {string} Number with comma separators
 */
export const formatNumber = (num) => {
  if (num === undefined || num === null) return '0';
  
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}; 