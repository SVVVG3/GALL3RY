// Custom build script for Vercel
const fs = require('fs');
const path = require('path');

console.log('🔧 Running custom Vercel build script...');

// Function to load environment variables from .env file
function loadEnvFile(filename) {
  try {
    if (fs.existsSync(filename)) {
      console.log(`📝 Loading environment variables from ${filename}`);
      const envConfig = require('dotenv').parse(fs.readFileSync(filename));
      
      for (const key in envConfig) {
        // Don't override existing env vars
        if (!process.env[key]) {
          process.env[key] = envConfig[key];
          console.log(`✅ Set ${key} from ${filename}`);
        } else {
          console.log(`⏭️ Skipping ${key} - already set from Vercel config`);
        }
      }
    } else {
      console.log(`⚠️ ${filename} file not found, skipping`);
    }
  } catch (error) {
    console.error(`❌ Error loading ${filename}:`, error.message);
  }
}

// Load environment variables from files in order
loadEnvFile('.env');
loadEnvFile('.env.production');

// Verify essential keys are present
const requiredKeys = [
  'ZAPPER_API_KEY',
  'ALCHEMY_API_KEY',
  'REACT_APP_ZAPPER_API_KEY',
  'REACT_APP_ALCHEMY_API_KEY'
];

let missingKeys = false;
requiredKeys.forEach(key => {
  if (!process.env[key]) {
    console.error(`❌ Missing required environment variable: ${key}`);
    missingKeys = true;
  } else {
    // Mask all but first few characters for logging
    const value = process.env[key];
    const maskedValue = value.substring(0, 4) + '...' + value.substring(value.length - 4);
    console.log(`✅ Found ${key}: ${maskedValue}`);
  }
});

if (missingKeys) {
  console.warn('⚠️ Some required environment variables are missing. Deployment may fail!');
} else {
  console.log('✅ All required environment variables are present');
}

// Create a runtime config file with the API URLs
// This is useful because the REACT_APP_ prefix only works at build time
const runtimeConfig = {
  apiUrl: process.env.NODE_ENV === 'production' 
    ? 'https://gall3ry.vercel.app/api'
    : 'http://localhost:3001/api',
  zapperApiKey: process.env.REACT_APP_ZAPPER_API_KEY,
  alchemyApiKey: process.env.REACT_APP_ALCHEMY_API_KEY,
  buildTime: new Date().toISOString()
};

const runtimeConfigPath = path.join(__dirname, '../public/runtime-config.json');
fs.writeFileSync(
  runtimeConfigPath, 
  JSON.stringify(runtimeConfig, null, 2),
  'utf8'
);

console.log(`📝 Created runtime config at ${runtimeConfigPath}`);
console.log('🎉 Custom Vercel build script completed successfully');

// Continue with normal build process 