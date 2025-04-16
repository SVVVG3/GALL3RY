// Image proxy API for handling cross-origin issues with NFT images
// This endpoint takes a URL parameter and returns the image content with proper headers
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');

// List of IPFS gateways to try in sequence for IPFS URLs
const IPFS_GATEWAYS = [
  'https://ipfs.io/ipfs/',
  'https://cloudflare-ipfs.com/ipfs/',
  'https://gateway.pinata.cloud/ipfs/',
  'https://dweb.link/ipfs/',
  'https://ipfs.filebase.io/ipfs/'
];

// Path to a placeholder image to use as fallback
const PLACEHOLDER_PATH = path.join(__dirname, '../public/assets/placeholder-nft.png');

/**
 * Try to fetch from multiple IPFS gateways
 * @param {string} ipfsHash - The IPFS hash/path
 * @returns {Promise<Response>} - The successful response or the last error
 */
async function tryMultipleGateways(ipfsHash) {
  let lastError;
  
  // Clean the IPFS hash by removing any gateway prefix
  if (ipfsHash.startsWith('https://ipfs.io/ipfs/')) {
    ipfsHash = ipfsHash.replace('https://ipfs.io/ipfs/', '');
  } else if (ipfsHash.startsWith('ipfs://')) {
    ipfsHash = ipfsHash.replace('ipfs://', '');
  }

  console.log(`Trying multiple gateways for IPFS hash: ${ipfsHash}`);
  
  // Try each gateway
  for (const gateway of IPFS_GATEWAYS) {
    const url = `${gateway}${ipfsHash}`;
    try {
      console.log(`Trying IPFS gateway: ${url}`);
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': '*/*',
          'Referer': 'https://gallery.xyz/'
        },
        timeout: 5000 // 5 second timeout per gateway
      });
      
      if (response.ok) {
        console.log(`Successfully fetched from gateway: ${gateway}`);
        return response;
      }
      
      console.log(`Gateway ${gateway} failed with status: ${response.status}`);
      lastError = response;
    } catch (error) {
      console.log(`Gateway ${gateway} error: ${error.message}`);
      lastError = error;
    }
  }
  
  // If all gateways fail, throw the last error
  throw new Error(`All IPFS gateways failed. Last error: ${lastError}`);
}

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
      return res.sendFile(PLACEHOLDER_PATH);
    }
    
    // If the file doesn't exist, send a transparent pixel
    const transparentPixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
    
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    return res.status(200).send(transparentPixel);
  } catch (error) {
    console.error('Error returning placeholder:', error);
    
    // Last resort - send a small transparent PNG directly
    const transparentPixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
    
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).send(transparentPixel);
  }
}

/**
 * Handle request for image proxy
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function handleImageProxy(req, res) {
  try {
    // Get the URL from the query parameter
    const url = req.query.url;
    
    if (!url) {
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
    
    let response;
    
    // Special handling for IPFS URLs
    if (url.includes('ipfs.io/ipfs/') || url.startsWith('ipfs://')) {
      try {
        response = await tryMultipleGateways(url);
      } catch (error) {
        console.error('IPFS gateway error:', error.message);
        return returnPlaceholder(res);
      }
    } else {
      // For non-IPFS URLs, use normal fetch with timeout
      try {
        response = await fetch(url, {
          headers: {
            // Send a realistic user agent to avoid being blocked
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'image/*',
            'Referer': 'https://gallery.xyz/'
          },
          timeout: 10000 // 10 second timeout
        });
      } catch (error) {
        console.error('Fetch error:', error.message);
        return returnPlaceholder(res);
      }
    }
    
    if (!response.ok) {
      console.error(`Error fetching image: ${response.status} ${response.statusText}`);
      return returnPlaceholder(res);
    }
    
    // Get content type and body
    const contentType = response.headers.get('content-type');
    
    try {
      const buffer = await response.buffer();
      
      // Check if the response is actually an image
      if (!contentType || !contentType.includes('image')) {
        console.warn(`Response is not an image: ${contentType}`);
        return returnPlaceholder(res);
      }
      
      if (buffer.length === 0) {
        console.warn('Empty response buffer');
        return returnPlaceholder(res);
      }
      
      // Set proper cache headers
      res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
      res.setHeader('Content-Type', contentType || 'image/png');
      
      // Add CORS headers
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      
      // Send the image data
      return res.send(buffer);
    } catch (error) {
      console.error('Error processing response:', error);
      return returnPlaceholder(res);
    }
  } catch (error) {
    console.error('Image proxy error:', error);
    return returnPlaceholder(res);
  }
}

module.exports = handleImageProxy; 