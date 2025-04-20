// Combined API Router
// This file consolidates multiple API endpoints to work within Vercel's function limits

import zapper from './zapper.js';
import farcasterProfile from './farcaster-profile.js';
import imageProxy from './image-proxy.js';
import alchemy from './alchemy.js';
import collectionFriends from './collection-friends.js';
import login from './login.js';
import farcaster from './farcaster.js';
import farcasterUser from './farcaster-user.js';

export default async function handler(req, res) {
  // Extract the actual endpoint from the URL path
  const { url } = req;
  const endpoint = url.split('/api/')[1]?.split('?')[0] || '';
  
  console.log(`[Combined API] Routing request to: ${endpoint}`);
  
  // Route the request to the appropriate handler based on the endpoint
  try {
    switch (endpoint) {
      case 'zapper':
        return await zapper(req, res);
      
      case 'farcaster-profile':
        return await farcasterProfile(req, res);
      
      case 'image-proxy':
        return await imageProxy(req, res);
      
      case 'alchemy':
        return await alchemy(req, res);
      
      case 'collection-friends':
        return await collectionFriends(req, res);
      
      case 'login':
        return await login(req, res);
      
      case 'farcaster':
        return await farcaster(req, res);
      
      case 'farcaster-user':
        return await farcasterUser(req, res);
      
      default:
        res.status(404).json({ error: 'API endpoint not found' });
    }
  } catch (error) {
    console.error(`[Combined API] Error processing request to ${endpoint}:`, error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
} 