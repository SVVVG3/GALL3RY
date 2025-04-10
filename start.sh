#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Print header
echo -e "${BOLD}==== GALL3RY NFT App Starter ====${NC}"
echo

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is not installed. Please install Node.js first.${NC}"
    exit 1
fi

# Function to check if a port is in use
port_in_use() {
    lsof -i:$1 &> /dev/null
}

# Check if the API server port is already in use
if port_in_use 3001; then
    echo -e "${YELLOW}Warning: Port 3001 is already in use.${NC}"
    echo -e "This may mean the API server is already running, or another application is using this port."
    echo -e "If the API is not working, try killing the process using port 3001:"
    echo -e "  ${BOLD}lsof -ti:3001 | xargs kill -9${NC}"
    echo
else
    # Start the API server
    echo -e "${GREEN}Starting API server on port 3001...${NC}"
    echo -e "${YELLOW}This window will show API server logs.${NC}"
    echo -e "${YELLOW}Press Ctrl+C to stop the server.${NC}"
    echo
    
    # Run the API server
    node server.js
fi 