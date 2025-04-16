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
 */
function returnPlaceholder(res) {
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
    </svg>`);
    
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).send(transparentSvg);
  }
}

/**
 * Handle request for image proxy
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function handleImageProxy(req, res) {
  // Set CORS headers early
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // Get the URL from the query parameter
    const url = req.query.url;
    
    if (!url) {
      console.error('No URL parameter provided');
      return returnPlaceholder(res);
    }
    
    console.log(`Image proxy request for: ${url}`);
    
    // Validate the URL to prevent abuse
    try {
      new URL(url); // This will throw if URL is invalid
    } catch (e) {
      console.error('Invalid URL format:', url);
      return returnPlaceholder(res);
    }
    
    // Add security check to prevent proxying of internal resources
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
      console.error('Blocked request to local resource:', url);
      return returnPlaceholder(res);
    }
    
    // Determine which method to use for fetching
    let proxyUrl = url;
    let customHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
      'Referer': 'https://gall3ry.vercel.app/',
      'Accept': 'image/*,*/*;q=0.8'
    };
    
    // Handle special URLs
    
    // Handle IPFS URLs
    if (proxyUrl.startsWith('ipfs://')) {
      const ipfsHash = proxyUrl.replace('ipfs://', '');
      proxyUrl = `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`;
      console.log(`Converted IPFS URL: ${url} -> ${proxyUrl}`);
    }
    
    // Handle Arweave URLs
    if (proxyUrl.startsWith('ar://')) {
      proxyUrl = proxyUrl.replace('ar://', 'https://arweave.net/');
      console.log(`Converted Arweave URL: ${url} -> ${proxyUrl}`);
    }
    
    // Handle HTTP URLs to ensure they're HTTPS
    if (proxyUrl.startsWith('http://')) {
      proxyUrl = proxyUrl.replace('http://', 'https://');
      console.log(`Converted HTTP to HTTPS: ${url} -> ${proxyUrl}`);
    }
    
    console.log(`Attempting to fetch: ${proxyUrl}`);
    
    // Try to fetch the image with axios instead of fetch
    let response;
    try {
      response = await axios({
        method: 'get',
        url: proxyUrl,
        responseType: 'arraybuffer',
        timeout: 10000, // 10 second timeout
        headers: customHeaders,
        // Don't throw on non-200 status codes
        validateStatus: () => true
      });
    } catch (error) {
      console.error(`Axios error for ${proxyUrl}:`, error.message);
      return returnPlaceholder(res);
    }
    
    // Check the status code
    if (response.status >= 400) {
      console.error(`Error status ${response.status} from ${proxyUrl}`);
      return returnPlaceholder(res);
    }
    
    // Get content type
    let contentType = response.headers['content-type'];
    
    // If no content type, try to infer from URL or data
    if (!contentType || !contentType.includes('image')) {
      if (proxyUrl.match(/\.jpg$|\.jpeg$/i)) contentType = 'image/jpeg';
      else if (proxyUrl.match(/\.png$/i)) contentType = 'image/png';
      else if (proxyUrl.match(/\.gif$/i)) contentType = 'image/gif';
      else if (proxyUrl.match(/\.svg$/i)) contentType = 'image/svg+xml';
      else if (proxyUrl.match(/\.webp$/i)) contentType = 'image/webp';
      else {
        console.warn(`Response from ${proxyUrl} does not have image content type`);
        // Check if the response looks like an image anyway
        if (response.data && response.data.length > 0) {
          // Try to detect from content
          const buffer = Buffer.from(response.data);
          if (buffer.length > 4) {
            const header = buffer.slice(0, 4);
            if (Buffer.compare(header, Buffer.from([0x89, 0x50, 0x4E, 0x47])) === 0) {
              contentType = 'image/png';
            } else if (Buffer.compare(header.slice(0, 2), Buffer.from([0xFF, 0xD8])) === 0) {
              contentType = 'image/jpeg';
            } else if (Buffer.compare(header.slice(0, 3), Buffer.from([0x47, 0x49, 0x46])) === 0) {
              contentType = 'image/gif';
            } else {
              // Default to octet-stream if we can't detect
              contentType = 'application/octet-stream';
            }
          }
        } else {
          console.error('Empty or invalid response data');
          return returnPlaceholder(res);
        }
      }
    }
    
    // Set response headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Send the data
    return res.send(response.data);
  } catch (error) {
    console.error('Image proxy error:', error.message);
    return returnPlaceholder(res);
  }
}

module.exports = handleImageProxy; 