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
  // Use the official Zapper API GraphQL endpoint
  const ZAPPER_API_URL = 'https://public.zapper.xyz/graphql';
  
  const ZAPPER_API_KEY = process.env.ZAPPER_API_KEY;

  console.log('🔍 Testing Zapper API connection...');
  
  // Simple test query to get fungible token info - simpler query that doesn't require special permissions
  const query = `
    query TestSimpleQuery {
      fungibleToken(address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", network: ETHEREUM_MAINNET) {
        id
        address
        name
        symbol
        decimals
        imageUrlV2
      }
    }
  `;
  
  try {
    console.log(`🔑 Testing with correct auth format from docs: x-zapper-api-key: ${ZAPPER_API_KEY.substring(0, 5)}...`);
    
    const response = await fetch(ZAPPER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-zapper-api-key': ZAPPER_API_KEY
      },
      body: JSON.stringify({ query })
    });
    
    console.log(`📡 Status code: ${response.status}`);
    
    const responseText = await response.text();
    console.log(`📦 Response: ${responseText.substring(0, 300)}${responseText.length > 300 ? '...' : ''}`);
    
    try {
      const data = JSON.parse(responseText);
      
      if (data.errors) {
        console.error('❌ GraphQL errors:', data.errors);
        return false;
      }
      
      if (data.data && data.data.fungibleToken) {
        console.log(`✅ Successfully fetched token: ${data.data.fungibleToken.name} (${data.data.fungibleToken.symbol})`);
        console.log(`\n🔍 SUCCESSFUL CONFIGURATION:\n- URL: ${ZAPPER_API_URL}\n- Auth Header: x-zapper-api-key`);
        return true;
      }
      
      // Check if we have partial success
      if (data.data) {
        console.log('⚠️ Received data but no token information. API connection seems to work but the query might be incorrect.');
        console.log('Data received:', JSON.stringify(data.data, null, 2));
        return true;
      }
      
      console.error('❌ No data in response');
      return false;
    } catch (parseError) {
      console.error('❌ Error parsing response:', parseError);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error with Zapper API: ${error.message}`);
    return false;
  }
}

// Try the account query that matches the schema
async function testAccountQuery() {
  const ZAPPER_API_URL = 'https://public.zapper.xyz/graphql';
  const ZAPPER_API_KEY = process.env.ZAPPER_API_KEY;
  
  console.log('\n🔍 Testing accounts query based on schema...');
  
  // Query based on the schema provided
  const query = `
    query GetAccount {
      account(address: "0xd8da6bf26964af9d7eed9e03e53415d37aa96045") {
        address
        displayName {
          value
          source
        }
        avatar {
          source
        }
        farcasterProfile {
          username
          fid
          connectedAddresses
          custodyAddress
        }
      }
    }
  `;
  
  try {
    const response = await fetch(ZAPPER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-zapper-api-key': ZAPPER_API_KEY
      },
      body: JSON.stringify({ query })
    });
    
    console.log(`📡 Status code: ${response.status}`);
    
    const responseText = await response.text();
    console.log(`📦 Response: ${responseText.substring(0, 300)}${responseText.length > 300 ? '...' : ''}`);
    
    try {
      const data = JSON.parse(responseText);
      
      if (data.errors) {
        console.error('❌ GraphQL errors:', data.errors);
        return false;
      }
      
      if (data.data && data.data.account) {
        console.log(`✅ Successfully fetched account data`);
        return true;
      }
      
      console.error('❌ No account found in response');
      return false;
    } catch (parseError) {
      console.error('❌ Error parsing response:', parseError);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error with account query: ${error.message}`);
    return false;
  }
}

// Execute tests
async function main() {
  console.log('🚀 Starting API key verification...');
  
  // Test Zapper API with a simple query first
  const simpleSuccess = await testZapperAPI();
  
  // If the simple test succeeds, try the accounts query
  let accountSuccess = false;
  if (simpleSuccess) {
    accountSuccess = await testAccountQuery();
  }
  
  if (simpleSuccess) {
    console.log('✅ Basic API test passed! Zapper API key is valid for simple queries.');
    
    if (accountSuccess) {
      console.log('✅ Account query test passed! Zapper API key has permission to fetch account data.');
    } else {
      console.log('⚠️ Account query test failed. Your API key may not have permission to fetch account data.');
    }
    
    console.log('\n🔧 UPDATE YOUR CODE: Use the API endpoint "https://public.zapper.xyz/graphql" with header "x-zapper-api-key"');
    process.exit(0);
  } else {
    console.error('❌ All API tests failed. Please check your API key and configuration.');
    console.error('\n🔧 Possible issues:');
    console.error('1. Your API key may be invalid or expired');
    console.error('2. The Zapper API may be experiencing issues');
    console.error('3. Try using cURL to test directly:');
    console.error(`   curl -X POST -H "Content-Type: application/json" -H "x-zapper-api-key: YOUR_KEY" --data '{"query":"{ fungibleToken(address: \\"0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2\\", network: ETHEREUM_MAINNET) { name symbol } }"}' https://public.zapper.xyz/graphql`);
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error('❌ Unhandled error:', error);
  process.exit(1);
}); 