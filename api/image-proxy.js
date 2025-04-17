/**
 * Simple image proxy for NFT images
 */

export const config = {
  api: {
    bodyParser: false,
    responseLimit: '10mb'
  }
};

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Only allow GET requests
  if (req.method !== 'GET') {
    return sendPlaceholder(res, 'Method not allowed');
  }
  
  // Get the URL to proxy
  const { url } = req.query;
  
  if (!url) {
    return sendPlaceholder(res, 'No URL parameter provided');
  }
  
  console.log(`Image proxy request for: ${url}`);
  
  try {
    // Decode the URL
    const targetUrl = decodeURIComponent(url);
    
    // Fetch the image
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      },
      redirect: 'follow',
    });
    
    // Handle errors
    if (!response.ok) {
      console.log(`Non-OK response: ${response.status}`);
      return sendPlaceholder(res, `Error ${response.status}`);
    }
    
    // Get the response data
    const imageBuffer = await response.arrayBuffer();
    
    // Get content type
    let contentType = response.headers.get('content-type');
    
    // If no content type or generic, try to determine from URL
    if (!contentType || contentType === 'application/octet-stream') {
      if (targetUrl.match(/\.(jpg|jpeg)$/i)) contentType = 'image/jpeg';
      else if (targetUrl.match(/\.png$/i)) contentType = 'image/png';
      else if (targetUrl.match(/\.gif$/i)) contentType = 'image/gif';
      else if (targetUrl.match(/\.svg$/i)) contentType = 'image/svg+xml';
      else if (targetUrl.match(/\.webp$/i)) contentType = 'image/webp';
      else contentType = 'image/jpeg'; // Default
    }
    
    // Set headers for response
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // 24 hours
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Send the image
    return res.status(200).send(Buffer.from(imageBuffer));
  } catch (error) {
    console.error('Image proxy error:', error.message);
    return sendPlaceholder(res, 'Could not fetch image');
  }
}

/**
 * Send a placeholder image
 */
function sendPlaceholder(res, message = 'Image unavailable') {
  // Create SVG placeholder
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
    <rect width="300" height="300" fill="#f0f0f0"/>
    <text x="50%" y="50%" font-family="Arial" font-size="18" text-anchor="middle" fill="#666">${message}</text>
  </svg>`;
  
  // Set headers
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hour
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // Return the SVG
  return res.status(200).send(svg);
} 