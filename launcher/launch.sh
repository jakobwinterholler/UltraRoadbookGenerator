#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "${SCRIPT_DIR}/common.sh"

start_backend_if_needed
start_frontend_if_needed
open_application

log "Ultra Roadbook Generator is ready at ${APP_URL}"
