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
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', version: '1.0.0' });
});

// API endpoint for testing MongoDB connection
app.get('/db-status', async (req, res) => {
  try {
    await connectToMongoDB();
    res.status(200).json({ status: 'Database connected' });
  } catch (error) {
    console.error('Database connection error:', error);
    res.status(500).json({ status: 'Database connection failed', error: error.message });
  }
});

// Handler for serverless API routes on Vercel
module.exports = (req, res) => {
  // Log request for debugging
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  
  // Extract path from URL for correct routing
  const url = new URL(req.url, `https://${req.headers.host}`);
  req.url = url.pathname;
  
  // Process the request with Express
  return app(req, res);
}; 