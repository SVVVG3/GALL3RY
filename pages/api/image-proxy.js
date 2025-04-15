/**
 * Image proxy API endpoint for NFT images
 * 
 * This allows us to bypass CORS restrictions when loading images
 * from various NFT sources including Alchemy, IPFS, etc.
 */

import axios from 'axios';

export default async function handler(req, res) {
  // Set CORS headers to allow cross-origin requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS requests
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
    return res.status(400).json({ error: 'Missing url parameter' });
  }
  
  console.log(`Image proxy request for: ${decodeURIComponent(url)}`);
  
  try {
    // Always decode the URL to handle any encoded characters
    let proxyUrl = decodeURIComponent(url);
    
    // Default headers for most requests
    let customHeaders = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36',
      'Referer': 'https://gall3ry.vercel.app/',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br'
    };
    
    // Special handling for different URL types
    
    // Handle Alchemy CDN URLs specifically
    if (proxyUrl.includes('nft-cdn.alchemy.com')) {
      console.log('Detected Alchemy CDN URL, adding special headers');
      customHeaders = {
        ...customHeaders,
        'Cache-Control': 'no-cache',
        'Origin': 'https://gall3ry.vercel.app'
      };
    }
    
    // Handle OpenSea's seadn.io URLs specifically
    if (proxyUrl.includes('i.seadn.io')) {
      console.log('Detected OpenSea seadn.io URL, adding special headers');
      customHeaders = {
        ...customHeaders,
        'Origin': 'https://opensea.io',
        'Referer': 'https://opensea.io/'
      };
    }
    
    // Special handling for IPFS URLs
    if (proxyUrl.startsWith('ipfs://')) {
      proxyUrl = proxyUrl.replace('ipfs://', 'https://cloudflare-ipfs.com/ipfs/');
      console.log(`Converted IPFS URL: ${url} -> ${proxyUrl}`);
    }
    
    // Handle ipfs links that aren't using the ipfs:// protocol
    if (proxyUrl.includes('/ipfs/')) {
      console.log('Detected standard IPFS gateway URL');
      // Just keep the URL as is, but add special headers
      customHeaders = {
        ...customHeaders,
        'Origin': null
      };
    }
    
    // Special handling for Arweave URLs
    if (proxyUrl.startsWith('ar://')) {
      proxyUrl = proxyUrl.replace('ar://', 'https://arweave.net/');
      console.log(`Converted Arweave URL: ${url} -> ${proxyUrl}`);
    }
    
    // Handle S3 URLs for AWS
    if (proxyUrl.includes('amazonaws.com')) {
      console.log('Detected AWS S3 URL, using direct access');
      customHeaders = {
        ...customHeaders,
        'Origin': null,
        'Referer': null
      };
    }
    
    console.log(`Fetching from final URL: ${proxyUrl}`);
    
    // Fetch the image with retries
    let response;
    let retries = 0;
    const maxRetries = 2;
    
    while (retries <= maxRetries) {
      try {
        console.log(`Fetching image (attempt ${retries + 1}): ${proxyUrl}`);
        
        response = await axios({
          method: 'get',
          url: proxyUrl,
          responseType: 'arraybuffer',
          timeout: 10000, // 10 second timeout
          headers: customHeaders,
          // Allow non-2xx status codes to handle them manually
          validateStatus: null
        });
        
        // If successful, break out of retry loop
        if (response.status >= 200 && response.status < 300) {
          break;
        }
        
        console.log(`Received status ${response.status} from ${proxyUrl}`);
        
        // If this is Alchemy CDN and we got an error, try an alternative URL format
        if (proxyUrl.includes('nft-cdn.alchemy.com') && retries === 0) {
          // Try removing any query parameters that might be causing issues
          const urlWithoutParams = proxyUrl.split('?')[0];
          if (urlWithoutParams !== proxyUrl) {
            console.log(`Retrying with cleaned URL: ${urlWithoutParams}`);
            proxyUrl = urlWithoutParams;
            retries++;
            continue;
          }
        }
        
        // For seadn.io URLs, try removing the w=500 parameter
        if (proxyUrl.includes('i.seadn.io') && proxyUrl.includes('w=')) {
          const cleanedUrl = proxyUrl.replace(/w=\d+(&|$)/, '');
          if (cleanedUrl !== proxyUrl) {
            console.log(`Retrying seadn.io without width parameter: ${cleanedUrl}`);
            proxyUrl = cleanedUrl;
            retries++;
            continue;
          }
        }
        
        retries++;
      } catch (retryError) {
        console.error(`Error on attempt ${retries + 1}:`, retryError.message);
        retries++;
        
        // If we've exhausted retries, propagate the error
        if (retries > maxRetries) {
          throw retryError;
        }
      }
    }
    
    // Check for non-successful status after all retries
    if (!response || response.status >= 400) {
      console.error(`Source returned error status ${response?.status || 'unknown'} for: ${proxyUrl}`);
      
      // Create a simple SVG placeholder instead of returning JSON
      const placeholderSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
        <rect width="200" height="200" fill="#f0f0f0"/>
        <text x="50%" y="50%" font-family="Arial" font-size="12" text-anchor="middle" fill="#888">Image unavailable</text>
      </svg>`);
      
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, max-age=3600'); 
      return res.send(placeholderSvg);
    }
    
    // Set content type from response
    const contentType = response.headers['content-type'];
    if (contentType) {
      res.setHeader('Content-Type', contentType);
    } else {
      // Try to guess content type from URL
      if (proxyUrl.match(/\.(jpg|jpeg)$/i)) res.setHeader('Content-Type', 'image/jpeg');
      else if (proxyUrl.match(/\.png$/i)) res.setHeader('Content-Type', 'image/png');
      else if (proxyUrl.match(/\.gif$/i)) res.setHeader('Content-Type', 'image/gif');
      else if (proxyUrl.match(/\.svg$/i)) res.setHeader('Content-Type', 'image/svg+xml');
      else res.setHeader('Content-Type', 'application/octet-stream');
    }
    
    // Set cache headers for better performance
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    
    // Return the image data
    return res.send(response.data);
  } catch (error) {
    console.error(`Error proxying image (${url}):`, error.message);
    
    // Return a placeholder SVG image instead of JSON
    const placeholderSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
      <rect width="200" height="200" fill="#f0f0f0"/>
      <text x="50%" y="50%" font-family="Arial" font-size="12" text-anchor="middle" fill="#888">Image unavailable</text>
    </svg>`);
    
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=3600'); 
    return res.send(placeholderSvg);
  }
} 