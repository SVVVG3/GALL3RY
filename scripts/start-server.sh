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
  fi
else
  echo "✅ No existing server processes found."
fi

# Make sure port is actually free
if lsof -i:3001 -t >/dev/null; then
  echo "❌ Port 3001 is still in use. Please check processes manually."
  exit 1
fi

# Start the server with proper environment variables
echo "🚀 Starting server..."
exec node -r dotenv/config server.js 