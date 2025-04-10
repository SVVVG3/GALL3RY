// Determine the API URL based on the current environment
let apiPort = 3001; // Default port

// Check if the application is running on a different port
// The server will be on 3001, while the client might be on 3002
if (window.location.port === '3002') {
  apiPort = 3001;
}

export const API_URL = `http://localhost:${apiPort}`;

// For debugging
console.log(`Using API URL: ${API_URL}`); 