#!/bin/bash

# ============================================================
# Run All — เปิดทุกอย่างด้วยคำสั่งเดียว
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}══════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Virtual Scroll Benchmark Suite${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════${NC}"
echo ""

# ---------- Cleanup Function ----------
cleanup() {
  echo ""
  echo -e "${YELLOW}🛑 Shutting down all servers...${NC}"
  
  # Kill background processes
  if [ ! -z "$PID1" ]; then kill $PID1 2>/dev/null; fi
  if [ ! -z "$PID2" ]; then kill $PID2 2>/dev/null; fi
  if [ ! -z "$PID3" ]; then kill $PID3 2>/dev/null; fi
  
  echo -e "${GREEN}✅ All servers stopped.${NC}"
  exit 0
}

# Trap Ctrl+C
trap cleanup SIGINT SIGTERM

# ---------- Step 1: CLI Benchmark ----------
echo -e "${YELLOW}📊 Step 1: Running CLI Benchmark...${NC}"
echo ""

if command -v node &> /dev/null; then
  node benchmark.js
else
  echo -e "${RED}❌ Node.js not found. Skipping benchmark.${NC}"
fi

echo ""
echo -e "${BLUE}──────────────────────────────────────────────────────${NC}"
echo ""

# ---------- Step 2: Start Servers ----------
echo -e "${GREEN}🚀 Step 2: Starting Live Servers...${NC}"
echo ""

# Check if live-server is installed
if ! command -v npx &> /dev/null; then
  echo -e "${RED}❌ npx not found. Please install Node.js.${NC}"
  exit 1
fi

# Start Dashboard (port 3000)
echo -e "${GREEN}  📊 Dashboard    → http://localhost:3000${NC}"
npx live-server --port=3000 --quiet &
PID1=$!
sleep 1

# Start Virtual Scroll (port 3002)
echo -e "${GREEN}  🟢 Virtual Scroll → http://localhost:3002${NC}"
npx live-server --port=3002 --open=phase2-virtual.html --quiet &
PID2=$!
sleep 1

echo ""
echo -e "${BLUE}══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ All services running!${NC}"
echo ""
echo -e "  ${BLUE}📊 Dashboard:${NC}    http://localhost:3000"
echo -e "  ${BLUE}🟢 Virtual:${NC}      http://localhost:3002"
echo ""
echo -e "  ${YELLOW}💡 Press Ctrl+C to stop all servers${NC}"
echo -e "${BLUE}══════════════════════════════════════════════════════${NC}"
echo ""

# Wait for all background processes
wait