/**
 * Test script for diagnosing Farcaster profile fetching issues
 * 
 * Usage: node test-farcaster.js <username>
 */

require('dotenv').config();
const axios = require('axios');

const NEYNAR_API_KEY = process.env.REACT_APP_NEYNAR_API_KEY || '';
const ZAPPER_API_KEY = process.env.REACT_APP_ZAPPER_API_KEY || '';

const username = process.argv[2] || 'vitalik';

console.log('-'.repeat(80));
console.log(`Testing Farcaster profile fetching for "${username}"`);
console.log('-'.repeat(80));

// Test the Neynar API first (recommended solution)
async function testNeynarAPI() {
  console.log('\n*** TRYING NEYNAR API ***');
  const neynarEndpoint = `https://api.neynar.com/v2/farcaster/user/search?q=${username}&limit=1`;
  console.log(`Trying Neynar endpoint: ${neynarEndpoint}`);
  
  try {
    const response = await axios.get(neynarEndpoint, {
      headers: {
        'accept': 'application/json',
        'api_key': NEYNAR_API_KEY
      }
    });
    
    console.log('Response status:', response.status);
    console.log('Response data structure:', {
      hasData: !!response.data,
      dataKeys: response.data ? Object.keys(response.data) : []
    });
    
    if (response.data && response.data.users && response.data.users.length > 0) {
      const user = response.data.users[0];
      console.log('Found user:', {
        fid: user.fid,
        username: user.username,
        displayName: user.display_name,
        pfp: user.pfp_url
      });
      return true;
    } else {
      console.log('No user found');
      return false;
    }
  } catch (error) {
    console.log('Error with Neynar API:', error.message);
    console.log('Response status:', error.response?.status);
    console.log('Response data:', error.response?.data);
    return false;
  }
}

// Test the Zapper API which the app is currently using
async function testZapperAPI() {
  console.log('\n*** TRYING ZAPPER API (LIKELY OUTDATED) ***');
  console.log(`Fetching Farcaster profile for username: ${username}`);
  
  const query = `
    query GetFarcasterProfile($username: String, $fid: Int) {
      farcasterProfile(username: $username, fid: $fid) {
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
  
  // Try multiple different Zapper endpoints to see which might work
  const zapperEndpoints = [
    'https://api.zapper.xyz/v2/graphql',
    'https://api.zapper.fi/v2/graphql',
    'https://public.zapper.xyz/graphql'
  ];
  
  for (const endpoint of zapperEndpoints) {
    console.log(`\nTrying endpoint: ${endpoint}`);
    
    try {
      const response = await axios.post(
        endpoint,
        { query, variables },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': ZAPPER_API_KEY || 'zapper-gallery'
          }
        }
      );
      
      console.log('Response status:', response.status);
      console.log('Response shape:', {
        hasData: !!response.data,
        dataKeys: response.data ? Object.keys(response.data) : []
      });
      
      if (response.data?.errors) {
        console.log('GraphQL errors:', response.data.errors);
        console.log('This endpoint returned errors - trying next endpoint...');
        continue;
      }
      
      if (response.data?.data?.farcasterProfile) {
        const profile = response.data.data.farcasterProfile;
        console.log('Found user:', {
          fid: profile.fid,
          username: profile.username,
          displayName: profile.metadata?.displayName,
          imageUrl: profile.metadata?.imageUrl
        });
        return true;
      } else {
        console.log('No profile data returned');
      }
    } catch (error) {
      console.log(`Error with endpoint ${endpoint}:`, error.message);
      console.log('Response status:', error.response?.status);
      console.log('Response data:', error.response?.data);
    }
  }
  
  return false;
}

// Run the tests
async function runTests() {
  const neynarSuccess = await testNeynarAPI();
  if (!neynarSuccess) {
    const zapperSuccess = await testZapperAPI();
    if (!zapperSuccess) {
      console.log('\nAll endpoints failed. Recommend updating to use Neynar API instead of Zapper.');
    }
  }
}

runTests(); 