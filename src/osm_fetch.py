"""Shared Overpass fetch helpers with parallel download support."""

from __future__ import annotations

import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from typing import Callable

import requests

OVERPASS_URLS = (
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
)

OVERPASS_MAX_RETRIES = 4
OVERPASS_RETRY_DELAY_S = 3.0


@dataclass(frozen=True)
class OverpassFetchResult:
    elements: list[dict]
    downloaded: bool
    duration_s: float


def fetch_overpass_query(query: str) -> list[dict]:
    """Download one Overpass query with endpoint failover."""
    last_error: Exception | None = None

    for url in OVERPASS_URLS:
        for attempt in range(OVERPASS_MAX_RETRIES):
            try:
                response = requests.post(url, data={"data": query}, timeout=240)
                if response.status_code in (429, 504):
                    time.sleep(OVERPASS_RETRY_DELAY_S * (attempt + 1))
                    continue
                response.raise_for_status()
                payload = response.json()
                return payload.get("elements", [])
            except requests.RequestException as exc:
                last_error = exc
                time.sleep(OVERPASS_RETRY_DELAY_S * (attempt + 1))

    raise RuntimeError("Failed to download OpenStreetMap data from Overpass API.") from last_error


def fetch_parallel(
    jobs: list[tuple[str, Callable[[], list[dict]]]],
    *,
    max_workers: int = 2,
) -> dict[str, OverpassFetchResult]:
    """
    Run independent Overpass fetches in parallel.

    Each job is (job_id, callable returning elements).
    """
    if not jobs:
        return {}

    if len(jobs) == 1:
        job_id, fetcher = jobs[0]
        started = time.perf_counter()
        elements = fetcher()
        return {
            job_id: OverpassFetchResult(
                elements=elements,
                downloaded=True,
                duration_s=round(time.perf_counter() - started, 2),
            ),
        }

    results: dict[str, OverpassFetchResult] = {}
    with ThreadPoolExecutor(max_workers=min(max_workers, len(jobs))) as executor:
        future_map = {
            executor.submit(_timed_fetch, job_id, fetcher): job_id
            for job_id, fetcher in jobs
        }
        for future in as_completed(future_map):
            job_id = future_map[future]
            results[job_id] = future.result()

    return results


def _timed_fetch(job_id: str, fetcher: Callable[[], list[dict]]) -> OverpassFetchResult:
    started = time.perf_counter()
    elements = fetcher()
    return OverpassFetchResult(
        elements=elements,
        downloaded=True,
        duration_s=round(time.perf_counter() - started, 2),
    )
