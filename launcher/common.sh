#!/usr/bin/env bash

set -euo pipefail

export PATH="/usr/local/bin:/opt/homebrew/bin:${PATH}"

if [[ -n "${ULTRA_ROADBOOK_ROOT:-}" ]]; then
  PROJECT_ROOT="$(cd "${ULTRA_ROADBOOK_ROOT}" && pwd)"
else
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
fi

RUN_DIR="${PROJECT_ROOT}/.run"
BACKEND_PID_FILE="${RUN_DIR}/backend.pid"
FRONTEND_PID_FILE="${RUN_DIR}/frontend.pid"
BACKEND_LOG="${RUN_DIR}/backend.log"
FRONTEND_LOG="${RUN_DIR}/frontend.log"
APP_URL="http://127.0.0.1:5173"
BACKEND_URL="http://127.0.0.1:8000/api/health"

mkdir -p "${RUN_DIR}"

log() {
  printf '%s\n' "$*"
}

is_pid_running() {
  local pid="$1"
  kill -0 "${pid}" 2>/dev/null
}

port_pids() {
  local port="$1"
  lsof -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true
}

is_backend_ready() {
  curl -sf "${BACKEND_URL}" >/dev/null 2>&1
}

is_frontend_ready() {
  curl -sf "${APP_URL}" >/dev/null 2>&1
}

wait_for_backend() {
  local attempts=60
  local index=0
  while (( index < attempts )); do
    if is_backend_ready; then
      return 0
    fi
    sleep 0.5
    index=$((index + 1))
  done
  return 1
}

wait_for_frontend() {
  local attempts=60
  local index=0
  while (( index < attempts )); do
    if is_frontend_ready; then
      return 0
    fi
    sleep 0.5
    index=$((index + 1))
  done
  return 1
}

find_python() {
  if command -v python3 >/dev/null 2>&1; then
    command -v python3
    return 0
  fi
  return 1
}

find_npm() {
  if command -v npm >/dev/null 2>&1; then
    command -v npm
    return 0
  fi

  if [[ -x "${HOME}/.nvm/versions/node/$(ls "${HOME}/.nvm/versions/node" 2>/dev/null | tail -1)/bin/npm" ]]; then
    echo "${HOME}/.nvm/versions/node/$(ls "${HOME}/.nvm/versions/node" | tail -1)/bin/npm"
    return 0
  fi

  return 1
}

ensure_frontend_dependencies() {
  local npm_bin="$1"
  if [[ ! -d "${PROJECT_ROOT}/frontend/node_modules" ]]; then
    log "Installing frontend dependencies..."
    (cd "${PROJECT_ROOT}/frontend" && "${npm_bin}" install)
  fi
}

start_backend_if_needed() {
  if is_backend_ready; then
    log "Backend already running."
    return 0
  fi

  if [[ -f "${BACKEND_PID_FILE}" ]]; then
    local existing_pid
    existing_pid="$(cat "${BACKEND_PID_FILE}")"
    if is_pid_running "${existing_pid}"; then
      log "Waiting for existing backend process..."
      wait_for_backend
      return 0
    fi
  fi

  local python_bin
  python_bin="$(find_python)" || {
    log "python3 not found."
    return 1
  }

  log "Starting backend..."
  (
    cd "${PROJECT_ROOT}"
    PYTHONPATH=src "${python_bin}" -m uvicorn server:app --reload --host 127.0.0.1 --port 8000
  ) >>"${BACKEND_LOG}" 2>&1 &
  echo $! >"${BACKEND_PID_FILE}"

  wait_for_backend || {
    log "Backend failed to start. See ${BACKEND_LOG}"
    return 1
  }
  log "Backend started."
}

start_frontend_if_needed() {
  if is_frontend_ready; then
    log "Frontend already running."
    return 0
  fi

  if [[ -f "${FRONTEND_PID_FILE}" ]]; then
    local existing_pid
    existing_pid="$(cat "${FRONTEND_PID_FILE}")"
    if is_pid_running "${existing_pid}"; then
      log "Waiting for existing frontend process..."
      wait_for_frontend
      return 0
    fi
  fi

  local npm_bin
  npm_bin="$(find_npm)" || {
    log "npm not found."
    return 1
  }

  ensure_frontend_dependencies "${npm_bin}"

  log "Starting frontend..."
  (
    cd "${PROJECT_ROOT}/frontend"
    "${npm_bin}" run dev -- --host 127.0.0.1 --port 5173
  ) >>"${FRONTEND_LOG}" 2>&1 &
  echo $! >"${FRONTEND_PID_FILE}"

  wait_for_frontend || {
    log "Frontend failed to start. See ${FRONTEND_LOG}"
    return 1
  }
  log "Frontend ready."
}

open_application() {
  if [[ -d "/Applications/Google Chrome.app" ]]; then
    open -a "Google Chrome" "${APP_URL}"
    return 0
  fi

  open "${APP_URL}"
}
