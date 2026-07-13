#!/usr/bin/env bash
# Fail fast if backend modules cannot import or race-creation regressions fail.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Compiling backend sources..."
PYTHONPATH=src python3 -m compileall -q src

echo "Running race creation regression tests..."
PYTHONPATH=src python3 -m unittest tests.test_race_creation_flow -v

echo "Backend verification passed."
