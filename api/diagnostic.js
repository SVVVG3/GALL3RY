// API endpoint for diagnostics and logging from mobile clients

const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Configure express
const app = express();
app.use(express.json({ limit: '5mb' }));

// Directory for storing logs
const LOGS_DIR = process.env.LOGS_DIR || path.join(process.cwd(), 'diagnostic-logs');

// Create logs directory if it doesn't exist
try {
  if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
  }
} catch (error) {
  console.error('Error creating logs directory:', error);
}

/**
 * Save diagnostic logs to file
 */
app.post('/diagnostic', async (req, res) => {
  try {
    const { logs, clientInfo, timestamp } = req.body;
    
    if (!logs || !Array.isArray(logs)) {
      return res.status(400).json({ error: 'Invalid logs format' });
    }
    
    // Generate unique ID for this log set
    const id = uuidv4();
    const filename = `${id}-${Date.now()}.json`;
    const filePath = path.join(LOGS_DIR, filename);
    
    // Save to file
    const data = {
      id,
      timestamp,
      clientInfo,
      logs,
      meta: {
        ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        receivedAt: new Date().toISOString(),
      }
    };
    
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    
    // Return success with ID
    return res.json({ 
      id, 
      success: true, 
      message: 'Logs saved successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error saving diagnostic logs:', error);
    return res.status(500).json({ 
      error: 'Failed to save logs', 
      message: error.message 
    });
  }
});

/**
 * Get latest diagnostic logs (admin only)
 */
app.get('/diagnostic', async (req, res) => {
  // Simple API key check
  const apiKey = req.headers['x-api-key'];
  const configuredKey = process.env.DIAGNOSTIC_API_KEY;
  
  if (!configuredKey || apiKey !== configuredKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    // Get all log files
    const files = fs.readdirSync(LOGS_DIR)
      .filter(file => file.endsWith('.json'))
      .sort((a, b) => {
        // Sort by creation time (newest first)
        return fs.statSync(path.join(LOGS_DIR, b)).mtime.getTime() - 
               fs.statSync(path.join(LOGS_DIR, a)).mtime.getTime();
      });
    
    // Get count parameter (default 10)
    const count = Math.min(parseInt(req.query.count || 10), 100);
    
    // Get the specified number of files
    const recentFiles = files.slice(0, count);
    
    // Return file info
    return res.json({
      success: true,
      count: recentFiles.length,
      totalLogs: files.length,
      files: recentFiles.map(file => {
        const filePath = path.join(LOGS_DIR, file);
        const stats = fs.statSync(filePath);
        
        try {
          // Try to read file metadata
          const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          return {
            id: data.id,
            filename: file,
            clientInfo: data.clientInfo,
            timestamp: data.timestamp,
            logCount: data.logs.length,
            createdAt: stats.mtime
          };
        } catch (err) {
          // If can't read file, return basic info
          return {
            filename: file,
            createdAt: stats.mtime,
            error: 'Could not read file'
          };
        }
      })
    });
  } catch (error) {
    console.error('Error retrieving diagnostic logs:', error);
    return res.status(500).json({ 
      error: 'Failed to retrieve logs', 
      message: error.message 
    });
  }
});

/**
 * Get specific log file by ID (admin only)
 */
app.get('/diagnostic/:id', async (req, res) => {
  // Simple API key check
  const apiKey = req.headers['x-api-key'];
  const configuredKey = process.env.DIAGNOSTIC_API_KEY;
  
  if (!configuredKey || apiKey !== configuredKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  
  try {
    const { id } = req.params;
    
    // Find file with matching ID
    const files = fs.readdirSync(LOGS_DIR)
      .filter(file => file.startsWith(`${id}-`));
    
    if (files.length === 0) {
      return res.status(404).json({ error: 'Log file not found' });
    }
    
    // Read the file
    const filePath = path.join(LOGS_DIR, files[0]);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    
    return res.json(data);
  } catch (error) {
    console.error('Error retrieving diagnostic log:', error);
    return res.status(500).json({ 
      error: 'Failed to retrieve log', 
      message: error.message 
    });
  }
});

// Export for Vercel serverless functions
module.exports = app; 