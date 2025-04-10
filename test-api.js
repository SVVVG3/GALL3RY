const axios = require('axios');

// Test connection to API server
async function testApiConnection() {
  try {
    console.log('Testing connection to API server...');
    const response = await axios.get('http://localhost:3001/health');
    console.log('API server response:', response.data);
    return true;
  } catch (error) {
    console.error('API server connection error:', error.message);
    return false;
  }
}

// Test Zapper GraphQL API
async function testZapperApi() {
  try {
    console.log('\nTesting Zapper API...');
    const response = await axios({
      url: 'http://localhost:3001/api/zapper',
      method: 'post',
      data: {
        query: `
          query GetFarcasterProfile($username: String) {
            farcasterProfile(username: $username) {
              fid
              username
            }
          }
        `,
        variables: {
          username: 'vitalik.eth'
        },
      },
    });
    
    console.log('Zapper API response:', JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    console.error('Zapper API error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    return false;
  }
}

// Run tests
async function runTests() {
  const apiConnected = await testApiConnection();
  
  if (apiConnected) {
    await testZapperApi();
  }
  
  console.log('\nTest summary:');
  console.log('- API server connection:', apiConnected ? '✅ Connected' : '❌ Failed');
}

runTests(); 