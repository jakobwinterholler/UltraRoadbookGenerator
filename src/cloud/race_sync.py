"""Push local races to Supabase and serve Companion sync data."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

import httpx

from cloud.config import cloud_config
from companion_bundle import build_companion_bundle
from race_project import race_store


class CloudSyncError(RuntimeError):
    pass


def _headers() -> dict[str, str]:
    key = cloud_config.service_role_key
    headers = {"apikey": key, "Content-Type": "application/json"}
    # Legacy JWT service_role keys use Bearer; new sb_secret_* keys must not.
    if key and not key.startswith("sb_secret_") and not key.startswith("sb_publishable_"):
        headers["Authorization"] = f"Bearer {key}"
    return headers


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _storage_path(user_id: str, race_id: str, filename: str) -> str:
    return f"{user_id}/{race_id}/{filename}"


def _upload_bytes(path: str, payload: bytes, content_type: str) -> None:
    url = f"{cloud_config.url}/storage/v1/object/{cloud_config.storage_bucket}/{path}"
    headers = {
        **_headers(),
        "Content-Type": content_type,
        "x-upsert": "true",
    }
    response = httpx.post(
        url,
        content=payload,
        headers=headers,
        timeout=120.0,
    )
    if response.status_code >= 400:
        raise CloudSyncError(f"Storage upload failed ({path}): {response.text}")


def _get_race_row(user_id: str, race_id: str) -> dict[str, Any] | None:
    url = f"{cloud_config.url}/rest/v1/races"
    response = httpx.get(
        url,
        params={"id": f"eq.{race_id}", "user_id": f"eq.{user_id}", "select": "*"},
        headers=_headers(),
        timeout=30.0,
    )
    if response.status_code >= 400:
        raise CloudSyncError(f"Failed to load cloud race: {response.text}")
    rows = response.json()
    return rows[0] if rows else None


def _upsert_race_row(payload: dict[str, Any]) -> dict[str, Any]:
    url = f"{cloud_config.url}/rest/v1/races"
    response = httpx.post(
        url,
        headers={**_headers(), "Prefer": "resolution=merge-duplicates,return=representation"},
        json=payload,
        timeout=30.0,
    )
    if response.status_code >= 400:
        raise CloudSyncError(f"Failed to upsert race: {response.text}")
    rows = response.json()
    return rows[0] if rows else payload


def _download_json(path: str) -> dict[str, Any]:
    url = f"{cloud_config.url}/storage/v1/object/{cloud_config.storage_bucket}/{path}"
    response = httpx.get(url, headers=_headers(), timeout=120.0)
    if response.status_code >= 400:
        raise CloudSyncError(f"Failed to download {path}: {response.text}")
    return response.json()


def push_race(user_id: str, race_id: str) -> dict[str, Any]:
    if not cloud_config.enabled:
        raise CloudSyncError("Cloud sync is not configured.")

    race = race_store.get_race(race_id)
    summary = race_store.get_summary(race_id)
    existing = _get_race_row(user_id, race_id)
    next_revision = int((existing or {}).get("companion_revision") or 0) + 1

    gpx_path = race_store.get_gpx_path(race_id)
    if gpx_path.exists():
        _upload_bytes(
            _storage_path(user_id, race_id, "route.gpx"),
            gpx_path.read_bytes(),
            "application/gpx+xml",
        )

    roadbook = race_store.load_analysis(race_id)
    has_bundle = False
    analyzed_at = race.analysis.get("analyzed_at")
    if roadbook is not None:
        analysis_bytes = json.dumps(roadbook, separators=(",", ":")).encode("utf-8")
        _upload_bytes(
            _storage_path(user_id, race_id, "analysis.json"),
            analysis_bytes,
            "application/json",
        )
        bundle = build_companion_bundle(
            race_id,
            roadbook,
            race.preparation.to_dict(),
            revision=next_revision,
        )
        bundle_bytes = json.dumps(bundle, separators=(",", ":")).encode("utf-8")
        _upload_bytes(
            _storage_path(user_id, race_id, "companion-bundle.json"),
            bundle_bytes,
            "application/json",
        )
        has_bundle = True
        analyzed_at = analyzed_at or _utc_now()

    row = _upsert_race_row(
        {
            "id": race_id,
            "user_id": user_id,
            "name": summary.name,
            "distance_km": summary.distance_km,
            "elevation_gain_m": summary.elevation_gain_m,
            "preparation": race.preparation.to_dict(),
            "companion_revision": next_revision if has_bundle else int((existing or {}).get("companion_revision") or 0),
            "has_bundle": has_bundle,
            "analyzed_at": analyzed_at,
            "updated_at": _utc_now(),
            "deleted_at": None,
        }
    )
    return {
        "race_id": race_id,
        "companion_revision": row.get("companion_revision", next_revision),
        "has_bundle": has_bundle,
        "synced_at": _utc_now(),
    }


def push_all_local_races(user_id: str) -> dict[str, Any]:
    uploaded: list[str] = []
    failed: list[dict[str, str]] = []
    for summary in race_store.list_races():
        try:
            push_race(user_id, summary.id)
            uploaded.append(summary.id)
        except Exception as exc:  # pragma: no cover - surfaced to client
            failed.append({"race_id": summary.id, "error": str(exc)})
    return {"uploaded": uploaded, "failed": failed}


def list_sync_races(user_id: str) -> list[dict[str, Any]]:
    url = f"{cloud_config.url}/rest/v1/races"
    response = httpx.get(
        url,
        params={
            "user_id": f"eq.{user_id}",
            "deleted_at": "is.null",
            "select": "id,name,distance_km,elevation_gain_m,companion_revision,updated_at,analyzed_at,has_bundle",
            "order": "updated_at.desc",
        },
        headers=_headers(),
        timeout=30.0,
    )
    if response.status_code >= 400:
        raise CloudSyncError(f"Failed to list cloud races: {response.text}")
    return response.json()


def get_companion_bundle(user_id: str, race_id: str) -> dict[str, Any]:
    row = _get_race_row(user_id, race_id)
    if row is None:
        raise CloudSyncError("Race not found.")
    if not row.get("has_bundle"):
        raise CloudSyncError("This race has not been analyzed yet.")
    path = _storage_path(user_id, race_id, "companion-bundle.json")
    return _download_json(path)


def soft_delete_race(user_id: str, race_id: str) -> None:
    url = f"{cloud_config.url}/rest/v1/races"
    response = httpx.patch(
        url,
        params={"id": f"eq.{race_id}", "user_id": f"eq.{user_id}"},
        headers=_headers(),
        json={"deleted_at": _utc_now()},
        timeout=30.0,
    )
    if response.status_code >= 400:
        raise CloudSyncError(f"Failed to delete cloud race: {response.text}")
