/**
 * Utility script to verify API keys in the environment
 * Run this as a Vercel build step or locally to test API keys
 */

const fetch = require('node-fetch');

// Required environment variables
const REQUIRED_VARS = [
  'ZAPPER_API_KEY',
];

// Flag to track missing variables
let missingVars = false;

// Verify environment variables
console.log('🔑 Verifying environment variables...');
REQUIRED_VARS.forEach(varName => {
  const value = process.env[varName];
  if (!value) {
    console.error(`❌ Missing required environment variable: ${varName}`);
    missingVars = true;
  } else {
    // Mask the key for security
    const maskedValue = value.substring(0, 3) + '...' + value.substring(value.length - 3);
    console.log(`✅ Found ${varName}: ${maskedValue} (length: ${value.length})`);
  }
});

// Exit if any variables are missing
if (missingVars) {
  console.error('❌ Missing required environment variables. Exiting...');
  process.exit(1);
}

// Test Zapper API with the provided key
async function testZapperAPI() {
  const ZAPPER_API_URL = 'https://api.zapper.xyz/v2/graphql';
  const ZAPPER_API_KEY = process.env.ZAPPER_API_KEY;

  // Determine if the key is already in Basic auth format
  const isBasicAuth = ZAPPER_API_KEY.startsWith('Basic ');
  
  // Format the key appropriately 
  const authHeader = isBasicAuth 
    ? ZAPPER_API_KEY 
    : `Basic ${Buffer.from(ZAPPER_API_KEY).toString('base64')}`;
  
  console.log('🔍 Testing Zapper API connection...');
  console.log(`🔑 Using authorization format: ${isBasicAuth ? 'Basic auth' : 'Base64 encoded'}`);
  
  // Simple test query to get a known Farcaster profile (Vitalik)
  const query = `
    query TestQuery {
      farcasterProfile(username: "vitalik") {
        username
        fid
      }
    }
  `;
  
  try {
    const response = await fetch(ZAPPER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': authHeader,
        'X-API-Key': ZAPPER_API_KEY,
        'X-Zapper-API-Key': ZAPPER_API_KEY
      },
      body: JSON.stringify({ query })
    });
    
    console.log(`📡 Zapper API status code: ${response.status}`);
    
    const responseText = await response.text();
    console.log(`📦 Response: ${responseText.substring(0, 200)}${responseText.length > 200 ? '...' : ''}`);
    
    try {
      const data = JSON.parse(responseText);
      
      if (data.errors) {
        console.error('❌ GraphQL errors:', data.errors);
        return false;
      }
      
      if (data.data && data.data.farcasterProfile) {
        console.log(`✅ Successfully fetched Farcaster profile for: ${data.data.farcasterProfile.username} (FID: ${data.data.farcasterProfile.fid})`);
        return true;
      } else {
        console.error('❌ No profile data found in response');
        return false;
      }
    } catch (parseError) {
      console.error('❌ Error parsing response:', parseError);
      return false;
    }
  } catch (error) {
    console.error('❌ Error connecting to Zapper API:', error);
    return false;
  }
}

// Execute tests
async function main() {
  console.log('🚀 Starting API key verification...');
  
  // Test Zapper API
  const zapperSuccess = await testZapperAPI();
  
  if (zapperSuccess) {
    console.log('✅ All API tests passed!');
    process.exit(0);
  } else {
    console.error('❌ API tests failed. Please check your API keys and configuration.');
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
}); 