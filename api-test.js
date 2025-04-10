require('dotenv').config();
const axios = require('axios');

// Test Zapper API directly
async function testZapperAPI() {
  console.log('\n--- Testing Zapper API Directly ---');
  
  const apiKey = process.env.ZAPPER_API_KEY || process.env.REACT_APP_ZAPPER_API_KEY;
  
  if (!apiKey) {
    console.error('Error: No Zapper API key found in environment variables');
    process.exit(1);
  }
  
  console.log(`Using Zapper API key: ${apiKey.substring(0, 8)}...`);
  
  const query = `
    query FarcasterProfile($username: String) {
      farcasterProfile(username: $username) {
        username
        fid
        metadata {
          displayName
          description
          imageUrl
        }
        custodyAddress
        connectedAddresses
      }
    }
  `;
  
  try {
    console.log('Making request to Zapper GraphQL API...');
    
    const response = await axios({
      url: 'https://public.zapper.xyz/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-zapper-api-key': apiKey
      },
      data: {
        query,
        variables: { username: "v" }
      },
      timeout: 10000
    });
    
    if (response.data.errors) {
      console.error('GraphQL Errors:', response.data.errors);
      return false;
    }
    
    console.log('Success! Received data:');
    console.log(JSON.stringify(response.data.data, null, 2));
    return true;
  } catch (error) {
    console.error('Error testing Zapper API:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    return false;
  }
}

// Test our API proxy 
async function testOurAPIProxy() {
  console.log('\n--- Testing Our API Proxy ---');
  
  const query = `
    query FarcasterProfile($username: String) {
      farcasterProfile(username: $username) {
        username
        fid
        metadata {
          displayName
          description
          imageUrl
        }
        custodyAddress
        connectedAddresses
      }
    }
  `;
  
  try {
    console.log('Making request to our API proxy...');
    console.log('Request URL: http://localhost:3001/api/zapper');
    
    const response = await axios({
      url: 'http://localhost:3001/api/zapper',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      data: {
        query,
        variables: { username: "v" }
      },
      timeout: 10000
    });
    
    if (response.data.errors) {
      console.error('GraphQL Errors:', response.data.errors);
      return false;
    }
    
    console.log('Success! Received data:');
    console.log(JSON.stringify(response.data.data, null, 2));
    return true;
  } catch (error) {
    console.error('Error testing API proxy:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    } else if (error.request) {
      console.error('No response received. This might indicate the server is not running on port 3001.');
    } else {
      console.error('Error details:', error);
    }
    return false;
  }
}

// Main function to run all tests
async function runTests() {
  console.log('=== GALL3RY API TESTING ===');
  console.log('Testing API connectivity and configuration...');
  
  const zapperDirect = await testZapperAPI();
  const apiProxy = await testOurAPIProxy();
  
  console.log('\n=== TEST RESULTS ===');
  console.log(`Direct Zapper API: ${zapperDirect ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Our API Proxy: ${apiProxy ? '✅ PASSED' : '❌ FAILED'}`);
  
  if (!zapperDirect && !apiProxy) {
    console.log('\n❌ Both API tests failed. Please check your API keys and configuration.');
  } else if (!zapperDirect) {
    console.log('\n⚠️ Direct Zapper API test failed, but our proxy works. This might indicate an environmental issue.');
  } else if (!apiProxy) {
    console.log('\n⚠️ Our API proxy failed, but direct Zapper API works. This indicates an issue with our server implementation.');
  } else {
    console.log('\n✅ All tests passed! Your API setup appears to be working correctly.');
  }
}

// Run the tests
runTests().catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
}); 