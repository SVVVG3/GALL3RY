#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Determine environment
const isDev = process.env.NODE_ENV !== 'production';

// Get API URL based on environment
const getApiUrl = () => {
  if (!isDev && process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // Check if a specific API port is provided or if we're using an alternative port
  const apiPort = process.env.API_PORT || process.env.PORT || 3001;
  const actualPort = process.env.ACTUAL_PORT || apiPort;
  
  // This happens if the default port is in use and the server switches to an alternative
  return `http://localhost:${actualPort}/api`;
};

// Create runtime config - IMPORTANT: DO NOT include API keys here!
const config = {
  apiUrl: getApiUrl(),
  // Remove API keys from client-side config for security
  buildTime: new Date().toISOString()
};

console.log('Generating runtime config:');
// Only log partial info for security
console.log(JSON.stringify({
  apiUrl: config.apiUrl,
  buildTime: config.buildTime
}, null, 2));

// Ensure directory exists
const publicDir = path.resolve(__dirname, '../public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Write config to file
const configPath = path.join(publicDir, 'runtime-config.json');
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

console.log(`Runtime config written to ${configPath}`); 