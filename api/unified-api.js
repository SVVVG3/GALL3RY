// Unified API Router - Single Handler for ALL API endpoints
// This consolidates ALL API endpoints into a single serverless function

// Import main API handlers
import zapper from './zapper.js';
import farcasterProfile from './farcaster-profile.js';
import imageProxy from './image-proxy.js';
import alchemy from './alchemy.js';
import collectionFriends from './collection-friends.js';
import login from './login.js';
import farcaster from './farcaster.js';
import farcasterUser from './farcaster-user.js';

// Import folder handlers
import foldersIndex from './folders/index.js';
import foldersById from './folders/[id].js';

// Import v2 handlers
import graphql from './v2/graphql.js';

export default async function handler(req, res) {
  try {
    // Extract the path from the URL
    const { url } = req;
    const path = url.split('/api/')[1]?.split('?')[0] || '';
    
    console.log(`[Unified API] Routing request to: ${path}`);
    
    // Handle folders endpoints
    if (path === 'folders') {
      return await foldersIndex(req, res);
    }
    
    if (path.startsWith('folders/')) {
      const folderId = path.split('folders/')[1];
      req.query = { ...req.query, id: folderId };
      return await foldersById(req, res);
    }
    
    // Handle v2 endpoints
    if (path.startsWith('v2/')) {
      const v2Path = path.split('v2/')[1];
      if (v2Path === 'graphql') {
        return await graphql(req, res);
      }
      return res.status(404).json({ error: 'V2 API endpoint not found' });
    }
    
    // Handle main API endpoints
    switch (path) {
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
        return res.status(404).json({ error: 'API endpoint not found' });
    }
  } catch (error) {
    console.error(`[Unified API] Error processing request:`, error);
    return res.status(500).json({ error: 'Internal server error', message: error.message });
  }
} 