/**
 * Image proxy API endpoint for NFT images
 * 
 * This allows us to bypass CORS restrictions when loading images
 * from various NFT sources including Alchemy, IPFS, etc.
 */

import axios from 'axios';

// Add Vercel-specific configuration
export const config = {
  api: {
    // Disable the default body parser
    bodyParser: false,
    // Disable response size limits
    responseLimit: false,
  },
};

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
    return res.status(200).json({ error: 'Missing url parameter' });
  }
  
  try {
    // Always decode the URL to handle any encoded characters
    let proxyUrl = decodeURIComponent(url);
    
    console.log(`Image proxy request for: ${proxyUrl}`);
    
    // Check if the URL is too long or malformed
    if (proxyUrl.length > 2000) {
      console.error('URL too long');
      return returnPlaceholder(res, 'URL too long');
    }
    
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
        // Return a placeholder instead of continuing with original URL
        return returnPlaceholder(res, 'Invalid IPFS path');
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
      // Set a strict timeout for the request to prevent hanging on Vercel
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout for Vercel
      
      // Simpler approach with fewer retries for Vercel
      try {
        // Fetch the image
        const response = await axios({
          method: 'get',
          url: proxyUrl,
          responseType: 'arraybuffer',
          timeout: 4500, // 4.5 second timeout (shorter than the controller timeout)
          headers: customHeaders,
          validateStatus: null, // Allow any status code
          maxContentLength: 3 * 1024 * 1024, // 3MB max size for Vercel
          maxRedirects: 3,
          signal: controller.signal
        });
        
        // Clear the timeout
        clearTimeout(timeoutId);
        
        // Handle error responses
        if (!response || response.status >= 400) {
          console.error(`Error status ${response?.status || 'unknown'} for: ${proxyUrl}`);
          return returnPlaceholder(res, `HTTP ${response?.status || 'unknown'}`);
        }
        
        // Check if the response is very small (likely an error page)
        if (response.data.length < 100) {
          console.error(`Response too small (${response.data.length} bytes)`);
          return returnPlaceholder(res, 'Response too small');
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
        console.error(`Error fetching image: ${requestError.message}`);
        clearTimeout(timeoutId);
        return returnPlaceholder(res, requestError.message.substring(0, 30));
      }
    } catch (fetchError) {
      console.error(`All attempts failed for ${proxyUrl}:`, fetchError.message);
      // Return a placeholder for any error
      return returnPlaceholder(res, fetchError.message.substring(0, 30));
    }
  } catch (error) {
    console.error(`Global error in image proxy:`, error.message);
    // Return a placeholder for any error
    return returnPlaceholder(res, error.message.substring(0, 30));
  }
}

// Helper function to return a placeholder image
function returnPlaceholder(res, errorMessage = 'Image unavailable') {
  const placeholderSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
    <rect width="200" height="200" fill="#f0f0f0"/>
    <text x="50%" y="50%" font-family="Arial" font-size="14" text-anchor="middle" fill="#888">Image unavailable</text>
    <text x="50%" y="70%" font-family="Arial" font-size="10" text-anchor="middle" fill="#888">${errorMessage}</text>
  </svg>`);
  
  // Ensure proper headers
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  return res.status(200).send(placeholderSvg);
} 