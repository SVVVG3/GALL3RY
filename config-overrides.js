const webpack = require('webpack');

module.exports = function override(config) {
  // Add Node.js polyfills needed for the app
  config.resolve.fallback = {
    ...config.resolve.fallback,
    "path": require.resolve("path-browserify"),
    "fs": false,
    "os": require.resolve("os-browserify/browser"),
    "crypto": require.resolve("crypto-browserify"),
    "stream": require.resolve("stream-browserify"),
    "buffer": require.resolve("buffer/"),
    "http": require.resolve("stream-http"),
    "https": require.resolve("https-browserify"),
    "util": require.resolve("util/"),
    "assert": require.resolve("assert/"),
    "url": require.resolve("url/"),
    "vm": false
  };
  
  // Add buffer polyfill
  config.plugins.push(
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer']
    })
  );
  
  return config;
} 