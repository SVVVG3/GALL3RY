// Image proxy API for handling cross-origin issues with NFT images
// This endpoint takes a URL parameter and returns the image content with proper headers
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

// List of IPFS gateways to try in sequence for IPFS URLs
const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://gateway.ipfs.io/ipfs/',
  'https://dweb.link/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.filebase.io/ipfs/'
];

// Path to a placeholder image to use as fallback
const PLACEHOLDER_PATH = path.join(__dirname, '../public/assets/placeholder-nft.png');

/**
 * Return a static placeholder image
 * @param {Object} res - Express response object
 * @param {string} errorMessage - Optional error message to embed in SVG
 */
function returnPlaceholder(res, errorMessage = 'Image unavailable') {
  try {
    // Try to send the placeholder file if it exists
    if (fs.existsSync(PLACEHOLDER_PATH)) {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.sendFile(PLACEHOLDER_PATH);
    }
    
    // If the file doesn't exist, generate a simple SVG placeholder
    const placeholderSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
      <rect width="200" height="200" fill="#f0f0f0"/>
      <text x="50%" y="50%" font-family="Arial" font-size="12" text-anchor="middle" fill="#888">Image unavailable</text>
      <text x="50%" y="65%" font-family="Arial" font-size="10" text-anchor="middle" fill="#888">${errorMessage}</text>
    </svg>`);
    
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    return res.status(200).send(placeholderSvg);
  } catch (error) {
    console.error('Error returning placeholder:', error);
    
    // Last resort - generate an SVG directly
    const transparentSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
      <rect width="200" height="200" fill="#f5f5f5"/>
      <text x="50%" y="50%" font-family="Arial" font-size="12" text-anchor="middle" fill="#888">Image Error</text>
      <text x="50%" y="65%" font-family="Arial" font-size="10" text-anchor="middle" fill="#888">${errorMessage}</text>
    </svg>`);
    
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).send(transparentSvg);
  }
}

/**
 * Fetch with retries for more robust image fetching
 * @param {string} url - The URL to fetch
 * @param {Object} options - Axios request options
 * @param {number} maxRetries - Maximum number of retry attempts
 * @returns {Promise<Object>} - Axios response
 */
async function fetchWithRetry(url, options, maxRetries = 2) {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt + 1}/${maxRetries + 1} fetching: ${url}`);
      
      // Add a small delay between retries
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, attempt * 500));
      }
      
      const response = await axios.get(url, options);
      return response;
    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed:`, error.message);
      lastError = error;
      
      // If we have a response with a status code, no need to retry certain cases
      if (error.response && (
        error.response.status === 404 || // Not found
        error.response.status === 403    // Forbidden
      )) {
        throw error; // No point retrying these specific errors
      }
    }
  }
  
  // If we got here, all attempts failed
  throw lastError;
}

/**
 * Image proxy endpoint to handle CORS issues with NFT images
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
module.exports = async (req, res) => {
  // Set CORS headers to allow requests from any origin
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  
  // Handle OPTIONS preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Only GET requests are allowed for image proxy'
    });
  }
  
  // Get the image URL from query parameter
  const imageUrl = req.query.url;
  
  // Check if image URL is provided
  if (!imageUrl) {
    return returnPlaceholder(res, 'Missing URL parameter');
  }
  
  try {
    console.log(`Proxying image: ${imageUrl}`);
    
    // Set request headers and options
    const requestOptions = {
      responseType: 'arraybuffer',
      timeout: 10000, // 10 second timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br'
      },
      maxRedirects: 5
    };
    
    // Special handling for IPFS URLs
    let targetUrl = imageUrl;
    if (targetUrl.startsWith('ipfs://')) {
      const ipfsHash = targetUrl.replace('ipfs://', '');
      targetUrl = `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`;
      console.log(`Converted IPFS URL to: ${targetUrl}`);
    }
    
    // Special handling for Alchemy CDN URLs
    if (targetUrl.includes('nft-cdn.alchemy.com')) {
      console.log('Using special headers for Alchemy CDN');
      
      // Add API key to Alchemy requests if not present
      if (!targetUrl.includes('apiKey=')) {
        const alchemyApiKey = process.env.ALCHEMY_API_KEY || process.env.REACT_APP_ALCHEMY_API_KEY;
        if (alchemyApiKey) {
          const separator = targetUrl.includes('?') ? '&' : '?';
          targetUrl = `${targetUrl}${separator}apiKey=${alchemyApiKey}`;
        }
      }
      
      // Use specific headers known to work with Alchemy
      requestOptions.headers = {
        ...requestOptions.headers,
        'Origin': 'https://dashboard.alchemy.com',
        'Referer': 'https://dashboard.alchemy.com/'
      };
    }
    
    // Fetch the image with retry logic
    try {
      const response = await fetchWithRetry(targetUrl, requestOptions);
      
      // Extract content type or default to image/jpeg
      const contentType = response.headers['content-type'] || 'image/jpeg';
      
      // Set caching headers - cache for 1 day
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Content-Type', contentType);
      
      // Send the image data
      return res.status(200).send(response.data);
    } catch (fetchError) {
      console.error(`All fetch attempts failed for ${targetUrl}:`, fetchError.message);
      return returnPlaceholder(res, `Fetch error: ${fetchError.message.substring(0, 30)}`);
    }
    
  } catch (error) {
    console.error(`Global error in image proxy for ${imageUrl}:`, error.message);
    return returnPlaceholder(res, `Error: ${error.message.substring(0, 30)}`);
  }
}; 