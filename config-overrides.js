const webpack = require('webpack');

module.exports = function override(config, env) {
  // Add polyfills for Node.js core modules
  config.resolve.fallback = {
    ...config.resolve.fallback,
    "path": require.resolve("path-browserify"),
    "crypto": require.resolve("crypto-browserify"),
    "stream": require.resolve("stream-browserify"),
    "fs": false,
    "os": require.resolve("os-browserify"),
    "http": require.resolve("stream-http"),
    "https": require.resolve("https-browserify"),
    "buffer": require.resolve("buffer/"),
    "url": require.resolve("url/"),
    "util": require.resolve("util/"),
    "assert": require.resolve("assert/"),
    "process": require.resolve("process/browser"),
  };

  // Add plugins
  config.plugins = [
    ...config.plugins,
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
    }),
  ];

  return config;
}; 