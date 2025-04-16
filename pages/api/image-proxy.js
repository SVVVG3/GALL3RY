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
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };
    
    // Special handling for different URL types
    
    // Handle Alchemy CDN URLs specifically
    if (proxyUrl.includes('nft-cdn.alchemy.com')) {
      console.log('Detected Alchemy CDN URL, adding special headers');
      customHeaders = {
        ...customHeaders,
        'Cache-Control': 'no-cache',
        'Referer': 'https://alchemy.com/'
      };
      
      // Ensure correctly formatted URL for Alchemy CDN
      if (!proxyUrl.includes('original.') && !proxyUrl.includes('?')) {
        proxyUrl = `${proxyUrl}/original.jpg`;
        console.log(`Formatted Alchemy URL: ${proxyUrl}`);
      }
    }
    
    // Handle OpenSea's seadn.io URLs specifically
    if (proxyUrl.includes('i.seadn.io')) {
      console.log('Detected OpenSea seadn.io URL, adding special headers');
      customHeaders = {
        ...customHeaders,
        'Origin': 'https://opensea.io',
        'Referer': 'https://opensea.io/'
      };
      
      // Remove width parameter that might cause issues
      if (proxyUrl.includes('w=')) {
        proxyUrl = proxyUrl.replace(/w=\d+(&|$)/, '');
        console.log(`Cleaned OpenSea URL: ${proxyUrl}`);
      }
    }
    
    // Special handling for IPFS URLs
    if (proxyUrl.startsWith('ipfs://')) {
      // Try multiple gateways instead of just one
      const ipfsHash = proxyUrl.replace('ipfs://', '');
      // Use Cloudflare IPFS gateway which tends to be more reliable
      proxyUrl = `https://cloudflare-ipfs.com/ipfs/${ipfsHash}`;
      console.log(`Converted IPFS URL: ${proxyUrl}`);
    }
    
    // Handle ipfs links that aren't using the ipfs:// protocol
    if (proxyUrl.includes('/ipfs/')) {
      console.log('Detected IPFS gateway URL');
      // Remove unneeded headers for IPFS gateways
      customHeaders = {
        ...customHeaders,
        'Origin': null,
        'Referer': null
      };
      
      // Extract IPFS path from URL
      let ipfsPath = '';
      if (proxyUrl.includes('/ipfs/')) {
        ipfsPath = proxyUrl.split('/ipfs/')[1];
      }
      
      // If we successfully extracted the IPFS path, try with a reliable gateway
      if (ipfsPath) {
        // Use Cloudflare IPFS gateway which tends to be more reliable for our proxy
        proxyUrl = `https://cloudflare-ipfs.com/ipfs/${ipfsPath}`;
        console.log(`Using Cloudflare IPFS: ${proxyUrl}`);
      }
    }
    
    // Special handling for Arweave URLs
    if (proxyUrl.startsWith('ar://')) {
      proxyUrl = proxyUrl.replace('ar://', 'https://arweave.net/');
      console.log(`Converted Arweave URL: ${proxyUrl}`);
    }
    
    // Handle metadata URLs for NFT projects
    if (proxyUrl.includes('metadata.goonzworld.com')) {
      console.log('Detected Goonz metadata URL, adding special handling');
      customHeaders = {
        ...customHeaders,
        'Origin': null,
        'Referer': null,
        'Accept': '*/*'
      };
    }
    
    console.log(`Fetching from final URL: ${proxyUrl}`);
    
    try {
      // Set a timeout for the request to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      // Implement retry logic
      let retryCount = 0;
      const maxRetries = 2;
      let lastError = null;
      
      while (retryCount <= maxRetries) {
        try {
          if (retryCount > 0) {
            console.log(`Retry ${retryCount}/${maxRetries} for ${proxyUrl}`);
          }
          
          // Simpler fetch with improved error handling
          const response = await axios({
            method: 'get',
            url: proxyUrl,
            responseType: 'arraybuffer',
            timeout: 8000, // 8 second timeout (shorter than the controller timeout)
            headers: customHeaders,
            validateStatus: null, // Allow any status code to handle it ourselves
            maxContentLength: 10 * 1024 * 1024, // 10MB max size
            maxRedirects: 5,
            signal: controller.signal
          });
          
          // Clear the abort controller timeout
          clearTimeout(timeoutId);
          
          // Handle errors more gracefully
          if (!response || response.status >= 400) {
            console.error(`Error status ${response?.status || 'unknown'} for: ${proxyUrl}`);
            lastError = new Error(`Status ${response?.status || 'unknown'}`);
            retryCount++;
            
            // Wait before retrying (exponential backoff)
            if (retryCount <= maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)));
              continue;
            } else {
              throw lastError;
            }
          }
          
          // Set content type from response or guess from URL
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
            else res.setHeader('Content-Type', 'application/octet-stream');
          }
          
          // Set cache headers
          res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
          
          // Return the image data
          return res.send(response.data);
        } catch (requestError) {
          console.error(`Error on attempt ${retryCount+1} for ${proxyUrl}:`, requestError.message);
          lastError = requestError;
          retryCount++;
          
          // Wait before retrying (exponential backoff)
          if (retryCount <= maxRetries) {
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)));
          }
        }
      }
      
      // If we get here, all retries failed
      throw lastError || new Error('Failed after all retries');
    } catch (fetchError) {
      console.error(`Error fetching ${proxyUrl}:`, fetchError.message);
      
      // Return a placeholder SVG image
      const placeholderSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
        <rect width="200" height="200" fill="#f0f0f0"/>
        <text x="50%" y="50%" font-family="Arial" font-size="12" text-anchor="middle" fill="#888">Image unavailable</text>
        <text x="50%" y="65%" font-family="Arial" font-size="10" text-anchor="middle" fill="#888">${fetchError.message.substring(0, 30)}</text>
      </svg>`);
      
      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Cache-Control', 'public, max-age=3600'); 
      return res.send(placeholderSvg);
    }
  } catch (error) {
    console.error(`Error in image proxy for ${req.query.url}:`, error.message);
    
    // Return a placeholder SVG image with error details
    const errorMessage = error.message.substring(0, 30);
    const placeholderSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
      <rect width="200" height="200" fill="#f0f0f0"/>
      <text x="50%" y="50%" font-family="Arial" font-size="12" text-anchor="middle" fill="#888">Image error: ${errorMessage}...</text>
    </svg>`);
    
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.send(placeholderSvg);
  }
} 