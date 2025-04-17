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
  echo "⚠️ Port 3001 is in use, will try alternative port."
  # Export this so the server knows to try an alternative port
  export PORT_IN_USE=true
  # We'll detect the actual port from the server output
else
  unset PORT_IN_USE
fi

# Create a log file
LOG_FILE="server.log"
echo "$(date): Starting server" > $LOG_FILE

# Verify environment variables
if [ -z "$ALCHEMY_API_KEY" ] && [ -f .env ]; then
  echo "ℹ️ ALCHEMY_API_KEY not set in environment, attempting to load from .env file"
  source .env 2>/dev/null || true
fi

# Run the server and capture its output to parse the actual port
echo "🚀 Starting server..."
node -r dotenv/config server.js > server_output.log 2>&1 &
SERVER_PID=$!

# Wait for server to start and look for port information
echo "⏳ Waiting for server to initialize..."
RETRY=0
MAX_RETRY=15
ACTUAL_PORT=""

while [ $RETRY -lt $MAX_RETRY ]; do
  # Check if server is still running
  if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo "❌ Server failed to start! Check server_output.log for details."
    exit 1
  fi
  
  # Look for the port information in the log
  if grep -q "Server running on port" server_output.log; then
    ACTUAL_PORT=$(grep "Server running on port" server_output.log | sed 's/.*port \([0-9]*\).*/\1/')
    echo "✅ Server started on port: $ACTUAL_PORT"
    break
  fi
  
  RETRY=$((RETRY + 1))
  sleep 1
done

if [ -z "$ACTUAL_PORT" ]; then
  echo "⚠️ Could not detect server port, defaulting to 3001"
  ACTUAL_PORT=3001
fi

# Export the actual port for the runtime config
export ACTUAL_PORT=$ACTUAL_PORT

# Generate runtime config for frontend with the correct port
echo "📝 Generating runtime-config.json for frontend..."
node scripts/generate-runtime-config.js

# Continue displaying server output
cat server_output.log
tail -f server_output.log 