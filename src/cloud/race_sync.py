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


def _headers(access_token: str | None = None) -> dict[str, str]:
    service_key = cloud_config.service_role_key
    api_key = service_key or cloud_config.anon_key
    headers = {"apikey": api_key, "Content-Type": "application/json"}
    # Legacy JWT service_role keys use Bearer; new sb_secret_* keys must not.
    if service_key and not service_key.startswith("sb_secret_") and not service_key.startswith(
        "sb_publishable_"
    ):
        headers["Authorization"] = f"Bearer {service_key}"
    elif access_token:
        headers["Authorization"] = f"Bearer {access_token}"
    return headers


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _storage_path(user_id: str, race_id: str, filename: str) -> str:
    return f"{user_id}/{race_id}/{filename}"


def _upload_bytes(path: str, payload: bytes, content_type: str, access_token: str | None = None) -> None:
    url = f"{cloud_config.url}/storage/v1/object/{cloud_config.storage_bucket}/{path}"
    headers = {
        **_headers(access_token),
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


def _get_race_row(user_id: str, race_id: str, access_token: str | None = None) -> dict[str, Any] | None:
    url = f"{cloud_config.url}/rest/v1/races"
    response = httpx.get(
        url,
        params={"id": f"eq.{race_id}", "user_id": f"eq.{user_id}", "select": "*"},
        headers=_headers(access_token),
        timeout=30.0,
    )
    if response.status_code >= 400:
        raise CloudSyncError(f"Failed to load cloud race: {response.text}")
    rows = response.json()
    return rows[0] if rows else None


def _upsert_race_row(payload: dict[str, Any], access_token: str | None = None) -> dict[str, Any]:
    url = f"{cloud_config.url}/rest/v1/races"
    response = httpx.post(
        url,
        headers={**_headers(access_token), "Prefer": "resolution=merge-duplicates,return=representation"},
        json=payload,
        timeout=30.0,
    )
    if response.status_code >= 400:
        raise CloudSyncError(f"Failed to upsert race: {response.text}")
    rows = response.json()
    return rows[0] if rows else payload


def _download_json(path: str, access_token: str | None = None) -> dict[str, Any]:
    url = f"{cloud_config.url}/storage/v1/object/{cloud_config.storage_bucket}/{path}"
    response = httpx.get(url, headers=_headers(access_token), timeout=120.0)
    if response.status_code >= 400:
        raise CloudSyncError(f"Failed to download {path}: {response.text}")
    return response.json()


def push_race(user_id: str, race_id: str, access_token: str | None = None) -> dict[str, Any]:
    if not cloud_config.sync_enabled and not access_token:
        raise CloudSyncError("Cloud sync is not configured.")

    race = race_store.get_race(race_id)
    summary = race_store.get_summary(race_id)
    existing = _get_race_row(user_id, race_id, access_token)
    next_revision = int((existing or {}).get("companion_revision") or 0) + 1

    gpx_path = race_store.get_gpx_path(race_id)
    if gpx_path.exists():
        _upload_bytes(
            _storage_path(user_id, race_id, "route.gpx"),
            gpx_path.read_bytes(),
            "application/gpx+xml",
            access_token,
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
            access_token,
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
            access_token,
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
        },
        access_token,
    )
    revision = int(row.get("companion_revision", next_revision))
    return {
        "race_id": race_id,
        "name": summary.name,
        "companion_revision": revision,
        "version": revision,
        "bundle_version": revision,
        "has_bundle": has_bundle,
        "synced_at": _utc_now(),
    }


def _race_needs_upload(
    race_id: str,
    existing: dict[str, Any] | None,
) -> bool:
    """Return True when local race should be pushed to cloud."""
    roadbook = race_store.load_analysis(race_id)
    if roadbook is None:
        return False
    if existing is None:
        return True
    if not existing.get("has_bundle"):
        return True
    summary = race_store.get_summary(race_id)
    local_updated = summary.updated_at
    cloud_updated = existing.get("updated_at")
    if not cloud_updated:
        return True
    try:
        local_dt = datetime.fromisoformat(str(local_updated).replace("Z", "+00:00"))
        cloud_dt = datetime.fromisoformat(str(cloud_updated).replace("Z", "+00:00"))
        if local_dt.tzinfo is None:
            local_dt = local_dt.replace(tzinfo=timezone.utc)
        if cloud_dt.tzinfo is None:
            cloud_dt = cloud_dt.replace(tzinfo=timezone.utc)
        return local_dt > cloud_dt
    except ValueError:
        return True


def push_all_local_races(user_id: str, access_token: str | None = None) -> dict[str, Any]:
    uploaded: list[dict[str, Any]] = []
    failed: list[dict[str, str]] = []
    skipped: list[dict[str, str]] = []
    for summary in race_store.list_races():
        existing = _get_race_row(user_id, summary.id, access_token)
        if existing and not _race_needs_upload(summary.id, existing):
            skipped.append({
                "race_id": summary.id,
                "name": summary.name,
                "reason": "unchanged",
            })
            continue
        try:
            result = push_race(user_id, summary.id, access_token)
            uploaded.append(result)
        except Exception as exc:  # pragma: no cover - surfaced to client
            failed.append({
                "race_id": summary.id,
                "name": summary.name,
                "error": str(exc),
            })
    return {"uploaded": uploaded, "failed": failed, "skipped": skipped}


def list_sync_races(user_id: str, access_token: str | None = None) -> list[dict[str, Any]]:
    url = f"{cloud_config.url}/rest/v1/races"
    response = httpx.get(
        url,
        params={
            "user_id": f"eq.{user_id}",
            "deleted_at": "is.null",
            "select": "id,name,distance_km,elevation_gain_m,companion_revision,updated_at,analyzed_at,has_bundle",
            "order": "updated_at.desc",
        },
        headers=_headers(access_token),
        timeout=30.0,
    )
    if response.status_code >= 400:
        raise CloudSyncError(f"Failed to list cloud races: {response.text}")
    return response.json()


def get_companion_bundle(user_id: str, race_id: str, access_token: str | None = None) -> dict[str, Any]:
    row = _get_race_row(user_id, race_id, access_token)
    if row is None:
        raise CloudSyncError("Race not found.")
    if not row.get("has_bundle"):
        raise CloudSyncError("This race has not been analyzed yet.")
    path = _storage_path(user_id, race_id, "companion-bundle.json")
    return _download_json(path, access_token)


def soft_delete_race(user_id: str, race_id: str, access_token: str | None = None) -> None:
    url = f"{cloud_config.url}/rest/v1/races"
    response = httpx.patch(
        url,
        params={"id": f"eq.{race_id}", "user_id": f"eq.{user_id}"},
        headers=_headers(access_token),
        json={"deleted_at": _utc_now()},
        timeout=30.0,
    )
    if response.status_code >= 400:
        raise CloudSyncError(f"Failed to delete cloud race: {response.text}")


def _queue_pending_verifications(
    preparation: dict[str, Any],
    verifications: list[dict[str, Any]],
) -> tuple[dict[str, Any], list[str]]:
    pending = dict(preparation.get("companion_pending_verifications") or {})
    accepted: list[str] = []
    for raw in verifications:
        if not isinstance(raw, dict):
            continue
        record_id = str(raw.get("id") or "")
        if not record_id:
            continue
        pending[record_id] = {
            **raw,
            "reviewStatus": "pending",
        }
        accepted.append(record_id)
    preparation = {
        **preparation,
        "companion_pending_verifications": pending,
    }
    return preparation, accepted


def _push_bundle_for_preparation(
    user_id: str,
    race_id: str,
    preparation: dict[str, Any],
    existing_row: dict[str, Any],
    access_token: str | None = None,
) -> int:
    next_revision = int(existing_row.get("companion_revision") or 0) + 1
    path = _storage_path(user_id, race_id, "companion-bundle.json")
    bundle = _download_json(path, access_token)
    bundle["revision"] = next_revision
    bundle["syncedAt"] = _utc_now()
    verified_stops = preparation.get("verified_stops") or {}
    verified_count = 0
    for stop in bundle.get("stops") or []:
        if not isinstance(stop, dict):
            continue
        zone_key = str(stop.get("zoneId") or "")
        record = verified_stops.get(zone_key)
        if not isinstance(record, dict):
            continue
        status = record.get("status")
        if status == "verified":
            stop["verificationStatus"] = "verified"
            stop["verificationDate"] = record.get("updated_at")
            verified_count += 1
        elif status in ("rejected", "deferred"):
            stop["verificationStatus"] = "needs_review"
            notes = str(record.get("reject_notes") or "").strip()
            if notes:
                stop["notes"] = notes
        else:
            stop["verificationStatus"] = "unverified"
    total_stops = len([item for item in bundle.get("stops") or [] if isinstance(item, dict)])
    unverified_count = max(0, total_stops - verified_count)
    dashboard = dict(bundle.get("dashboardStats") or {})
    dashboard["verifiedStops"] = verified_count
    dashboard["unverifiedStops"] = unverified_count
    dashboard["remainingStops"] = unverified_count
    bundle["dashboardStats"] = dashboard
    bundle_bytes = json.dumps(bundle, separators=(",", ":")).encode("utf-8")
    _upload_bytes(path, bundle_bytes, "application/json", access_token)
    return next_revision


def add_companion_verifications(
    user_id: str,
    verifications: list[dict[str, Any]],
    access_token: str | None = None,
) -> list[str]:
    if not verifications:
        return []

    by_race: dict[str, list[dict[str, Any]]] = {}
    for item in verifications:
        race_id = str(item.get("raceId") or item.get("race_id") or "")
        if race_id:
            by_race.setdefault(race_id, []).append(item)

    accepted: list[str] = []
    for race_id, items in by_race.items():
        try:
            accepted.extend(race_store.add_companion_verifications(race_id, items))
            if cloud_config.sync_enabled or access_token:
                race = race_store.get_race(race_id)
                row = _get_race_row(user_id, race_id, access_token)
                if row is not None:
                    push_race(user_id, race_id, access_token)
            continue
        except FileNotFoundError:
            pass

        row = _get_race_row(user_id, race_id, access_token)
        if row is None:
            continue
        preparation, race_accepted = _queue_pending_verifications(
            dict(row.get("preparation") or {}),
            items,
        )
        _upsert_race_row(
            {
                **row,
                "preparation": preparation,
                "updated_at": _utc_now(),
            },
            access_token,
        )
        accepted.extend(race_accepted)

    return accepted


def list_companion_verifications(
    user_id: str,
    race_id: str,
    access_token: str | None = None,
    *,
    status: str = "pending",
) -> list[dict[str, Any]]:
    try:
        return race_store.list_companion_verifications(race_id, status=status)
    except FileNotFoundError:
        pass

    row = _get_race_row(user_id, race_id, access_token)
    if row is None:
        return []
    preparation = row.get("preparation") or {}
    pending = preparation.get("companion_pending_verifications") or {}
    history = preparation.get("companion_verification_history") or {}
    if status == "history":
        records = [value for value in history.values() if isinstance(value, dict)]
    elif status == "all":
        records = [
            value
            for value in [*pending.values(), *history.values()]
            if isinstance(value, dict)
        ]
    else:
        records = [
            value
            for value in pending.values()
            if isinstance(value, dict)
            and str(value.get("reviewStatus") or value.get("review_status")) == "pending"
        ]
    records.sort(
        key=lambda item: str(item.get("submittedAt") or item.get("submitted_at") or ""),
        reverse=True,
    )
    return records


def review_companion_verification(
    user_id: str,
    race_id: str,
    verification_id: str,
    *,
    action: str,
    access_token: str | None = None,
) -> bool:
    try:
        updated = race_store.review_companion_verification(
            race_id,
            verification_id,
            action=action,
        )
        if updated is not None and (cloud_config.sync_enabled or access_token):
            push_race(user_id, race_id, access_token)
        return updated is not None
    except FileNotFoundError:
        pass

    row = _get_race_row(user_id, race_id, access_token)
    if row is None:
        return False
    preparation = dict(row.get("preparation") or {})
    pending = dict(preparation.get("companion_pending_verifications") or {})
    record = pending.get(verification_id)
    if not isinstance(record, dict):
        return False

    if action == "accept":
        updates = record.get("updates") if isinstance(record.get("updates"), dict) else {}
        zone_id = str(record.get("zoneId") or record.get("zone_id") or "")
        verified = dict(preparation.get("verified_stops") or {})
        verified[zone_id] = {
            "status": updates.get("status") or "verified",
            "reject_reason": updates.get("rejectReason") or updates.get("reject_reason"),
            "reject_notes": updates.get("notes"),
            "updated_at": record.get("submittedAt") or record.get("submitted_at") or _utc_now(),
        }
        preparation["verified_stops"] = verified

    history = dict(preparation.get("companion_verification_history") or {})
    record["reviewStatus"] = "accepted" if action == "accept" else "rejected"
    record["reviewedAt"] = _utc_now()
    record["reviewAction"] = action
    del pending[verification_id]
    history[verification_id] = record
    preparation["companion_pending_verifications"] = pending
    preparation["companion_verification_history"] = history
    _upsert_race_row(
        {
            **row,
            "preparation": preparation,
            "updated_at": _utc_now(),
        },
        access_token,
    )
    if cloud_config.sync_enabled or access_token:
        push_race(user_id, race_id, access_token)
    return True
