/**
 * Ultra-reliable image proxy for NFT images with guaranteed responses
 * Optimized for Vercel deployment
 */

// Explicitly set headers and bodyParser for Vercel
export const config = {
  api: {
    bodyParser: false,
    responseLimit: '10mb',
  },
  runtime: 'nodejs' // Force Node.js runtime for better buffer handling
};

export default async function handler(req, res) {
  // Always set CORS headers first thing - very permissive
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Vercel-specific cache control
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
  res.setHeader('CDN-Cache-Control', 'public, max-age=86400');
  
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
      headers.append('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      headers.append('Accept', 'image/webp,image/avif,image/apng,image/*,*/*;q=0.8');
      headers.append('Accept-Encoding', 'gzip, deflate, br');
      
      // Special case for Alchemy URLs
      if (targetUrl.includes('nft-cdn.alchemy.com')) {
        // Add Alchemy API key if missing
        let alchemyUrl = targetUrl;
        const apiKey = process.env.ALCHEMY_API_KEY || process.env.REACT_APP_ALCHEMY_API_KEY;
        
        if (apiKey && !targetUrl.includes('apiKey=')) {
          alchemyUrl = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}apiKey=${apiKey}`;
        }
        
        // Add format specifier if missing
        if (!alchemyUrl.includes('/original') && !alchemyUrl.includes('/thumb') && 
            !alchemyUrl.includes('.jpg') && !alchemyUrl.includes('.png')) {
          alchemyUrl = `${alchemyUrl}/original`;
        }
        
        headers.append('Origin', 'https://dashboard.alchemy.com');
        headers.append('Referer', 'https://dashboard.alchemy.com/');
        
        // Perform the fetch
        const response = await fetch(alchemyUrl, {
          method: 'GET',
          headers,
          redirect: 'follow',
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          console.error(`[IMAGE-PROXY] Alchemy error: ${response.status}`);
          // Try thumbnail as fallback
          if (alchemyUrl.includes('/original')) {
            const thumbUrl = alchemyUrl.replace('/original', '/thumb');
            const thumbResponse = await fetch(thumbUrl, {
              method: 'GET',
              headers,
              redirect: 'follow',
            });
            
            if (thumbResponse.ok) {
              const buffer = await thumbResponse.arrayBuffer();
              return serveImage(res, buffer, thumbResponse.headers.get('content-type') || 'image/jpeg');
            }
          }
          return sendPlaceholder(res, `Alchemy error: ${response.status}`);
        }
        
        const buffer = await response.arrayBuffer();
        return serveImage(res, buffer, response.headers.get('content-type') || 'image/jpeg');
      }
      
      // Special case for OpenSea URLs
      if (targetUrl.includes('opensea.io') || targetUrl.includes('seadn.io')) {
        headers.append('Origin', 'https://opensea.io');
        headers.append('Referer', 'https://opensea.io/');
      }
      
      // General case for all other URLs  
      const response = await fetch(targetUrl, {
        method: 'GET',
        headers,
        redirect: 'follow',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        console.error(`[IMAGE-PROXY] Error: ${response.status} for ${targetUrl}`);
        return sendPlaceholder(res, `Error ${response.status}`);
      }
      
      const buffer = await response.arrayBuffer();
      
      // Validate we got some data
      if (buffer.byteLength < 100) {
        console.error(`[IMAGE-PROXY] Empty response (${buffer.byteLength} bytes) for ${targetUrl}`);
        return sendPlaceholder(res, 'Empty response');
      }
      
      // Determine content type
      let contentType = response.headers.get('content-type');
      
      // If no content type or invalid, determine from URL or data
      if (!contentType || contentType === 'application/octet-stream' || contentType === 'text/plain') {
        if (targetUrl.match(/\.(jpg|jpeg)$/i)) contentType = 'image/jpeg';
        else if (targetUrl.match(/\.png$/i)) contentType = 'image/png';
        else if (targetUrl.match(/\.gif$/i)) contentType = 'image/gif';
        else if (targetUrl.match(/\.svg$/i)) contentType = 'image/svg+xml';
        else if (targetUrl.match(/\.webp$/i)) contentType = 'image/webp';
        else if (targetUrl.match(/\.mp4$/i)) contentType = 'video/mp4';
        else contentType = 'image/jpeg'; // Default fallback
      }
      
      return serveImage(res, buffer, contentType);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      console.error(`[IMAGE-PROXY] Fetch error for ${targetUrl}:`, fetchError.message);
      return sendPlaceholder(res, 'Fetch error');
    }
  } catch (error) {
    console.error('[IMAGE-PROXY] Global error:', error.message);
    return sendPlaceholder(res, 'Server error');
  }
}

/**
 * Helper function to serve image data with proper headers
 */
function serveImage(res, buffer, contentType) {
  // Set consistent headers for all images
  res.setHeader('Content-Type', contentType || 'image/jpeg');
  res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Length', buffer.byteLength);
  
  // Send the image
  return res.status(200).send(Buffer.from(buffer));
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
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Length', Buffer.byteLength(svg));
  
  // Always return 200 status so the image displays in the frontend
  return res.status(200).send(svg);
} 
} 
} 