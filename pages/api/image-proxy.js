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
    return returnPlaceholder(res, 'Missing URL parameter');
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
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };
    
    // Handle different URL types - prioritize Alchemy CDN URLs
    
    // Special handling for Alchemy CDN URLs
    if (proxyUrl.includes('nft-cdn.alchemy.com') || proxyUrl.includes('alchemyapi.io')) {
      console.log('Detected Alchemy CDN URL, adding special headers and API key');
      
      // Add Alchemy API key to the URL if not already present
      if (!proxyUrl.includes('apiKey=') && !proxyUrl.includes('api_key=')) {
        const alchemyApiKey = process.env.ALCHEMY_API_KEY || process.env.REACT_APP_ALCHEMY_API_KEY;
        if (alchemyApiKey) {
          const separator = proxyUrl.includes('?') ? '&' : '?';
          proxyUrl = `${proxyUrl}${separator}apiKey=${alchemyApiKey}`;
          console.log('Added API key to Alchemy URL');
        } else {
          console.warn('No Alchemy API key found in environment variables');
        }
      }
      
      // Use specific headers for Alchemy CDN that worked in testing
      customHeaders = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Encoding': 'gzip, deflate, br',
        'Origin': 'https://dashboard.alchemy.com',
        'Referer': 'https://dashboard.alchemy.com/',
        'Sec-Fetch-Dest': 'image',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'same-site',
        'If-None-Match': '', // Clear any conditional requests
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      };
      
      // For some Alchemy CDN URLs, we might need to fix the path format
      if (!proxyUrl.includes('/original') && !proxyUrl.includes('/thumb') && 
          !proxyUrl.includes('.jpg') && !proxyUrl.includes('.png') && 
          !proxyUrl.includes('.gif') && !proxyUrl.includes('.webp') &&
          !proxyUrl.includes('.mp4')) {
        proxyUrl = `${proxyUrl}/original`;
        console.log(`Fixed Alchemy URL format: ${proxyUrl}`);
      }
    }
    
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
    
    // Implement retry logic for failed requests
    const fetchWithRetries = async (url, headers, maxRetries = 2) => {
      let lastError;
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          // Set a strict timeout for the request to prevent hanging on Vercel
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout for Vercel
          
          // Fetch the image
          const response = await axios({
            method: 'get',
            url: url,
            responseType: 'arraybuffer',
            timeout: 7000, // 7 second timeout (shorter than the controller timeout)
            headers: headers,
            validateStatus: null, // Allow any status code
            maxContentLength: 10 * 1024 * 1024, // 10MB max size
            maxRedirects: 5, // Increased redirect limit
            signal: controller.signal
          });
          
          // Clear the timeout
          clearTimeout(timeoutId);
          
          // If we got a successful response, return it
          if (response.status < 400) {
            return response;
          }
          
          // If we got a 403 Forbidden specifically from Alchemy CDN
          if ((response.status === 403 || response.status === 401) && 
              (url.includes('nft-cdn.alchemy.com') || url.includes('alchemyapi.io'))) {
            console.log(`Attempt ${attempt + 1}: Got ${response.status} from Alchemy CDN, trying with different headers`);
            
            // Modify headers for next attempt
            headers = {
              ...headers,
              'Referer': 'https://dashboard.alchemy.com/',
              'Origin': 'https://dashboard.alchemy.com',
              'Accept': '*/*'
            };
            
            // Add API key directly to URL as a different parameter format
            if (!url.includes('api_key=') && !url.includes('apiKey=')) {
              const alchemyApiKey = process.env.ALCHEMY_API_KEY || process.env.REACT_APP_ALCHEMY_API_KEY;
              if (alchemyApiKey) {
                const separator = url.includes('?') ? '&' : '?';
                url = `${url}${separator}api_key=${alchemyApiKey}`;
                console.log('Added API key in alternate format');
              }
            }
            
            // Wait briefly before retry
            await new Promise(resolve => setTimeout(resolve, 300));
            continue;
          }
          
          // For other error status codes, log and continue to next attempt
          console.error(`Attempt ${attempt + 1}: Error status ${response.status} for: ${url}`);
          lastError = response;
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
          console.error(`Network error on attempt ${attempt + 1}: ${error.message}`);
          if (timeoutId) clearTimeout(timeoutId);
          lastError = error;
          
          // Wait before retry
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
      
      // If we got here, all attempts failed
      throw lastError || new Error('All retry attempts failed');
    };
    
    // Use our retry logic to fetch the image
    let response;
    try {
      response = await fetchWithRetries(proxyUrl, customHeaders);
    } catch (fetchError) {
      console.error(`All attempts failed for ${proxyUrl}:`, fetchError.message);
      return returnPlaceholder(res, fetchError.message.substring(0, 30));
    }
    
    // Handle error responses after all retries
    if (!response || response.status >= 400) {
      console.error(`Error status ${response?.status || 'unknown'} for: ${proxyUrl}`);
      return returnPlaceholder(res, `HTTP ${response?.status || 'unknown'}`);
    }
    
    // Check if the response is very small (likely an error page)
    if (response.data && response.data.length < 100) {
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
      else if (proxyUrl.match(/\.mp4$/i)) res.setHeader('Content-Type', 'video/mp4');
      else if (proxyUrl.match(/\.webm$/i)) res.setHeader('Content-Type', 'video/webm');
      else res.setHeader('Content-Type', 'image/jpeg'); // Default to jpeg as a fallback
    }
    
    // Set cache headers
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
    
    // Return the image data
    return res.status(200).send(response.data);
  } catch (error) {
    console.error(`Global error in image proxy:`, error.message);
    if (error.code) console.error(`Error code: ${error.code}`);
    if (error.response) {
      console.error(`Error response status: ${error.response.status}`);
      console.error(`Error response headers:`, error.response.headers);
    }
    
    // Return a placeholder for any error
    return returnPlaceholder(res, error.message.substring(0, 30));
  }
}

// Helper function to return a placeholder image
function returnPlaceholder(res, errorMessage = 'Image unavailable') {
  const placeholderSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
    <rect width="400" height="400" fill="#f0f0f0"/>
    <text x="50%" y="50%" font-family="Arial" font-size="16" text-anchor="middle" fill="#888">Image unavailable</text>
    <text x="50%" y="60%" font-family="Arial" font-size="12" text-anchor="middle" fill="#888">${errorMessage}</text>
  </svg>`);
  
  // Ensure proper headers
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  return res.status(200).send(placeholderSvg);
} 