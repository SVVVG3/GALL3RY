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
  
  // Log the incoming request
  console.log(`[IMAGE-PROXY] Request for: ${url}`);
  
  try {
    // Always decode the URL
    const targetUrl = decodeURIComponent(url);
    
    // Handle Alchemy URLs specially - they often need API keys
    if (targetUrl.includes('nft-cdn.alchemy.com')) {
      // Add Alchemy API key to URL if missing
      const apiKey = process.env.ALCHEMY_API_KEY || process.env.REACT_APP_ALCHEMY_API_KEY;
      const modifiedUrl = !targetUrl.includes('apiKey=') && apiKey ? 
        `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}apiKey=${apiKey}` : 
        targetUrl;
      
      console.log(`[IMAGE-PROXY] Modified Alchemy URL with API key`);
      return await proxyAlchemyImage(modifiedUrl, res);
    }
    
    // Handle IPFS URLs
    if (targetUrl.startsWith('ipfs://')) {
      const ipfsGatewayUrl = `https://cloudflare-ipfs.com/ipfs/${targetUrl.replace('ipfs://', '')}`;
      console.log(`[IMAGE-PROXY] Converting IPFS URL: ${ipfsGatewayUrl}`);
      return await proxyGenericImage(ipfsGatewayUrl, res);
    }
    
    // Handle all other URLs
    console.log(`[IMAGE-PROXY] Proxying standard URL: ${targetUrl}`);
    return await proxyGenericImage(targetUrl, res);
    
  } catch (error) {
    console.error('[IMAGE-PROXY] Global error:', error.message);
    return sendPlaceholder(res, `Error: ${error.message.substring(0, 30)}`);
  }
}

/**
 * Proxy specifically for Alchemy image CDN
 */
async function proxyAlchemyImage(url, res) {
  try {
    // Specific headers known to work with Alchemy
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      'Origin': 'https://dashboard.alchemy.com',
      'Referer': 'https://dashboard.alchemy.com/',
    };
    
    // Process URL to ensure it has the correct format
    let processedUrl = url;
    if (!url.includes('/original') && !url.includes('/thumb') && !url.includes('.jpg') && !url.includes('.png')) {
      processedUrl = `${url}/original`;
      console.log(`[IMAGE-PROXY] Fixed Alchemy URL format: ${processedUrl}`);
    }
    
    // Timeout of 8 seconds
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    try {
      const response = await fetch(processedUrl, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.error(`[IMAGE-PROXY] Alchemy returned status ${response.status}`);
        return sendPlaceholder(res, `Alchemy error ${response.status}`);
      }
      
      const contentType = response.headers.get('content-type');
      const buffer = await response.arrayBuffer();
      
      // Only proceed if we have actual image data
      if (buffer.byteLength === 0) {
        console.error(`[IMAGE-PROXY] Empty response from Alchemy`);
        return sendPlaceholder(res, 'Empty image data');
      }
      
      res.setHeader('Content-Type', contentType || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
      
      return res.status(200).send(Buffer.from(buffer));
    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.error(`[IMAGE-PROXY] Fetch error for Alchemy:`, fetchError.message);
      return sendPlaceholder(res, `Alchemy fetch error`);
    }
  } catch (error) {
    console.error(`[IMAGE-PROXY] Error in proxyAlchemyImage:`, error.message);
    return sendPlaceholder(res, 'Alchemy proxy error');
  }
}

/**
 * Generic image proxy for non-Alchemy sources
 */
async function proxyGenericImage(url, res) {
  try {
    // Prepare headers for general image sources
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': '*/*',
    };
    
    // Add origin and referer if it's OpenSea
    if (url.includes('seadn.io') || url.includes('opensea')) {
      headers['Origin'] = 'https://opensea.io';
      headers['Referer'] = 'https://opensea.io/';
    }
    
    // Timeout of 8 seconds
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers,
        redirect: 'follow',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.error(`[IMAGE-PROXY] URL returned status ${response.status}: ${url}`);
        return sendPlaceholder(res, `Error ${response.status}`);
      }
      
      const buffer = await response.arrayBuffer();
      
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
      
      // Set explicit Cache-Control for all images 
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
      
      return res.status(200).send(Buffer.from(buffer));
    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.error(`[IMAGE-PROXY] Fetch error:`, fetchError.message);
      return sendPlaceholder(res, 'Could not fetch image');
    }
  } catch (error) {
    console.error(`[IMAGE-PROXY] Error in proxyGenericImage:`, error.message);
    return sendPlaceholder(res, 'Generic proxy error');
  }
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