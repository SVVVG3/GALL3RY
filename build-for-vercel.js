#!/usr/bin/env node

/**
 * Custom build script for Vercel deployment
 * This script ensures all necessary polyfills are available
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Utility to run a command and inherit stdio
function runCommand(command) {
  console.log(`Running: ${command}`);
  const [cmd, ...args] = command.split(' ');
  const result = spawnSync(cmd, args, { 
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, DISABLE_ESLINT_PLUGIN: 'true', CI: 'false' }
  });
  
  if (result.status !== 0) {
    console.error(`Command '${command}' failed with status ${result.status}`);
    process.exit(result.status);
  }
  return result;
}

// Ensure all dependencies are installed
console.log('Installing polyfill dependencies...');
runCommand('npm install --no-save crypto-browserify process buffer stream-browserify path-browserify os-browserify url util assert stream-http https-browserify');

// Create a temporary webpack config that will be used during the build
const tempConfigPath = path.join(__dirname, 'webpack.config.temp.js');
const webpackConfigContent = `
const webpack = require('webpack');

module.exports = function override(config) {
  // Add polyfills for Node.js core modules
  config.resolve.fallback = {
    ...config.resolve.fallback,
    "crypto": require.resolve("crypto-browserify"),
    "stream": require.resolve("stream-browserify"),
    "buffer": require.resolve("buffer"),
    "os": require.resolve("os-browserify/browser"),
    "path": require.resolve("path-browserify"),
    "fs": false,
    "http": require.resolve("stream-http"),
    "https": require.resolve("https-browserify"),
    "assert": require.resolve("assert/"),
    "url": require.resolve("url/"),
    "util": require.resolve("util/"),
    "process": require.resolve("process/browser"),
  };
  
  // Add plugins for polyfills
  config.plugins.push(
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
    })
  );
  
  return config;
};
`;

// Write the temporary config file
fs.writeFileSync(tempConfigPath, webpackConfigContent);
console.log('Created temporary webpack config for build');

try {
  // Build the React app using the temporary config
  console.log('Building React app...');
  process.env.REACT_APP_WEBPACK_CONFIG = tempConfigPath;
  runCommand('react-app-rewired build');
  console.log('Build completed successfully!');
} finally {
  // Clean up the temporary config file
  if (fs.existsSync(tempConfigPath)) {
    fs.unlinkSync(tempConfigPath);
    console.log('Cleaned up temporary webpack config');
  }
}

// Copy the build output for Vercel
console.log('Build process complete'); 