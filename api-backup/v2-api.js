// Combined v2 API Router
// This file consolidates v2 API endpoints

import graphql from './v2/graphql.js';

export default async function handler(req, res) {
  // Extract the endpoint
  const { url } = req;
  const endpoint = url.split('/api/v2/')[1]?.split('?')[0] || '';
  
  console.log(`[V2 API] Routing request to: ${endpoint}`);
  
  switch (endpoint) {
    case 'graphql':
      return await graphql(req, res);
    
    default:
      res.status(404).json({ error: 'V2 API endpoint not found' });
  }
} 