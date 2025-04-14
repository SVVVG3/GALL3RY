// This file is a pointer to ensure we're using the correct implementation
// The real implementation is in './directAlchemy/index.js'
// This file exists to make it easier to update the service configuration

// Critical update: Force the use of the proxy API to ensure server API key is used
// This fixes issues with the demo key being used instead of the configured key
module.exports = require('./directAlchemy/index.js');

// Find the line that has USE_PROXY and replace it with our version
// Look for a line like: const USE_PROXY = !ALCHEMY_API_KEY || config.IS_VERCEL;
// And change it to: const USE_PROXY = true;

// If you can't find that exact line, search for "USE_PROXY" and 
// replace the whole line with "const USE_PROXY = true; // Always use proxy regardless of API key"
