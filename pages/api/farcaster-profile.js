/**
 * API route for fetching Farcaster profiles
 * 
 * This endpoint uses the Zapper API to retrieve Farcaster profile data.
 */

import axios from 'axios';

// Constants
const ZAPPER_API_ENDPOINTS = [
  'https://public.zapper.xyz/graphql'
];

const ZAPPER_API_KEY = process.env.ZAPPER_API_KEY || process.env.REACT_APP_ZAPPER_API_KEY || 'zapper-gallery';

// In-memory cache with 15-minute expiration
const cache = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

// API route for Farcaster profile lookup
// Forwards to the all-in-one.js handler

const allInOne = require('../../api/all-in-one.js');

export default async function handler(req, res) {
  console.log('[Vercel] Farcaster profile API route called');
  return allInOne(req, res);
} 