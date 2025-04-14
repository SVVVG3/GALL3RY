const webpack = require('webpack');

module.exports = function override(config) {
  // Add minimal Node.js polyfills needed for dotenv
  config.resolve.fallback = {
    ...config.resolve.fallback,
    "path": false,
    "fs": false,
    "os": false
  };
  
  return config;
} 