"""Stable checksum for companion bundle content validation."""

from __future__ import annotations

import hashlib
import json
from typing import Any

VOLATILE_BUNDLE_FIELDS = frozenset({"syncedAt", "bundleChecksum", "exportedAt"})


def canonical_bundle_payload(bundle: dict[str, Any]) -> dict[str, Any]:
    """Return bundle dict without volatile timestamp/checksum fields."""
    return {key: value for key, value in bundle.items() if key not in VOLATILE_BUNDLE_FIELDS}


def compute_bundle_checksum(bundle: dict[str, Any]) -> str:
    """SHA-256 hex digest of canonical bundle JSON (stable across re-exports)."""
    payload = canonical_bundle_payload(bundle)
    canonical = json.dumps(payload, separators=(",", ":"), sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
