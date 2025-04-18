/**
 * Dedicated Alchemy API handler with improved configuration and error handling
 */

import axios from 'axios';

// Map network names to their Alchemy endpoints
const getAlchemyBaseUrl = (network = 'eth') => {
  const networkMap = {
    'eth': 'eth-mainnet',
    'ethereum': 'eth-mainnet',
    'polygon': 'polygon-mainnet',
    'arbitrum': 'arb-mainnet',
    'optimism': 'opt-mainnet',
    'base': 'base-mainnet',
    'zora': 'zora-mainnet',
    'sepolia': 'eth-sepolia',
  };

  const normalizedNetwork = network.toLowerCase();
  const chainId = networkMap[normalizedNetwork] || 'eth-mainnet';
  return `https://${chainId}.g.alchemy.com`;
};

// Helper to get API key with proper error handling
const getAlchemyApiKey = () => {
  const apiKey = process.env.ALCHEMY_API_KEY;
  if (!apiKey) {
    console.error('CRITICAL ERROR: Alchemy API key is missing from environment variables');
    throw new Error('Missing Alchemy API key');
  }
  return apiKey;
};

// The main API handler
export default async function handler(req, res) {
  console.log('[Vercel] Alchemy API route called');
  return allInOne(req, res);
}