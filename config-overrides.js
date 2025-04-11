const webpack = require('webpack');

module.exports = function override(config) {
  // Add polyfills for Node.js core modules
  config.resolve.fallback = {
    ...config.resolve.fallback,
    "buffer": require.resolve("buffer/"),
    "stream": require.resolve("stream-browserify"),
    "util": require.resolve("util/"),
    "crypto": require.resolve("crypto-browserify"),
  };

  // Add the necessary plugins
  config.plugins = [
    ...config.plugins,
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
      process: 'process/browser',
    }),
  ];

  return config;
}; 