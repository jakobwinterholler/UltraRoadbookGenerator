#!/usr/bin/env bash
# Run the Ultra Roadbook Generator locally (API + frontend dev server).
# Prefer the Desktop launchers installed via launcher/install-desktop-apps.sh.

set -e
cd "$(dirname "$0")"

echo "Starting API on http://127.0.0.1:8000"
PYTHONPATH=src uvicorn server:app --reload --host 127.0.0.1 --port 8000 &
API_PID=$!

echo "Starting frontend on http://127.0.0.1:5173"
cd frontend && npm run dev -- --host 127.0.0.1 --port 5173 &
WEB_PID=$!

trap "kill $API_PID $WEB_PID 2>/dev/null" EXIT
wait
