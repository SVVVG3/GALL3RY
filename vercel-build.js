// This file is used by Vercel to build the project
const { execSync } = require('child_process');
const fs = require('fs');

// Log start of build
console.log('Starting Vercel build process...');

// Run the build command
try {
  console.log('Building React app...');
  execSync('npm run build', { stdio: 'inherit' });
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
  app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
  });
  
  // Export the Express app as the default handler for Vercel
  module.exports = app;
  `;
  
  fs.writeFileSync('./api/index.js', apiContent.trim());
  console.log('Created API entry point.');
}

console.log('Vercel build process complete!'); 