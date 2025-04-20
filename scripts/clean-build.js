#!/usr/bin/env node

// Simple clean build script for vercel
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting clean build process...');

// Set environment variables for build
process.env.PUBLIC_URL = '';
process.env.CI = 'false';
process.env.DISABLE_ESLINT_PLUGIN = 'true';

// Ensure we have necessary polyfills
try {
  console.log('📦 Installing required packages...');
  execSync('npm install --save-dev crypto-browserify process', { stdio: 'inherit' });
} catch (e) {
  console.warn('⚠️ Could not install packages:', e);
}

// Run the build
console.log('🔨 Building React application...');
try {
  execSync('react-app-rewired build', { 
    stdio: 'inherit',
    env: {
      ...process.env,
      PUBLIC_URL: '',
      CI: 'false', 
      DISABLE_ESLINT_PLUGIN: 'true'
    }
  });
  console.log('✅ Build completed!');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}

// Ensure the build directory exists
const buildDir = path.join(__dirname, '..', 'build');
if (!fs.existsSync(buildDir)) {
  console.error('❌ Build directory not found!');
  process.exit(1);
}

// Ensure index.html doesn't have unresolved %PUBLIC_URL% placeholders
const indexPath = path.join(buildDir, 'index.html');
if (fs.existsSync(indexPath)) {
  console.log('🔍 Checking index.html for placeholders...');
  let html = fs.readFileSync(indexPath, 'utf8');
  
  if (html.includes('%PUBLIC_URL%')) {
    console.log('🔧 Fixing %PUBLIC_URL% placeholders...');
    html = html.replace(/%PUBLIC_URL%/g, '');
    fs.writeFileSync(indexPath, html);
  }
  
  console.log('✅ Index.html verified.');
} else {
  console.error('❌ index.html not found in build directory!');
}

// Create a simple runtime-config.json
const runtimeConfig = {
  apiUrl: process.env.REACT_APP_API_URL || '/api',
  buildTime: new Date().toISOString()
};

fs.writeFileSync(
  path.join(buildDir, 'runtime-config.json'),
  JSON.stringify(runtimeConfig, null, 2)
);
console.log('✅ Created runtime-config.json');

console.log('🎉 Build process completed successfully!'); 