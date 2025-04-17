/**
 * Ultra-reliable image proxy for NFT images with guaranteed responses
 */

export const config = {
  api: {
    bodyParser: false,
    responseLimit: '10mb',
  },
};

export default async function handler(req, res) {
  // Always set CORS headers first thing - very permissive to debug
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Timing-Allow-Origin', '*');
  
  // Handle preflight requests immediately
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only allow GET requests
  if (req.method !== 'GET') {
    return sendPlaceholder(res, 'Method not allowed');
  }
  
  // Extract the URL to proxy
  const { url } = req.query;
  
  if (!url) {
    return sendPlaceholder(res, 'No URL parameter provided');
  }
  
  // Log the incoming request with debug ID for tracing
  const debugId = Math.random().toString(36).substring(2, 8);
  console.log(`[IMAGE-PROXY][${debugId}] Request for: ${url}`);
  
  try {
    // Always decode the URL
    const targetUrl = decodeURIComponent(url);
    
    // Handle Alchemy URLs specially - they often need API keys
    if (targetUrl.includes('nft-cdn.alchemy.com')) {
      // Add Alchemy API key to URL if missing
      const apiKey = process.env.ALCHEMY_API_KEY || process.env.REACT_APP_ALCHEMY_API_KEY;
      let modifiedUrl = targetUrl;
      
      if (!targetUrl.includes('apiKey=') && apiKey) {
        modifiedUrl = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}apiKey=${apiKey}`;
        console.log(`[IMAGE-PROXY][${debugId}] Modified Alchemy URL with API key`);
      }
      
      return await proxyAlchemyImage(modifiedUrl, res, debugId);
    }
    
    // Handle IPFS URLs
    if (targetUrl.startsWith('ipfs://')) {
      const ipfsGatewayUrl = `https://cloudflare-ipfs.com/ipfs/${targetUrl.replace('ipfs://', '')}`;
      console.log(`[IMAGE-PROXY][${debugId}] Converting IPFS URL: ${ipfsGatewayUrl}`);
      return await proxyGenericImage(ipfsGatewayUrl, res, debugId);
    }
    
    // Handle all other URLs
    console.log(`[IMAGE-PROXY][${debugId}] Proxying standard URL: ${targetUrl}`);
    return await proxyGenericImage(targetUrl, res, debugId);
    
  } catch (error) {
    console.error('[IMAGE-PROXY] Global error:', error.message);
    return sendPlaceholder(res, `Error: ${error.message.substring(0, 30)}`);
  }
}

/**
 * Proxy specifically for Alchemy image CDN
 */
async function proxyAlchemyImage(url, res, debugId) {
  try {
    // Specific headers known to work with Alchemy
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      'Origin': 'https://dashboard.alchemy.com',
      'Referer': 'https://dashboard.alchemy.com/',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    };
    
    // Process URL to ensure it has the correct format
    let processedUrl = url;
    if (!url.includes('/original') && !url.includes('/thumb') && !url.includes('.jpg') && !url.includes('.png')) {
      processedUrl = `${url}/original`;
      console.log(`[IMAGE-PROXY][${debugId}] Fixed Alchemy URL format: ${processedUrl}`);
    }
    
    // Try both /original and /thumb formats if one fails
    for (const format of [processedUrl, processedUrl.includes('/original') ? 
                           processedUrl.replace('/original', '/thumb') : 
                           processedUrl]) {
      // Timeout of 8 seconds
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      
      try {
        console.log(`[IMAGE-PROXY][${debugId}] Trying Alchemy URL: ${format}`);
        const response = await fetch(format, {
          method: 'GET',
          headers,
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          console.error(`[IMAGE-PROXY][${debugId}] Alchemy returned status ${response.status}`);
          continue; // Try next format
        }
        
        const contentType = response.headers.get('content-type');
        const buffer = await response.arrayBuffer();
        
        // Only proceed if we have actual image data
        if (buffer.byteLength === 0) {
          console.error(`[IMAGE-PROXY][${debugId}] Empty response from Alchemy`);
          continue; // Try next format
        }
        
        // Validate that this is an image
        if (contentType && !contentType.includes('image/') && !contentType.includes('video/')) {
          console.error(`[IMAGE-PROXY][${debugId}] Invalid content type: ${contentType}`);
          continue; // Try next format
        }
        
        // We have a valid image, return it
        res.setHeader('Content-Type', contentType || 'image/jpeg');
        res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        return res.status(200).send(Buffer.from(buffer));
      } catch (fetchError) {
        clearTimeout(timeoutId);
        console.error(`[IMAGE-PROXY][${debugId}] Fetch error for Alchemy format ${format}:`, fetchError.message);
        // Continue to try next format
      }
    }
    
    // If we get here, both formats failed
    return sendPlaceholder(res, `Alchemy fetch error`);
  } catch (error) {
    console.error(`[IMAGE-PROXY][${debugId}] Error in proxyAlchemyImage:`, error.message);
    return sendPlaceholder(res, 'Alchemy proxy error');
  }
}

/**
 * Generic image proxy for non-Alchemy sources
 */
async function proxyGenericImage(url, res, debugId) {
  try {
    // Prepare headers for general image sources
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': '*/*',
    };
    
    // Add custom headers for specific domains
    if (url.includes('seadn.io') || url.includes('opensea')) {
      headers['Origin'] = 'https://opensea.io';
      headers['Referer'] = 'https://opensea.io/';
    } else if (url.includes('ipfs.io') || url.includes('cloudflare-ipfs.com')) {
      // Some IPFS gateways are finnicky about headers
      headers['Accept'] = 'image/webp,image/apng,image/*,*/*;q=0.8';
    }
    
    // Timeout of 8 seconds
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    try {
      console.log(`[IMAGE-PROXY][${debugId}] Fetching: ${url}`);
      const response = await fetch(url, {
        method: 'GET',
        headers,
        redirect: 'follow',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.error(`[IMAGE-PROXY][${debugId}] URL returned status ${response.status}: ${url}`);
        return sendPlaceholder(res, `Error ${response.status}`);
      }
      
      const buffer = await response.arrayBuffer();
      
      // Validate buffer size
      if (buffer.byteLength === 0 || buffer.byteLength < 100) {
        console.error(`[IMAGE-PROXY][${debugId}] Empty or tiny response (${buffer.byteLength} bytes)`);
        return sendPlaceholder(res, 'Empty image data');
      }
      
      // Detect content type or use response header
      let contentType = response.headers.get('content-type');
      
      // If no content type or it's generic, try to determine from URL
      if (!contentType || contentType === 'application/octet-stream' || contentType === 'text/plain') {
        if (url.match(/\.(jpg|jpeg)$/i)) contentType = 'image/jpeg';
        else if (url.match(/\.png$/i)) contentType = 'image/png';
        else if (url.match(/\.gif$/i)) contentType = 'image/gif';
        else if (url.match(/\.svg$/i)) contentType = 'image/svg+xml';
        else if (url.match(/\.webp$/i)) contentType = 'image/webp';
        else if (url.match(/\.mp4$/i)) contentType = 'video/mp4';
        else contentType = 'image/jpeg'; // Default fallback
      }
      
      // Check for HTML content mistakenly served as image
      if ((contentType.includes('text/html') || !contentType.includes('image/')) && 
          !contentType.includes('video/')) {
        
        // Try to detect if this is actually an image
        const isImage = detectImageSignature(buffer);
        if (!isImage) {
          console.error(`[IMAGE-PROXY][${debugId}] Detected non-image content: ${contentType}`);
          return sendPlaceholder(res, 'Invalid image format');
        }
        
        // Force image content type based on signature
        contentType = isImage;
      }
      
      // Set headers for our response
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      
      // Send the image data
      return res.status(200).send(Buffer.from(buffer));
    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.error(`[IMAGE-PROXY][${debugId}] Fetch error:`, fetchError.message);
      return sendPlaceholder(res, 'Could not fetch image');
    }
  } catch (error) {
    console.error(`[IMAGE-PROXY][${debugId}] Error in proxyGenericImage:`, error.message);
    return sendPlaceholder(res, 'Generic proxy error');
  }
}

/**
 * Detect image type from buffer signatures
 */
function detectImageSignature(buffer) {
  const arr = new Uint8Array(buffer.slice(0, 4));
  
  // JPEG signature: FF D8 FF
  if (arr[0] === 0xFF && arr[1] === 0xD8 && arr[2] === 0xFF) {
    return 'image/jpeg';
  }
  
  // PNG signature: 89 50 4E 47
  if (arr[0] === 0x89 && arr[1] === 0x50 && arr[2] === 0x4E && arr[3] === 0x47) {
    return 'image/png';
  }
  
  // GIF signature: 47 49 46 38
  if (arr[0] === 0x47 && arr[1] === 0x49 && arr[2] === 0x46 && arr[3] === 0x38) {
    return 'image/gif';
  }
  
  // WebP signature: 52 49 46 46 (RIFF) followed by WebP
  if (arr[0] === 0x52 && arr[1] === 0x49 && arr[2] === 0x46 && arr[3] === 0x46) {
    // Check for "WEBP" string starting at position 8
    if (buffer.byteLength >= 12) {
      const webpArr = new Uint8Array(buffer.slice(8, 12));
      if (webpArr[0] === 0x57 && webpArr[1] === 0x45 && webpArr[2] === 0x42 && webpArr[3] === 0x50) {
        return 'image/webp';
      }
    }
  }
  
  return false;
}

/**
 * Always send a placeholder image instead of an error
 */
function sendPlaceholder(res, message = 'Image unavailable') {
  console.log(`[IMAGE-PROXY] Sending placeholder: ${message}`);
  
  // Create an SVG placeholder with the error message
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
    <rect width="300" height="300" fill="#f0f0f0"/>
    <text x="50%" y="50%" font-family="Arial" font-size="18" text-anchor="middle" fill="#666">${message}</text>
  </svg>`;
  
  // Set headers for SVG response
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // Always return 200 status so the image displays in the frontend
  return res.status(200).send(svg);
} 