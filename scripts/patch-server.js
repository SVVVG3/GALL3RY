#!/usr/bin/env node

// This script patches the server.js file to ensure it uses the correct bridge file for local development
// While keeping Vercel deployment compatibility
const fs = require('fs');
const path = require('path');

const serverPath = path.resolve(__dirname, '../server.js');

// Read the current server.js content
console.log('Patching server.js for local development...');
let serverContent = fs.readFileSync(serverPath, 'utf8');

// Look for either the index.js import
const hasIndexImport = serverContent.includes("require('./api/index.js')");
const hasBridgeImport = serverContent.includes("require('./api/vercel-local-bridge.js')");
const hasTryCatchAroundIndex = serverContent.includes("try {") && 
                               serverContent.includes("require('./api/index.js')") && 
                               serverContent.includes("} catch (error) {");

// Only make changes if we don't have proper try-catch yet
if (hasIndexImport && !hasTryCatchAroundIndex) {
  console.log('Updating server.js to use vercel-local-bridge.js as fallback...');
  
  // Extract the API routes import line and the line after it
  const importPattern = /const\s+apiRoutes\s*=\s*require\(['"]\.\/api\/index\.js['"]\);.*?\n/;
  const match = serverContent.match(importPattern);
  
  if (match) {
    const importLine = match[0];
    // Replace the simple import with a try-catch block that falls back to vercel-local-bridge.js
    const newImportCode = `// Try to import API routes - first try index.js for Vercel, then fallback to bridge for local dev
try {
  var apiRoutes = require('./api/index.js');
  console.log("Successfully loaded API routes from index.js");
} catch (error) {
  console.error("Error loading API routes from index.js:", error.message);
  // Fallback to bridge file for local development
  try {
    var apiRoutes = require('./api/vercel-local-bridge.js');
    console.log("Successfully loaded API routes from vercel-local-bridge.js");
  } catch (bridgeError) {
    console.error("Failed to load bridge file too:", bridgeError.message);
    // Fallback to empty router
    const express = require('express');
    var apiRoutes = express.Router();
    
    // Add an error route
    apiRoutes.all('*', (req, res) => {
      res.status(500).json({
        error: 'API Routes Not Loaded',
        message: 'Failed to load API routes: ' + error.message
      });
    });
  }
}

`;

    // Replace the import line with our new try-catch block
    serverContent = serverContent.replace(importLine, newImportCode);
    
    // Write the patched file
    fs.writeFileSync(serverPath, serverContent);
    console.log('Server.js has been patched successfully for Vercel compatibility.');
  } else {
    console.log('Warning: Could not find expected import pattern in server.js.');
  }
} else if (hasBridgeImport || hasTryCatchAroundIndex) {
  console.log('Server.js already has proper error handling for imports, no patching needed.');
} else {
  console.log('Warning: Could not find expected import pattern in server.js. Manual inspection required.');
}

// Create a backup of the original server.js if it doesn't exist
const backupPath = path.resolve(__dirname, '../server.js.original');
if (!fs.existsSync(backupPath)) {
  console.log('Creating backup of original server.js...');
  fs.copyFileSync(serverPath, backupPath);
  console.log(`Backup created at ${backupPath}`);
}

console.log('Patch process completed.'); 