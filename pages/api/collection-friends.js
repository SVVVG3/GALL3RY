/**
 * Collection Friends API Endpoint
 * 
 * This endpoint finds which Farcaster users you follow that also hold NFTs from a specific collection
 * It makes three API calls:
 * 1. Neynar API: Get list of users the current user follows
 * 2. Alchemy API: Get all wallet addresses that hold NFTs from specified contract
 * 3. Zapper API: Match wallet addresses to Farcaster profiles
 */

import axios from 'axios';
import allInOne from '../../api/all-in-one.js';

// Alchemy API base URL
const getAlchemyBaseUrl = (network = 'eth') => {
  const networkMap = {
    'eth': 'eth-mainnet',
    'ethereum': 'eth-mainnet',
    'polygon': 'polygon-mainnet',
    'arbitrum': 'arb-mainnet',
    'optimism': 'opt-mainnet',
    'base': 'base-mainnet',
    'zora': 'zora-mainnet',
  };

  const normalizedNetwork = network.toLowerCase();
  const chainId = networkMap[normalizedNetwork] || 'eth-mainnet';
  return `https://${chainId}.g.alchemy.com`;
};

// Constants
// Updated Neynar API URL to match all-in-one.js implementation
// const NEYNAR_API_URL = 'https://api.neynar.com/v2/farcaster';
const ZAPPER_API_URL = 'https://public.zapper.xyz/graphql';
const MAX_RETRIES = 2;

// Specialized API route for collection-friends
// This integrates with the all-in-one.js handler for Vercel deployment

// Forward the request to the all-in-one handler
export default async function handler(req, res) {
  console.log('[Vercel] Collection friends API route called');
  return allInOne(req, res);
} 