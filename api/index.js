// This is the main entry point for API requests from Vercel
// It simply forwards requests to the all-in-one.js handler

import allInOne from './all-in-one.js';

// Export the handler directly for Vercel serverless functions
export default allInOne; 