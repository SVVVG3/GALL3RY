/**
 * API proxy for Zapper GraphQL API
 * 
 * This endpoint forwards GraphQL requests to the Zapper API
 * with proper authentication headers. It tries multiple Zapper
 * endpoints to increase reliability.
 */

import axios from 'axios';

// Constants
const ZAPPER_API_ENDPOINTS = [
  'https://public.zapper.xyz/graphql'
];

const ZAPPER_API_KEY = process.env.ZAPPER_API_KEY || process.env.REACT_APP_ZAPPER_API_KEY || 'zapper-gallery';

const allInOne = require('../../api/all-in-one.js');

export default async function handler(req, res) {
  console.log('[Vercel] Zapper GraphQL API route called');
  return allInOne(req, res);
} 