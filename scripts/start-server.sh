#!/bin/bash

# This script ensures clean server startup by properly shutting down any existing server instances

echo "🔍 Finding any existing Node.js server processes..."
RUNNING_SERVERS=$(lsof -i:3001 -t)

if [ -n "$RUNNING_SERVERS" ]; then
  echo "🛑 Found existing server processes: $RUNNING_SERVERS"
  echo "🔄 Shutting down gracefully..."
  
  # Try graceful shutdown first
  for PID in $RUNNING_SERVERS; do
    kill $PID 2>/dev/null || true
    echo "  - Sent SIGTERM to process $PID"
  done
  
  # Give processes time to exit
  sleep 2
  
  # Check if any processes are still running
  STILL_RUNNING=$(lsof -i:3001 -t)
  if [ -n "$STILL_RUNNING" ]; then
    echo "⚠️ Processes still running, using force shutdown..."
    for PID in $STILL_RUNNING; do
      kill -9 $PID 2>/dev/null || true
      echo "  - Sent SIGKILL to process $PID"
    done
    
    # Double-check that everything is actually dead
    sleep 1
    FINAL_CHECK=$(lsof -i:3001 -t)
    if [ -n "$FINAL_CHECK" ]; then
      echo "❌ ERROR: Unable to kill all processes. Please manually terminate them:"
      ps -f $FINAL_CHECK
      exit 1
    fi
  fi
else
  echo "✅ No existing server processes found."
fi

# Make sure port is actually free
if lsof -i:3001 -t >/dev/null; then
  echo "❌ Port 3001 is still in use. Please check processes manually."
  exit 1
fi

# Create a log file
LOG_FILE="server.log"
echo "$(date): Starting server" > $LOG_FILE

# Verify environment variables
if [ -z "$ALCHEMY_API_KEY" ] && [ -f .env ]; then
  echo "ℹ️ ALCHEMY_API_KEY not set in environment, attempting to load from .env file"
  source .env 2>/dev/null || true
fi

echo "🚀 Starting server..."
exec node -r dotenv/config server.js 2>&1 | tee -a $LOG_FILE

# Note: exec replaces the current process, so we won't actually reach this point
# The following is only reached if exec fails
echo "❌ Failed to start server" >> $LOG_FILE
exit 1 