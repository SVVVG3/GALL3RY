/**
 * Formats an ethereum address to a shorter readable format
 * @param {string} address - Full ethereum address
 * @param {number} startChars - Number of characters to show at start (default: 6)
 * @param {number} endChars - Number of characters to show at end (default: 4)
 * @returns {string} Formatted address with ellipsis
 */
export const formatAddress = (address, startChars = 6, endChars = 4) => {
  if (!address || typeof address !== 'string') return '';
  
  // Clean the address (remove 0x if present)
  const cleanAddress = address.startsWith('0x') ? address.slice(2) : address;
  
  if (cleanAddress.length <= startChars + endChars) {
    return address; // Return full address if it's too short
  }
  
  const start = address.slice(0, startChars + 2); // +2 for "0x"
  const end = address.slice(-endChars);
  
  return `${start}...${end}`;
};

/**
 * Formats a number to a readable string with commas as thousand separators
 * @param {number} num - The number to format
 * @param {number} decimals - Number of decimal places to include (default: 2)
 * @returns {string} Formatted number string
 */
export const formatNumber = (num, decimals = 2) => {
  if (num === null || num === undefined) return '';
  
  const parsedNum = typeof num === 'string' ? parseFloat(num) : num;
  
  if (isNaN(parsedNum)) return '';
  
  return parsedNum.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
};

/**
 * Formats a price value in ETH or other currency
 * @param {number|string} price - The price value
 * @param {string} symbol - Currency symbol (default: 'ETH')
 * @param {number} decimals - Number of decimal places (default: 4)
 * @returns {string} Formatted price with symbol
 */
export const formatPrice = (price, symbol = 'ETH', decimals = 4) => {
  if (!price) return '';
  
  const parsedPrice = typeof price === 'string' ? parseFloat(price) : price;
  
  if (isNaN(parsedPrice)) return '';
  
  // Format based on magnitude
  if (parsedPrice < 0.0001) {
    return `<0.0001 ${symbol}`;
  }
  
  return `${formatNumber(parsedPrice, decimals)} ${symbol}`;
};

/**
 * Truncates a string with ellipsis if it exceeds maxLength
 * @param {string} str - String to truncate
 * @param {number} maxLength - Maximum length before truncation
 * @returns {string} Truncated string
 */
export const truncateString = (str, maxLength = 100) => {
  if (!str || str.length <= maxLength) return str;
  return `${str.substring(0, maxLength)}...`;
};

/**
 * Format ETH value to readable format with selected precision
 * @param {number|string} value - The ETH value
 * @param {number} precision - Decimal precision to display
 * @returns {string} Formatted ETH value
 */
export const formatEth = (value, precision = 4) => {
  if (!value) return '0 ETH';
  
  const num = parseFloat(value);
  if (isNaN(num)) return '0 ETH';
  
  return `${num.toFixed(precision)} ETH`;
}; 