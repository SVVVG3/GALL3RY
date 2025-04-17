/**
 * Improved Image Proxy API for NFT images
 * 
 * This version has enhanced error handling and better CORS support
 * for various NFT image providers including Alchemy, IPFS, etc.
 */

import axios from 'axios';

// Vercel-specific configuration
export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};

// Helper function to generate a placeholder SVG
function generatePlaceholderSvg(errorMessage = 'Image unavailable') {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
    <rect width="400" height="400" fill="#f0f0f0"/>
    <text x="50%" y="50%" font-family="Arial" font-size="16" text-anchor="middle" fill="#888">Image unavailable</text>
    <text x="50%" y="65%" font-family="Arial" font-size="12" text-anchor="middle" fill="#888">${errorMessage}</text>
  </svg>`);
}

export default async function handler(req, res) {
  // Set comprehensive CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    console.error('Method not allowed:', req.method);
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.status(200).send(generatePlaceholderSvg('Method not allowed'));
  }
  
  // Get and validate the URL parameter
  let { url } = req.query;
  
  if (!url) {
    console.error('Missing URL parameter');
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.status(200).send(generatePlaceholderSvg('Missing URL parameter'));
  }

  try {
    // Decode the URL
    let targetUrl = decodeURIComponent(url);
    console.log(`Image proxy request for: ${targetUrl}`);
    
    // Prepare default headers
    let headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': '*/*',
      'Accept-Encoding': 'gzip, deflate, br'
    };
    
    // Process different URL types
    
    // 1. Handle IPFS URLs
    if (targetUrl.startsWith('ipfs://')) {
      const ipfsHash = targetUrl.replace('ipfs://', '');
      targetUrl = `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`;
      console.log(`Converted IPFS URL: ${targetUrl}`);
    } 
    else if (targetUrl.includes('/ipfs/')) {
      try {
        const ipfsPath = targetUrl.split('/ipfs/')[1];
        targetUrl = `https://cloudflare-ipfs.com/ipfs/${ipfsPath}`;
        console.log(`Using Cloudflare IPFS: ${targetUrl}`);
      } catch (error) {
        console.error('Failed to process IPFS path:', error);
        res.setHeader('Content-Type', 'image/svg+xml');
        return res.status(200).send(generatePlaceholderSvg('Invalid IPFS path'));
      }
    }
    
    // 2. Handle Arweave URLs
    if (targetUrl.startsWith('ar://')) {
      targetUrl = targetUrl.replace('ar://', 'https://arweave.net/');
      console.log(`Converted Arweave URL: ${targetUrl}`);
    }
    
    // 3. Handle HTTP URLs - ensure they are HTTPS
    if (targetUrl.startsWith('http://')) {
      targetUrl = targetUrl.replace('http://', 'https://');
      console.log(`Converted HTTP to HTTPS: ${targetUrl}`);
    }
    
    // 4. Special handling for domain-specific cases
    
    // Alchemy CDN URLs
    if (targetUrl.includes('nft-cdn.alchemy.com') || targetUrl.includes('alchemyapi.io')) {
      headers = {
        ...headers,
        'Origin': 'https://dashboard.alchemy.com',
        'Referer': 'https://dashboard.alchemy.com/',
      };
      
      // Add API key if not present
      if (!targetUrl.includes('apiKey=') && !targetUrl.includes('api_key=')) {
        const alchemyApiKey = process.env.ALCHEMY_API_KEY || '';
        if (alchemyApiKey) {
          const separator = targetUrl.includes('?') ? '&' : '?';
          targetUrl = `${targetUrl}${separator}apiKey=${alchemyApiKey}`;
          console.log('Added API key to Alchemy URL');
        }
      }
      
      // Fix format for Alchemy URLs if needed
      if (!targetUrl.includes('/original') && !targetUrl.includes('/thumb') && 
          !targetUrl.includes('.jpg') && !targetUrl.includes('.png') && 
          !targetUrl.includes('.gif') && !targetUrl.includes('.webp') &&
          !targetUrl.includes('.mp4') && !targetUrl.includes('?')) {
        targetUrl = `${targetUrl}/original`;
        console.log(`Added format to Alchemy URL: ${targetUrl}`);
      }
    }
    
    // OpenSea (seadn.io) URLs
    if (targetUrl.includes('i.seadn.io')) {
      headers = {
        ...headers,
        'Origin': 'https://opensea.io',
        'Referer': 'https://opensea.io/'
      };
    }
    
    // Special handling for apeokx.one which had CORS issues in your logs
    if (targetUrl.includes('apeokx.one')) {
      headers = {
        ...headers,
        'Origin': null,
        'Referer': null
      };
      
      // Try alternative URL structure if possible
      // This is an example - you may need to adjust based on the exact domain requirements
      if (targetUrl.includes('/imagescoolgirl/')) {
        console.log('Using alternate URL for apeokx domain');
        // Create fallback options for this domain
        targetUrl = targetUrl.replace('www.apeokx.one', 'apeokx.one');
      }
    }
    
    console.log(`Fetching from: ${targetUrl}`);
    
    try {
      // Make the request with a reasonable timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      const response = await axios({
        method: 'get',
        url: targetUrl,
        responseType: 'arraybuffer',
        timeout: 7500,
        headers: headers,
        maxContentLength: 10 * 1024 * 1024, // 10MB limit
        maxRedirects: 5,
        validateStatus: null, // Allow any status code
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // Handle error responses
      if (!response || response.status >= 400) {
        console.error(`Error fetching image: HTTP ${response?.status || 'unknown'}`);
        res.setHeader('Content-Type', 'image/svg+xml');
        return res.status(200).send(generatePlaceholderSvg(`Error: ${response?.status || 'unknown'}`));
      }
      
      // Check for valid response data
      if (!response.data || response.data.length < 50) {
        console.error(`Response too small or empty: ${response.data?.length || 0} bytes`);
        res.setHeader('Content-Type', 'image/svg+xml');
        return res.status(200).send(generatePlaceholderSvg('Response too small'));
      }
      
      // Set the content type based on the response or URL
      let contentType = response.headers['content-type'];
      
      if (!contentType || contentType.includes('text/plain')) {
        // Try to guess from URL if content-type isn't set or is generic
        if (targetUrl.match(/\.(jpg|jpeg)$/i)) contentType = 'image/jpeg';
        else if (targetUrl.match(/\.png$/i)) contentType = 'image/png';
        else if (targetUrl.match(/\.gif$/i)) contentType = 'image/gif';
        else if (targetUrl.match(/\.svg$/i)) contentType = 'image/svg+xml';
        else if (targetUrl.match(/\.webp$/i)) contentType = 'image/webp';
        else if (targetUrl.match(/\.mp4$/i)) contentType = 'video/mp4';
        else if (targetUrl.match(/\.webm$/i)) contentType = 'video/webm';
        else contentType = 'image/jpeg'; // Default fallback
      }
      
      // Set response headers
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      // Return the image data
      return res.status(200).send(response.data);
      
    } catch (requestError) {
      console.error(`Error fetching image: ${requestError.message}`);
      if (requestError.code) console.error(`Error code: ${requestError.code}`);
      
      // Always return an SVG placeholder rather than an error status
      res.setHeader('Content-Type', 'image/svg+xml');
      return res.status(200).send(generatePlaceholderSvg(requestError.message.substring(0, 30)));
    }
  } catch (globalError) {
    console.error('Global error in image proxy:', globalError.message);
    
    // Always return an SVG placeholder rather than an error status
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.status(200).send(generatePlaceholderSvg('Server error'));
  }
} 