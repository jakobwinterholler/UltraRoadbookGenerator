#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

stop_pid_file() {
  local pid_file="$1"
  local label="$2"

  if [[ ! -f "${pid_file}" ]]; then
    return 0
  fi

  local pid
  pid="$(cat "${pid_file}")"
  if is_pid_running "${pid}"; then
    log "Stopping ${label} (pid ${pid})..."
    kill "${pid}" 2>/dev/null || true

    local attempts=20
    local index=0
    while is_pid_running "${pid}" && (( index < attempts )); do
      sleep 0.25
      index=$((index + 1))
    done

    if is_pid_running "${pid}"; then
      kill -9 "${pid}" 2>/dev/null || true
    fi
  fi

  rm -f "${pid_file}"
}

stop_port() {
  local port="$1"
  local label="$2"
  local pids
  pids="$(port_pids "${port}")"

  if [[ -z "${pids}" ]]; then
    return 0
  fi

  log "Stopping ${label} on port ${port}..."
  # shellcheck disable=SC2068
  kill ${pids} 2>/dev/null || true
}

stop_pid_file "${FRONTEND_PID_FILE}" "frontend"
stop_pid_file "${BACKEND_PID_FILE}" "backend"
stop_port 5173 "frontend"
stop_port 8000 "backend"

log "Ultra Roadbook Generator stopped."
