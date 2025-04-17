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
  
  // Check if a specific API port is provided
  const apiPort = process.env.API_PORT || process.env.PORT || 3001;
  return `http://localhost:${apiPort}/api`;
};

// Create runtime config
const config = {
  apiUrl: getApiUrl(),
  zapperApiKey: process.env.REACT_APP_ZAPPER_API_KEY || process.env.ZAPPER_API_KEY,
  alchemyApiKey: process.env.REACT_APP_ALCHEMY_API_KEY || process.env.ALCHEMY_API_KEY,
  buildTime: new Date().toISOString()
};

console.log('Generating runtime config:');
console.log(JSON.stringify(config, null, 2));

// Ensure directory exists
const publicDir = path.resolve(__dirname, '../public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Write config to file
const configPath = path.join(publicDir, 'runtime-config.json');
fs.writeFileSync(configPath, JSON.stringify(config, null, 2));

console.log(`Runtime config written to ${configPath}`); 