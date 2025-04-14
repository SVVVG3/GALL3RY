// This file is used by Vercel to build the project
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Log start of build
console.log('Starting Vercel build process...');

// Apply process/browser patch
console.log('Applying process/browser patch...');
const nodeModulesPath = path.join(__dirname, 'node_modules');

// Create process directory if it doesn't exist
if (!fs.existsSync(path.join(nodeModulesPath, 'process'))) {
  console.log('Installing process package...');
  execSync('npm install process --no-save', { stdio: 'inherit' });
}

// Create browser.js if it doesn't exist
const browserJsPath = path.join(nodeModulesPath, 'process', 'browser.js');
if (!fs.existsSync(browserJsPath)) {
  console.log('Creating process/browser.js polyfill...');
  const browserJsContent = `
    // process/browser.js polyfill
    var process = module.exports = {};
    
    process.nextTick = function (fn) {
      setTimeout(fn, 0);
    };
    
    process.title = 'browser';
    process.browser = true;
    process.env = {};
    process.argv = [];
    process.version = '';
    
    process.on = function () {};
  `;
  
  fs.mkdirSync(path.dirname(browserJsPath), { recursive: true });
  fs.writeFileSync(browserJsPath, browserJsContent.trim());
  console.log('Created process/browser.js polyfill.');
}

// Run the build command
try {
  console.log('Building React app...');
  execSync('CI=false DISABLE_ESLINT_PLUGIN=true react-scripts build', { stdio: 'inherit' });
  console.log('React build complete!');
} catch (error) {
  console.error('Error building React app:', error);
  process.exit(1);
}

// Create the api directory if it doesn't exist
if (!fs.existsSync('./api')) {
  console.log('Creating api directory...');
  fs.mkdirSync('./api', { recursive: true });
}

// Ensure the api/index.js file exists
if (!fs.existsSync('./api/index.js')) {
  console.log('API entry point missing, creating it...');
  
  const apiContent = `
  const express = require('express');
  const cors = require('cors');
  const mongoose = require('mongoose');
  const dotenv = require('dotenv');
  
  // Load environment variables
  dotenv.config();
  
  // Create Express app
  const app = express();
  
  // Configure middleware
  app.use(cors());
  app.use(express.json());
  
  // API endpoints
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });
  
  // Export the Express app as the default handler for Vercel
  module.exports = app;
  `;
  
  fs.writeFileSync('./api/index.js', apiContent.trim());
  console.log('Created API entry point.');
}

console.log('Vercel build process complete!'); 