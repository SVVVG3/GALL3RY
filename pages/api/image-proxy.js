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
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br'
    };
    
    // Special handling for different URL types
    
    // Handle Alchemy CDN URLs specifically
    if (proxyUrl.includes('nft-cdn.alchemy.com')) {
      console.log('Detected Alchemy CDN URL, adding special headers');
      customHeaders = {
        ...customHeaders,
        'Cache-Control': 'no-cache'
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
        'Origin': 'https://opensea.io'
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
      
      // If using ipfs.io and getting errors, try cloudflare-ipfs instead
      if (proxyUrl.includes('ipfs.io') && proxyUrl.includes('/ipfs/')) {
        const ipfsPath = proxyUrl.split('/ipfs/')[1];
        proxyUrl = `https://cloudflare-ipfs.com/ipfs/${ipfsPath}`;
        console.log(`Switched to Cloudflare IPFS: ${proxyUrl}`);
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
      // Simpler fetch with fewer retries but better error handling
      const response = await axios({
        method: 'get',
        url: proxyUrl,
        responseType: 'arraybuffer',
        timeout: 15000, // 15 second timeout
        headers: customHeaders,
        validateStatus: null, // Allow any status code to handle it ourselves
        maxContentLength: 10 * 1024 * 1024, // 10MB max size
        maxRedirects: 5
      });
      
      // Handle errors more gracefully
      if (!response || response.status >= 400) {
        console.error(`Error status ${response?.status || 'unknown'} for: ${proxyUrl}`);
        
        // Return a placeholder image with proper headers
        const placeholderSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
          <rect width="200" height="200" fill="#f0f0f0"/>
          <text x="50%" y="50%" font-family="Arial" font-size="12" text-anchor="middle" fill="#888">Image unavailable</text>
        </svg>`);
        
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.send(placeholderSvg);
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
    } catch (fetchError) {
      console.error(`Error fetching ${proxyUrl}:`, fetchError.message);
      
      // Return a placeholder SVG image
      const placeholderSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200">
        <rect width="200" height="200" fill="#f0f0f0"/>
        <text x="50%" y="50%" font-family="Arial" font-size="12" text-anchor="middle" fill="#888">Image unavailable</text>
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