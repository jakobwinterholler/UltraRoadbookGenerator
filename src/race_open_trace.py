"""Temporary race-open diagnostics. Remove after the freeze is resolved."""

from __future__ import annotations

import sys
from datetime import datetime, timezone


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def race_open_trace(step: str, *, race_id: str | None = None, detail: str | None = None) -> None:
    parts = [f"[race-open] {_now()}", step]
    if race_id:
        parts.append(f"race={race_id}")
    if detail:
        parts.append(detail)
    print(" ".join(parts), file=sys.stderr, flush=True)
