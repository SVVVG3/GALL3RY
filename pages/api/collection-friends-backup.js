// Backup API route for collection-friends
// This serves as a fallback when the primary endpoint fails

import allInOne from '../../api/all-in-one.js';

// Forward the request to the all-in-one handler
export default async function handler(req, res) {
  console.log('[Vercel] Collection friends BACKUP API route called');
  
  // Add a flag to indicate this is the backup endpoint
  req.query.isBackup = 'true';
  
  return allInOne(req, res);
} 