#!/usr/bin/env node

/**
 * Simple script to test the GALL3RY API deployment on Vercel
 * Run with: node test-vercel-deployment.js <your-deployment-url>
 * Example: node test-vercel-deployment.js https://gall3ry.vercel.app
 */

const https = require('https');

// Get URL from command line or use default
const baseUrl = process.argv[2] || 'https://gall3ry.vercel.app';

console.log(`Testing GALL3RY deployment at: ${baseUrl}`);

// Endpoints to test
const endpoints = [
  '/api/health',
  '/api/db-status',
];

// Function to make HTTP requests
function makeRequest(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const { statusCode } = res;
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(data);
          resolve({ statusCode, data: parsedData });
        } catch (e) {
          reject(new Error(`Invalid JSON response: ${data}`));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

// Test each endpoint
async function runTests() {
  console.log('Starting API tests...\n');
  
  for (const endpoint of endpoints) {
    const url = `${baseUrl}${endpoint}`;
    console.log(`Testing: ${url}`);
    
    try {
      const { statusCode, data } = await makeRequest(url);
      console.log(`Status: ${statusCode}`);
      console.log(`Response: ${JSON.stringify(data, null, 2)}`);
      
      if (statusCode === 200) {
        console.log('✅ Test passed!\n');
      } else {
        console.log('❌ Test failed: Unexpected status code\n');
      }
    } catch (error) {
      console.error(`❌ Test failed: ${error.message}\n`);
    }
  }
  
  console.log('All tests completed.');
}

// Run the tests
runTests().catch(err => {
  console.error('Error running tests:', err);
  process.exit(1);
}); 