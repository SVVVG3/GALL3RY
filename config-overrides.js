// Simple webpack configuration overrides for polyfills
const webpack = require('webpack');
const path = require('path');

module.exports = function override(config) {
  // Add fallbacks for Node.js core modules
  config.resolve.fallback = {
    ...config.resolve.fallback,
    "crypto": require.resolve("crypto-browserify"),
    "stream": require.resolve("stream-browserify"),
    "buffer": require.resolve("buffer"),
    "os": require.resolve("os-browserify/browser"),
    "path": require.resolve("path-browserify"),
    "fs": false,
    "process": require.resolve("process/browser")
  };
  
  // Add alias for process/browser to handle process in ESM
  config.resolve.alias = {
    ...config.resolve.alias,
    "process/browser": require.resolve("process/browser")
  };
  
  // Add plugins for global polyfills
  config.plugins.push(
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
    })
  );
  
  return config;
}; 