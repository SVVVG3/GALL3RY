/**
 * Test script for validating Zapper API integration for Farcaster profiles
 * 
 * Run with: node test-zapper.js <username>
 */

const axios = require('axios');
require('dotenv').config();

// Get username from command line or use default
const username = process.argv[2] || 'vitalik';

// Constants
const ZAPPER_API_KEY = process.env.REACT_APP_ZAPPER_API_KEY || '';
const ENDPOINTS = [
  'https://api.zapper.xyz/v2/graphql',
  'https://api.zapper.fi/v2/graphql',
  'https://public.zapper.xyz/graphql'
];

/**
 * Fetch a Farcaster profile using Zapper's GraphQL API
 */
async function testZapperFarcasterAPI(username) {
  console.log('-'.repeat(80));
  console.log(`Testing Farcaster profile fetching from Zapper API for "${username}"`);
  console.log('-'.repeat(80));
  
  // GraphQL query for Farcaster profile
  const query = `
    query GetFarcasterProfile($username: String) {
      farcasterProfile(username: $username) {
        username
        fid
        metadata {
          displayName
          description
          imageUrl
          warpcast
        }
        custodyAddress
        connectedAddresses
      }
    }
  `;
  
  const variables = { username };
  
  // Try each endpoint
  for (const endpoint of ENDPOINTS) {
    console.log(`\nTrying endpoint: ${endpoint}`);
    
    try {
      // Setup headers
      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };
      
      // Add API key if available
      if (ZAPPER_API_KEY) {
        headers['x-zapper-api-key'] = ZAPPER_API_KEY;
      }
      
      // Make the request
      const response = await axios.post(
        endpoint,
        { query, variables },
        { headers }
      );
      
      console.log('Response status:', response.status);
      
      // Check for GraphQL errors
      if (response.data?.errors) {
        console.error('GraphQL errors:', response.data.errors);
        console.log('This endpoint returned errors - trying next endpoint...');
        continue;
      }
      
      // Try to extract profile data
      let profileData = null;
      
      if (response.data?.data?.farcasterProfile) {
        profileData = response.data.data.farcasterProfile;
      } else if (response.data?.farcasterProfile) {
        profileData = response.data.farcasterProfile;
      }
      
      if (profileData) {
        console.log('\nProfile found!');
        console.log(JSON.stringify(profileData, null, 2));
        console.log(`\nSuccess! Endpoint ${endpoint} works correctly.`);
        return;
      } else {
        console.log('No profile data found in the response:', response.data);
      }
    } catch (error) {
      console.error(`Error with endpoint ${endpoint}:`, error.message);
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
    }
  }
  
  console.log('\nAll endpoints failed. Please check your network connection and API key.');
}

// Run the test
testZapperFarcasterAPI(username); 