/**
 * Ultra-reliable media proxy for NFT images and videos with guaranteed responses
 * Optimized for Vercel deployment
 */

export const config = {
  api: {
    bodyParser: false,
    responseLimit: '30mb',  // Increased to handle larger media files
    externalResolver: true, // Optimize for Vercel edge functions
  },
};

export default async function handler(req, res) {
  // Always set CORS headers first thing
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Add Vercel-specific cache headers for better edge caching
  res.setHeader('CDN-Cache-Control', 'public, max-age=86400'); // 24 hours for Vercel's CDN
  res.setHeader('Vercel-CDN-Cache-Control', 'public, max-age=86400');
  
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
  console.log(`[MEDIA-PROXY] Request for: ${url}`);
  
  try {
    // Always decode the URL
    const targetUrl = decodeURIComponent(url);
    
    // Detect if this is likely a video or other media file
    const isVideo = targetUrl.match(/\.(mp4|webm|mov)($|\?)/i);
    const isAudio = targetUrl.match(/\.(mp3|wav|ogg)($|\?)/i);
    
    // Process media using native fetch with proper timeout
    // Use longer timeout for video files
    const timeoutDuration = isVideo || isAudio ? 15000 : 8000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutDuration);
    
    try {
      // Prepare headers for the target server
      const headers = new Headers();
      headers.append('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      // Use different accept headers based on content type
      if (isVideo) {
        headers.append('Accept', 'video/mp4,video/webm,video/*,*/*;q=0.8');
      } else if (isAudio) {
        headers.append('Accept', 'audio/mpeg,audio/ogg,audio/*,*/*;q=0.8');
      } else {
        headers.append('Accept', 'image/webp,image/apng,image/*,*/*;q=0.8');
      }
      
      // Special case for known problematic domains
      if (targetUrl.includes('apeokx.one')) {
        headers.append('Origin', null);
        headers.append('Referer', null);
      } else if (targetUrl.includes('nft-cdn.alchemy.com')) {
        // Add Alchemy API key to URL if missing
        let alchemyUrl = targetUrl;
        const apiKey = process.env.ALCHEMY_API_KEY || process.env.REACT_APP_ALCHEMY_API_KEY;
        
        if (!targetUrl.includes('apiKey=') && apiKey) {
          alchemyUrl = `${targetUrl}${targetUrl.includes('?') ? '&' : '?'}apiKey=${apiKey}`;
          console.log(`[MEDIA-PROXY] Added API key to Alchemy URL`);
        }
        
        headers.append('Origin', 'https://dashboard.alchemy.com');
        headers.append('Referer', 'https://dashboard.alchemy.com/');
        
        // Try the modified Alchemy URL
        const alchemyResponse = await fetch(alchemyUrl, {
          method: 'GET',
          headers,
          redirect: 'follow',
          signal: controller.signal,
        });
        
        if (alchemyResponse.ok) {
          const mediaBuffer = await alchemyResponse.arrayBuffer();
          if (mediaBuffer.byteLength > 0) {
            let contentType = alchemyResponse.headers.get('content-type');
            
            // Detect content type from URL if not provided
            if (!contentType || contentType === 'application/octet-stream') {
              if (isVideo) {
                contentType = 'video/mp4';
              } else if (isAudio) {
                contentType = 'audio/mpeg';
              } else {
                contentType = 'image/jpeg';
              }
            }
            
            // Set explicit headers for Vercel
            res.setHeader('Content-Type', contentType);
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.setHeader('Access-Control-Allow-Origin', '*');
            
            return res.status(200).send(Buffer.from(mediaBuffer));
          }
        }
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
        console.log(`[MEDIA-PROXY] Non-OK response from ${targetUrl}: ${response.status}`);
        return sendPlaceholder(res, `Error ${response.status}`);
      }
      
      // Get the response data as an array buffer
      const mediaBuffer = await response.arrayBuffer();
      
      // Check if we actually got data
      if (mediaBuffer.byteLength < 100) {
        console.log(`[MEDIA-PROXY] Empty or tiny response: ${mediaBuffer.byteLength} bytes`);
        return sendPlaceholder(res, 'Empty media response');
      }
      
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
        else if (targetUrl.match(/\.mov$/i)) contentType = 'video/quicktime';
        else if (targetUrl.match(/\.mp3$/i)) contentType = 'audio/mpeg';
        else if (targetUrl.match(/\.wav$/i)) contentType = 'audio/wav';
        else if (targetUrl.match(/\.ogg$/i)) contentType = 'audio/ogg';
        else contentType = isVideo ? 'video/mp4' : (isAudio ? 'audio/mpeg' : 'image/jpeg'); // Default fallback
      }
      
      // Set headers for our response - explicit for Vercel
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
      res.setHeader('Access-Control-Allow-Origin', '*');
      
      // Add content disposition header to help browsers process files correctly
      if (isVideo || isAudio) {
        const filename = targetUrl.split('/').pop().split('?')[0] || 'media';
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      }
      
      // Send the media data with explicit content length for Vercel
      res.setHeader('Content-Length', Buffer.byteLength(mediaBuffer));
      return res.status(200).send(Buffer.from(mediaBuffer));
    } catch (fetchError) {
      // Clear timeout if it's still active
      clearTimeout(timeoutId);
      
      console.error(`[MEDIA-PROXY] Fetch error for ${targetUrl}:`, fetchError.message);
      return sendPlaceholder(res, 'Could not fetch media');
    }
  } catch (error) {
    console.error('[MEDIA-PROXY] Global error:', error.message);
    return sendPlaceholder(res, 'Server error');
  }
}

/**
 * Always send a placeholder image instead of an error
 */
function sendPlaceholder(res, message = 'Media unavailable') {
  console.log(`[MEDIA-PROXY] Sending placeholder: ${message}`);
  
  // Create an SVG placeholder with the error message
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
    <rect width="300" height="300" fill="#f0f0f0"/>
    <text x="50%" y="45%" font-family="Arial" font-size="18" text-anchor="middle" fill="#666">${message}</text>
    <text x="50%" y="55%" font-family="Arial" font-size="14" text-anchor="middle" fill="#999">Try refreshing the page</text>
  </svg>`;
  
  // Set headers for SVG response with explicit Vercel caching
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Length', Buffer.byteLength(svg));
  
  // Always return 200 status so the image displays in the frontend
  return res.status(200).send(svg);
} 