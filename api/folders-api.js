// Combined Folders API Router
// This file consolidates folder-related API endpoints

import foldersIndex from './folders/index.js';
import foldersById from './folders/[id].js';

export default async function handler(req, res) {
  // Extract the path parts to determine if it's an ID-based request
  const { url } = req;
  const pathParts = url.split('/api/folders/');
  
  if (pathParts.length < 2) {
    // This is a request to /api/folders
    return await foldersIndex(req, res);
  } else {
    // This is a request to /api/folders/[id]
    // Modify the req object to include the id parameter
    const idPart = pathParts[1].split('?')[0];
    req.query = { ...req.query, id: idPart };
    
    return await foldersById(req, res);
  }
} 