// Import the main server file and middleware
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import utility functions
const { connectToMongoDB, corsHeaders } = require('./_utils');

// Create Express app
const app = express();

// Configure middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Add middleware to handle CORS preflight requests
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.status(200).set(corsHeaders).end();
    return;
  }
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', version: '1.0.0' });
});

// API endpoint for testing MongoDB connection
app.get('/api/db-status', async (req, res) => {
  try {
    await connectToMongoDB();
    res.status(200).json({ status: 'Database connected' });
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({ status: 'Database connection failed', error: error.message });
  }
});

// Default handler for all serverless API routes
module.exports = async (req, res) => {
  // Log request for debugging
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  try {
    // Return response from Express app
    return app(req, res);
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}; 