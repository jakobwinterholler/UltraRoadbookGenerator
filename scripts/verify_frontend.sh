#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/frontend"

echo "== Planning hub selection regression =="
npx tsx scripts/test_planning_hub_selection.ts

echo "== Frontend typecheck + build =="
npm run build

echo "Planning hub regression passed."
