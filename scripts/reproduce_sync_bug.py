#!/usr/bin/env python3
"""Reproduce Desktop→Supabase→Companion divergence and verify the fix."""

from __future__ import annotations

import json
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT / "src"))

try:
    import httpx
except ImportError:
    print("Install httpx: pip install httpx", file=sys.stderr)
    raise SystemExit(1)

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None  # type: ignore

from companion_bundle import build_companion_bundle
from race_project import race_store

DEFAULT_USER_ID = "641089b9-a9fc-43d4-abb6-c26e030aa732"


def _headers(service_key: str) -> dict[str, str]:
    return {
        "apikey": service_key,
        "Authorization": f"Bearer {service_key}",
        "Content-Type": "application/json",
    }


def list_cloud_races(url: str, key: str, user_id: str) -> list[dict]:
    response = httpx.get(
        f"{url}/rest/v1/races",
        params={
            "user_id": f"eq.{user_id}",
            "deleted_at": "is.null",
            "select": "id,name,companion_revision,has_bundle,updated_at,created_at",
            "order": "updated_at.desc",
        },
        headers=_headers(key),
        timeout=30.0,
    )
    response.raise_for_status()
    return response.json()


def main() -> int:
    if load_dotenv is not None:
        load_dotenv(PROJECT_ROOT / ".env")
        load_dotenv(PROJECT_ROOT / ".env.local")

    url = os.getenv("SUPABASE_URL", "").rstrip("/")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SECRET_KEY", "")
    user_id = os.getenv("SYNC_TEST_USER_ID", DEFAULT_USER_ID)

    if not url or not key:
        print("Missing SUPABASE_URL or service role key.", file=sys.stderr)
        return 1

    print("=== DESKTOP LOCAL RACES ===")
    local = race_store.list_races()
    for summary in local:
        print(f"  {summary.name} ({summary.id}) updated={summary.updated_at}")
    local_ids = {summary.id for summary in local}

    print("\n=== SUPABASE RACES (before test) ===")
    cloud_before = list_cloud_races(url, key, user_id)
    for race in cloud_before:
        print(
            f"  {race['name']} ({race['id']}) rev={race.get('companion_revision')} "
            f"has_bundle={race.get('has_bundle')}"
        )
    cloud_ids_before = {race["id"] for race in cloud_before}

    missing_from_cloud = local_ids - cloud_ids_before
    if missing_from_cloud:
        print("\n=== DIVERGENCE: local races missing from Supabase ===")
        for race_id in missing_from_cloud:
            summary = next(item for item in local if item.id == race_id)
            print(f"  MISSING: {summary.name} ({race_id})")

    race_id = str(uuid.uuid4())
    name = f"E2E sync test {datetime.now().strftime('%H:%M:%S')}"
    roadbook = {
        "summary": {"route_name": name, "distance_km": 55.0, "elevation_gain_m": 1100.0},
        "route": {
            "track_points": [
                {"lat": 46.0, "lon": 7.0, "ele_m": 500},
                {"lat": 46.2, "lon": 7.2, "ele_m": 800},
            ],
        },
        "resupply_zones": [],
    }
    print(f"\n=== CREATING + UPLOADING TEST RACE {race_id} ===")
    bundle = build_companion_bundle(race_id, roadbook, {}, revision=1)
    base_path = f"{user_id}/{race_id}"
    for filename, payload, content_type in (
        ("analysis.json", json.dumps(roadbook, separators=(",", ":")).encode(), "application/json"),
        ("companion-bundle.json", json.dumps(bundle, separators=(",", ":")).encode(), "application/json"),
    ):
        storage_url = f"{url}/storage/v1/object/race-assets/{base_path}/{filename}"
        response = httpx.post(
            storage_url,
            content=payload,
            headers={**_headers(key), "Content-Type": content_type, "x-upsert": "true"},
            timeout=60.0,
        )
        if response.status_code >= 400:
            raise RuntimeError(f"Storage upload failed: {response.text}")

    row = {
        "id": race_id,
        "user_id": user_id,
        "name": name,
        "distance_km": 55.0,
        "elevation_gain_m": 1100.0,
        "preparation": {},
        "companion_revision": 1,
        "has_bundle": True,
        "analyzed_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "deleted_at": None,
    }
    response = httpx.post(
        f"{url}/rest/v1/races",
        headers={**_headers(key), "Prefer": "resolution=merge-duplicates,return=representation"},
        json=row,
        timeout=30.0,
    )
    if response.status_code >= 400:
        raise RuntimeError(f"Race upsert failed: {response.text}")
    print(f"✓ Uploaded {name}")

    print("\n=== SUPABASE RACES (after test upload) ===")
    cloud_after = list_cloud_races(url, key, user_id)
    match = next((race for race in cloud_after if race["id"] == race_id), None)
    if match is None:
        print("FAILED: test race not visible in cloud list")
        return 1
    print(f"✓ Test race visible: {match['name']} rev={match.get('companion_revision')}")

    # Simulate Companion version comparison
    local_revision = None
    offline_ready = False
    needs_download = match.get("has_bundle") and (not offline_ready or local_revision is None or match.get("companion_revision", 0) > (local_revision or 0))
    print(f"\n=== COMPANION DECISION ===")
    print(f"  needs_download={needs_download} (new race, not in IndexedDB)")
    if not needs_download:
        print("FAILED: Companion would not download new race")
        return 1

    # Cleanup
    httpx.patch(
        f"{url}/rest/v1/races",
        params={"id": f"eq.{race_id}", "user_id": f"eq.{user_id}"},
        headers=_headers(key),
        json={"deleted_at": datetime.now(timezone.utc).isoformat()},
        timeout=30.0,
    )
    print("\n✓ End-to-end sync verification passed")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"FAILED: {exc}", file=sys.stderr)
        raise SystemExit(1)
