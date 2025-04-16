/**
 * Image proxy API endpoint for NFT images
 * 
 * This allows us to bypass CORS restrictions when loading images
 * from various NFT sources including Alchemy, IPFS, etc.
 */

import axios from 'axios';

export default async function handler(req, res) {
  // Set CORS headers to allow cross-origin requests - make sure these are comprehensive
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  
  // Handle OPTIONS preflight requests immediately
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  // Get image URL from query parameter
  const { url } = req.query;
  
  if (!url) {
    console.error('Missing URL parameter');
    return res.status(400).json({ error: 'Missing url parameter' });
  }
  
  try {
    // Always decode the URL to handle any encoded characters
    let proxyUrl = decodeURIComponent(url);
    
    console.log(`Image proxy request for: ${proxyUrl}`);
    
    // Default headers for most requests
    let customHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };
    
    // Handle IPFS URLs first as they're most problematic
    if (proxyUrl.startsWith('ipfs://')) {
      const ipfsHash = proxyUrl.replace('ipfs://', '');
      proxyUrl = `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`;
      console.log(`Converted IPFS URL: ${proxyUrl}`);
    } 
    else if (proxyUrl.includes('/ipfs/')) {
      // Extract IPFS path from URL
      let ipfsPath = '';
      try {
        ipfsPath = proxyUrl.split('/ipfs/')[1];
        // Use Cloudflare IPFS gateway which tends to be more reliable
        proxyUrl = `https://cloudflare-ipfs.com/ipfs/${ipfsPath}`;
        console.log(`Using Cloudflare IPFS: ${proxyUrl}`);
      } catch (error) {
        console.error('Failed to extract IPFS path:', error);
        // Continue with original URL if extraction fails
      }
    }
    
    // Handle Alchemy CDN URLs specifically
    if (proxyUrl.includes('nft-cdn.alchemy.com')) {
      // Add Alchemy specific headers
      customHeaders = {
        ...customHeaders,
        'Referer': 'https://alchemy.com/'
      };
      
      // Ensure correctly formatted URL for Alchemy CDN
      if (!proxyUrl.includes('original.') && !proxyUrl.includes('?')) {
        proxyUrl = `${proxyUrl}/original.jpg`;
        console.log(`Formatted Alchemy URL: ${proxyUrl}`);
      }
    }
    
    // Special handling for OpenSea's seadn.io URLs
    if (proxyUrl.includes('i.seadn.io')) {
      // Add OpenSea specific headers
      customHeaders = {
        ...customHeaders,
        'Origin': 'https://opensea.io',
        'Referer': 'https://opensea.io/'
      };
      
      // Remove width parameter that can cause issues
      if (proxyUrl.includes('w=')) {
        proxyUrl = proxyUrl.replace(/w=\d+(&|$)/, '');
        console.log(`Cleaned OpenSea URL: ${proxyUrl}`);
      }
    }
    
    // Special handling for Arweave URLs
    if (proxyUrl.startsWith('ar://')) {
      proxyUrl = proxyUrl.replace('ar://', 'https://arweave.net/');
      console.log(`Converted Arweave URL: ${proxyUrl}`);
    }
    
    // Handle HTTP URLs - ensure they are HTTPS
    if (proxyUrl.startsWith('http://')) {
      proxyUrl = proxyUrl.replace('http://', 'https://');
      console.log(`Converted HTTP to HTTPS: ${proxyUrl}`);
    }
    
    console.log(`Fetching image from: ${proxyUrl}`);
    
    try {
      // Set a timeout for the request to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      // Implement retry logic
      let retryCount = 0;
      const maxRetries = 2;
      let lastError = null;
      
      while (retryCount <= maxRetries) {
        try {
          if (retryCount > 0) {
            console.log(`Retry ${retryCount}/${maxRetries} for ${proxyUrl}`);
          }
          
          // Fetch the image
          const response = await axios({
            method: 'get',
            url: proxyUrl,
            responseType: 'arraybuffer',
            timeout: 10000, // 10 second timeout
            headers: customHeaders,
            validateStatus: null, // Allow any status code
            maxContentLength: 10 * 1024 * 1024, // 10MB max size
            maxRedirects: 5,
            signal: controller.signal
          });
          
          // Clear the timeout
          clearTimeout(timeoutId);
          
          // Handle error responses
          if (!response || response.status >= 400) {
            console.error(`Error status ${response?.status || 'unknown'} for: ${proxyUrl}`);
            lastError = new Error(`HTTP ${response?.status || 'unknown'}`);
            retryCount++;
            
            // Wait before retrying with exponential backoff
            if (retryCount <= maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)));
              continue;
            } else {
              throw lastError;
            }
          }
          
          // Set the content type header
          const contentType = response.headers['content-type'];
          if (contentType) {
            res.setHeader('Content-Type', contentType);
          } else {
            // Try to guess content type from URL
            if (proxyUrl.match(/\.(jpg|jpeg)$/i)) res.setHeader('Content-Type', 'image/jpeg');
            else if (proxyUrl.match(/\.png$/i)) res.setHeader('Content-Type', 'image/png');
            else if (proxyUrl.match(/\.gif$/i)) res.setHeader('Content-Type', 'image/gif');
            else if (proxyUrl.match(/\.svg$/i)) res.setHeader('Content-Type', 'image/svg+xml');
            else if (proxyUrl.match(/\.webp$/i)) res.setHeader('Content-Type', 'image/webp');
            else res.setHeader('Content-Type', 'image/jpeg'); // Default to jpeg as a fallback
          }
          
          // Set cache headers
          res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
          
          // Return the image data
          return res.status(200).send(response.data);
        } catch (requestError) {
          console.error(`Error on attempt ${retryCount+1} for ${proxyUrl}:`, requestError.message);
          lastError = requestError;
          retryCount++;
          
          // Wait before retrying
          if (retryCount <= maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)));
          }
        }
      }
      
      // If we get here, all retries failed
      throw lastError || new Error('Failed after all retries');
    } catch (fetchError) {
      console.error(`All attempts failed for ${proxyUrl}:`, fetchError.message);
      
      // Return a placeholder SVG image
      const errorMsg = fetchError.message ? fetchError.message.substring(0, 30) : 'Unknown error';
      const placeholderSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
        <rect width="200" height="200" fill="#f0f0f0"/>
        <text x="50%" y="50%" font-family="Arial" font-size="14" text-anchor="middle" fill="#888">Image unavailable</text>
        <text x="50%" y="70%" font-family="Arial" font-size="10" text-anchor="middle" fill="#888">${errorMsg}</text>
      </svg>`);
      
      // Make sure these headers are set correctly
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.status(200).send(placeholderSvg);
    }
  } catch (error) {
    console.error(`Global error in image proxy:`, error.message);
    
    // Return a placeholder SVG image with error details
    const errorMessage = error.message ? error.message.substring(0, 30) : 'Unknown error';
    const placeholderSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
      <rect width="200" height="200" fill="#f0f0f0"/>
      <text x="50%" y="50%" font-family="Arial" font-size="14" text-anchor="middle" fill="#888">Image error</text>
      <text x="50%" y="70%" font-family="Arial" font-size="10" text-anchor="middle" fill="#888">${errorMessage}</text>
    </svg>`);
    
    // Ensure proper headers even in error cases
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    return res.status(200).send(placeholderSvg);
  }
} 