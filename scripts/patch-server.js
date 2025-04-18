#!/usr/bin/env node

// This script patches the server.js file to ensure it loads the correct API module format
const fs = require('fs');
const path = require('path');

const serverPath = path.resolve(__dirname, '../server.js');

// Read the current server.js content
console.log('Patching server.js to fix module compatibility...');
let serverContent = fs.readFileSync(serverPath, 'utf8');

// Look for either the index.js import or the vercel-local-bridge import
const hasIndexImport = serverContent.includes("require('./api/index.js')");
const hasBridgeImport = serverContent.includes("require('./api/vercel-local-bridge.js')");

// Check if we need to make changes
if (hasIndexImport) {
  console.log('Updating index.js import to use index.cjs...');
  // Replace index.js with index.cjs
  serverContent = serverContent.replace(
    "require('./api/index.js')",
    "require('./api/index.cjs')"
  );
  
  // Update the comment to indicate the change
  serverContent = serverContent.replace(
    "// Import API routes from api/index.js",
    "// Import API routes from api/index.cjs (CommonJS compatible)"
  );
  
  // Write the patched file
  fs.writeFileSync(serverPath, serverContent);
  console.log('Server.js has been patched successfully.');
} else if (hasBridgeImport) {
  console.log('Server.js is already using vercel-local-bridge.js, no patching needed.');
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