// Image proxy API for handling cross-origin issues with NFT images
// This endpoint takes a URL parameter and returns the image content with proper headers
const fetch = require('node-fetch');

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
      return res.status(400).send('Missing URL parameter');
    }
    
    console.log(`Image proxy request for: ${url}`);
    
    // Validate the URL to prevent abuse
    try {
      new URL(url); // This will throw if URL is invalid
    } catch (e) {
      return res.status(400).send('Invalid URL format');
    }
    
    // Add security check to prevent proxying of internal resources
    if (url.includes('localhost') || url.includes('127.0.0.1')) {
      return res.status(403).send('Cannot proxy local resources');
    }
    
    // Fetch the image
    const response = await fetch(url, {
      headers: {
        // Send a realistic user agent to avoid being blocked
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'image/*',
        'Referer': 'https://gallery.xyz/'
      },
      timeout: 10000 // 10 second timeout
    });
    
    if (!response.ok) {
      console.error(`Error fetching image: ${response.status} ${response.statusText}`);
      return res.status(response.status).send(response.statusText);
    }
    
    // Get content type and body
    const contentType = response.headers.get('content-type');
    const buffer = await response.buffer();
    
    // Check if the response is actually an image
    if (!contentType || !contentType.includes('image')) {
      console.warn(`Response is not an image: ${contentType}`);
      // Still proceed, as sometimes content types are misreported
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
    console.error('Image proxy error:', error);
    
    // Return a placeholder image in case of error
    return res.status(500).send('Error proxying image');
  }
}

module.exports = handleImageProxy; 