/**
 * Ultra-reliable image proxy for NFT images with guaranteed responses
 */

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
};

export default async function handler(req, res) {
  // Always set CORS headers first thing
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
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
    
    // Process image using native fetch with proper timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    try {
      // Prepare headers for the target server
      const headers = new Headers();
      headers.append('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      headers.append('Accept', '*/*');
      
      // Special case for known problematic domains
      if (targetUrl.includes('apeokx.one')) {
        headers.append('Origin', null);
        headers.append('Referer', null);
      } else if (targetUrl.includes('nft-cdn.alchemy.com')) {
        headers.append('Origin', 'https://dashboard.alchemy.com');
        headers.append('Referer', 'https://dashboard.alchemy.com/');
      } else if (targetUrl.includes('goonzworld.com')) {
        headers.append('Origin', null);
        headers.append('Referer', null);
      } else if (targetUrl.includes('i.seadn.io')) {
        headers.append('Origin', 'https://opensea.io');
        headers.append('Referer', 'https://opensea.io/');
      }
    
      // Attempt the fetch
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers,
        redirect: 'follow',
        signal: controller.signal,
      });
      
      // Clear the timeout
      clearTimeout(timeoutId);
      
      // Check if we received a successful response
      if (!response.ok) {
        console.log(`[IMAGE-PROXY] Non-OK response from ${targetUrl}: ${response.status}`);
        return sendPlaceholder(res, `Error ${response.status}`);
      }
      
      // Get the response data as an array buffer
      const imageBuffer = await response.arrayBuffer();
      
      // Detect content type
      let contentType = response.headers.get('content-type');
      
      // If no content type or invalid type, try to determine from URL
      if (!contentType || contentType === 'application/octet-stream' || contentType === 'text/plain') {
        if (targetUrl.match(/\.(jpg|jpeg)$/i)) contentType = 'image/jpeg';
        else if (targetUrl.match(/\.png$/i)) contentType = 'image/png';
        else if (targetUrl.match(/\.gif$/i)) contentType = 'image/gif';
        else if (targetUrl.match(/\.svg$/i)) contentType = 'image/svg+xml';
        else if (targetUrl.match(/\.webp$/i)) contentType = 'image/webp';
        else if (targetUrl.match(/\.mp4$/i)) contentType = 'video/mp4';
        else if (targetUrl.match(/\.webm$/i)) contentType = 'video/webm';
        else contentType = 'image/jpeg'; // Default fallback
      }
      
      // Set headers for our response
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
      
      // Send the image data
      return res.status(200).send(Buffer.from(imageBuffer));
    } catch (fetchError) {
      // Clear timeout if it's still active
      clearTimeout(timeoutId);
      
      console.error(`[IMAGE-PROXY] Fetch error for ${targetUrl}:`, fetchError.message);
      return sendPlaceholder(res, 'Could not fetch image');
    }
  } catch (error) {
    console.error('[IMAGE-PROXY] Global error:', error.message);
    return sendPlaceholder(res, 'Server error');
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