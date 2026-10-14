#!/usr/bin/env bash
# ==============================================================================
# FreshRoute OS (PS 03) — Hackathon One-Command Demo Launcher
# Launches both FastAPI MILP Backend (port 8000) and React Vite Frontend (port 5173)
# ==============================================================================

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_ROOT"

# Text styles
BOLD="\033[1m"
GREEN="\033[32m"
BLUE="\033[34m"
YELLOW="\033[33m"
CYAN="\033[36m"
RED="\033[31m"
RESET="\033[0m"

echo -e "${GREEN}${BOLD}====================================================================${RESET}"
echo -e "${GREEN}${BOLD}             FreshRoute OS (PS 03) — Interactive Launcher           ${RESET}"
echo -e "${GREEN}${BOLD}====================================================================${RESET}"

# 1. Resolve Python & Uvicorn environment
PYTHON="python3"
if [ -f "$REPO_ROOT/.venv/bin/python" ]; then
    PYTHON="$REPO_ROOT/.venv/bin/python"
    UVICORN="$REPO_ROOT/.venv/bin/uvicorn"
elif command -v python3 &>/dev/null; then
    PYTHON="python3"
    UVICORN="uvicorn"
elif command -v python &>/dev/null; then
    PYTHON="python"
    UVICORN="uvicorn"
else
    echo -e "${RED}[ERROR] Python 3.11+ is required but not found.${RESET}"
    exit 1
fi

echo -e "${CYAN}[1/4] Checking Python environment (${PYTHON})...${RESET}"
if ! "$PYTHON" -c "import fastapi, scipy, pydantic, numpy, pandas" &>/dev/null; then
    echo -e "${YELLOW}[WARN] Missing required Python packages. Installing from requirements.txt...${RESET}"
    "$PYTHON" -m pip install -r requirements.txt
else
    echo -e "${GREEN}  ✓ Core Python dependencies verified.${RESET}"
fi

# 2. Check and generate benchmark datasets if missing
echo -e "${CYAN}[2/4] Verifying MoFPI benchmark datasets...${RESET}"
if [ ! -f "$REPO_ROOT/datasets/scenario_1_normal_harvest.json" ] || [ ! -f "$REPO_ROOT/datasets/scenario_4_corrupt_batches.csv" ]; then
    echo -e "${YELLOW}  Generating benchmark datasets via datasets/generate_scenarios.py...${RESET}"
    "$PYTHON" "$REPO_ROOT/datasets/generate_scenarios.py"
else
    echo -e "${GREEN}  ✓ MoFPI benchmark datasets present in /datasets/.${RESET}"
fi

# 3. Check and install frontend npm dependencies
echo -e "${CYAN}[3/4] Verifying React Vite frontend dependencies...${RESET}"
if [ ! -d "$REPO_ROOT/frontend/node_modules" ]; then
    echo -e "${YELLOW}  Installing frontend npm dependencies...${RESET}"
    npm --prefix frontend install
else
    echo -e "${GREEN}  ✓ Frontend node_modules verified.${RESET}"
fi

# 4. Process cleanup on exit / SIGINT / SIGTERM
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
    echo -e "\n${YELLOW}[SHUTTING DOWN] Stopping FreshRoute OS servers...${RESET}"
    if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
        echo "  Stopping frontend server (PID $FRONTEND_PID)..."
        kill -SIGTERM "$FRONTEND_PID" 2>/dev/null || true
    fi
    if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
        echo "  Stopping backend server (PID $BACKEND_PID)..."
        kill -SIGTERM "$BACKEND_PID" 2>/dev/null || true
    fi
    echo -e "${GREEN}FreshRoute OS demo gracefully stopped.${RESET}"
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# 5. Launch Backend
echo -e "${CYAN}[4/4] Starting servers...${RESET}"
export PYTHONPATH="$REPO_ROOT"

if [ -f "$UVICORN" ]; then
    "$UVICORN" backend.main:app --host 0.0.0.0 --port 8000 &
    BACKEND_PID=$!
else
    "$PYTHON" -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 &
    BACKEND_PID=$!
fi

# Wait briefly for backend health probe
echo -n "  Waiting for FastAPI to initialize..."
for i in {1..15}; do
    if curl -s http://localhost:8000/api/v1/health | grep -q '"status":"ok"'; then
        echo -e " ${GREEN}Ready!${RESET}"
        break
    fi
    sleep 0.5
    echo -n "."
done

# 6. Launch Frontend
npm --prefix frontend run dev -- --host 0.0.0.0 --port 5173 &
FRONTEND_PID=$!

sleep 1

echo -e "\n${GREEN}${BOLD}====================================================================${RESET}"
echo -e "${GREEN}${BOLD}     🚀 FreshRoute OS is Live & Ready for Hackathon Judges!         ${RESET}"
echo -e "${GREEN}${BOLD}====================================================================${RESET}"
echo -e "  ${BOLD}🖥️  Operator Console (Frontend):${RESET} ${CYAN}${BOLD}http://localhost:5173${RESET}"
echo -e "  ${BOLD}⚡ FastAPI Swagger Docs (API):   ${RESET} ${CYAN}${BOLD}http://localhost:8000/docs${RESET}"
echo -e "  ${BOLD}🩺 Health Probe:                 ${RESET} ${CYAN}${BOLD}http://localhost:8000/api/v1/health${RESET}"
echo -e "  ${BOLD}📦 Default Scenario Endpoint:    ${RESET} ${CYAN}${BOLD}http://localhost:8000/api/v1/default-scenario${RESET}"
echo -e "${GREEN}${BOLD}====================================================================${RESET}"
echo -e "${YELLOW}Press [Ctrl+C] at any time to gracefully terminate all services.${RESET}\n"

# Wait indefinitely until interrupted
wait
