"""Route preview prepare + export orchestration."""

from __future__ import annotations

import json
import subprocess
import sys
import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

from preview_versions import PREVIEW_PIPELINE_VERSION, RUNTIME_VERSION, STORY_VERSION
from race_project import PROJECT_ROOT, race_store

POC_DIR = PROJECT_ROOT / "tools/route-preview-poc"
CAPTURE_SCRIPT = POC_DIR / "capture.mjs"
PREPARE_CACHE_SCRIPT = POC_DIR / "prepare-cache.mjs"


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


EmitCallback = Callable[[dict[str, Any]], None]


@dataclass
class PreviewJobSlice:
    status: str = "idle"
    started_at: str | None = None
    completed_at: str | None = None
    error: str | None = None
    steps: list[dict[str, Any]] = field(default_factory=list)
    progress: dict[str, Any] = field(default_factory=dict)


@dataclass
class PreviewJobState:
    race_id: str
    prepare: PreviewJobSlice = field(default_factory=PreviewJobSlice)
    export: PreviewJobSlice = field(default_factory=PreviewJobSlice)

    def to_dict(self) -> dict[str, Any]:
        debug = race_store.route_preview_debug_info(self.race_id)
        return {
            "race_id": self.race_id,
            "prepared": race_store.has_route_preview_runtime(self.race_id)
            and race_store.has_route_preview_cache(self.race_id),
            "has_runtime": race_store.has_route_preview_runtime(self.race_id),
            "has_cache": race_store.has_route_preview_cache(self.race_id),
            "has_video": race_store.has_route_preview(self.race_id),
            "is_stale": debug["is_stale"],
            "stale_reasons": debug["reasons"],
            "prepared_at": debug["prepared_at"],
            "pipeline_version": debug["pipeline_version"],
            "stored_pipeline_version": debug.get("stored_pipeline_version"),
            "source_fingerprint": debug.get("source_fingerprint"),
            "stored_source_fingerprint": debug.get("stored_source_fingerprint"),
            "story_version": debug.get("story_version"),
            "runtime_version": debug.get("runtime_version"),
            "camera_version": debug.get("camera_version"),
            "last_cache_hit": debug.get("last_cache_hit"),
            "debug": debug,
            "prepare": {
                "status": self.prepare.status,
                "started_at": self.prepare.started_at,
                "completed_at": self.prepare.completed_at,
                "error": self.prepare.error,
                "steps": self.prepare.steps,
                "progress": self.prepare.progress,
            },
            "export": {
                "status": self.export.status,
                "started_at": self.export.started_at,
                "completed_at": self.export.completed_at,
                "error": self.export.error,
                "steps": self.export.steps,
                "progress": self.export.progress,
            },
            # Backward compatibility for existing UI fields.
            "status": self.export.status if self.export.status != "idle" else self.prepare.status,
            "started_at": self.export.started_at or self.prepare.started_at,
            "completed_at": self.export.completed_at or self.prepare.completed_at,
            "error": self.export.error or self.prepare.error,
            "steps": self.export.steps or self.prepare.steps,
            "progress": self.export.progress or self.prepare.progress,
        }


_preview_jobs: dict[str, PreviewJobState] = {}
_preview_lock = threading.Lock()


def get_preview_status(race_id: str) -> dict[str, Any]:
    with _preview_lock:
        job = _preview_jobs.get(race_id)
        if job is None:
            return PreviewJobState(race_id=race_id).to_dict()
        return job.to_dict()


def _set_step(state: PreviewJobSlice, step_id: str, label: str, status: str) -> None:
    existing = next((step for step in state.steps if step["id"] == step_id), None)
    payload = {"id": step_id, "label": label, "status": status}
    if existing is None:
        state.steps.append(payload)
    else:
        existing.update(payload)


def _prepare_runtime(race_id: str, output_path: Path) -> None:
    script = PROJECT_ROOT / "scripts/prepare_route_preview_runtime.py"
    subprocess.run(
        [sys.executable, str(script), race_id, "--output", str(output_path)],
        cwd=PROJECT_ROOT,
        check=True,
        text=True,
    )


def _warm_tile_cache(race_id: str, cache_dir: Path, runtime_path: Path, emit: EmitCallback) -> bool:
    process = subprocess.Popen(
        [
            "node",
            str(PREPARE_CACHE_SCRIPT),
            "--runtime",
            str(runtime_path),
            "--cache-dir",
            str(cache_dir),
        ],
        cwd=POC_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )
    assert process.stdout is not None
    cache_hit = False
    for line in process.stdout:
        line = line.rstrip()
        if not line.startswith("PROGRESS:"):
            continue
        event = json.loads(line[len("PROGRESS:") :])
        if event.get("type") == "cache_tiles":
            emit(
                {
                    "type": "progress",
                    "id": "terrain",
                    "label": "Preparing terrain",
                    "current": event.get("current", 0),
                    "total": event.get("total", 0),
                }
            )
        if event.get("type") == "cache":
            emit({"type": "cache", **event})
            cache_hit = event.get("status") == "hit"
    return_code = process.wait()
    if return_code != 0:
        raise RuntimeError(f"Tile cache warm-up exited with code {return_code}.")
    return cache_hit


def _run_preview_prepare(race_id: str, emit: EmitCallback) -> None:
    state = PreviewJobState(race_id=race_id)
    state.prepare.status = "running"
    state.prepare.started_at = _utc_now()
    with _preview_lock:
        _preview_jobs[race_id] = state

    def step(step_id: str, label: str, status: str) -> None:
        _set_step(state.prepare, step_id, label, status)
        emit({"type": "step", "id": step_id, "label": label, "status": status})

    try:
        race_store.clear_route_preview_artifacts(race_id, keep_video=True)

        step("story", "Preparing story", "running")
        runtime_path = race_store.preview_runtime_path(race_id)
        _prepare_runtime(race_id, runtime_path)
        step("story", "Preparing story", "complete")

        step("scenes", "Preparing scenes", "running")
        race_store.sync_preview_segment_from_runtime(race_id)
        runtime = json.loads(runtime_path.read_text(encoding="utf-8"))
        scene_count = len(runtime.get("scenes") or [])
        step("scenes", f"Preparing scenes ({scene_count} chapters)", "complete")

        step("terrain", "Preparing terrain", "running")
        cache_dir = race_store.preview_cache_dir(race_id)
        cache_dir.mkdir(parents=True, exist_ok=True)
        cache_hit = _warm_tile_cache(race_id, cache_dir, runtime_path, emit)
        step("terrain", "Preparing terrain", "complete")

        race_store.record_route_preview_prepare(race_id, cache_hit=cache_hit)
        state.prepare.status = "complete"
        state.prepare.completed_at = _utc_now()
        state.prepare.progress = {}
        emit(
            {
                "type": "complete",
                "data": {
                    "prepared": True,
                    "race_id": race_id,
                    "cache_hit": cache_hit,
                    "pipeline_version": PREVIEW_PIPELINE_VERSION,
                },
            }
        )
    except Exception as exc:
        state.prepare.status = "error"
        state.prepare.error = str(exc)
        state.prepare.completed_at = _utc_now()
        emit({"type": "error", "detail": str(exc)})
    finally:
        with _preview_lock:
            _preview_jobs[race_id] = state


def _run_preview_export(race_id: str, emit: EmitCallback, *, quick: bool = False) -> None:
    with _preview_lock:
        state = _preview_jobs.get(race_id) or PreviewJobState(race_id=race_id)
        if state.export.status == "running":
            raise RuntimeError("Route preview export is already running for this race.")
        state.export = PreviewJobSlice(status="running", started_at=_utc_now())
        _preview_jobs[race_id] = state

    def step(step_id: str, label: str, status: str) -> None:
        _set_step(state.export, step_id, label, status)
        emit({"type": "step", "id": step_id, "label": label, "status": status})

    try:
        if not race_store.has_route_preview_runtime(race_id):
            step("story", "Preparing story…", "running")
            runtime_path = race_store.preview_runtime_path(race_id)
            _prepare_runtime(race_id, runtime_path)
            step("story", "Preparing story…", "complete")
        else:
            step("story", "Preparing story…", "complete")

        output_path = race_store.preview_video_path(race_id)
        cache_dir = race_store.preview_cache_dir(race_id)
        segment_path = race_store.preview_segment_path(race_id)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        cache_dir.mkdir(parents=True, exist_ok=True)

        if not race_store.has_route_preview_cache(race_id):
            step("terrain", "Caching terrain…", "running")
            _warm_tile_cache(race_id, cache_dir, race_store.preview_runtime_path(race_id), emit)
            step("terrain", "Caching terrain…", "complete")
        else:
            step("terrain", "Caching terrain…", "complete")

        cmd = [
            "node",
            str(CAPTURE_SCRIPT),
            "--segment",
            str(segment_path),
            "--output",
            str(output_path),
            "--cache-dir",
            str(cache_dir),
        ]
        if quick:
            cmd.append("--quick")

        step("render", "Rendering export…", "running")
        process = subprocess.Popen(
            cmd,
            cwd=POC_DIR,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
        assert process.stdout is not None

        for line in process.stdout:
            line = line.rstrip()
            if not line.startswith("PROGRESS:"):
                if line.startswith("Encoding MP4"):
                    step("render", "Rendering export…", "complete")
                    step("encode", "Encoding video…", "running")
                continue
            event = json.loads(line[len("PROGRESS:") :])
            event_type = event.get("type")
            if event_type == "frame":
                state.export.progress = {
                    "label": "Rendering export…",
                    "current": event.get("current", 0),
                    "total": event.get("total", 0),
                }
                emit(
                    {
                        "type": "progress",
                        "id": "render",
                        "label": "Rendering export…",
                        "current": event.get("current", 0),
                        "total": event.get("total", 0),
                    }
                )
            if event_type == "encode":
                step("render", "Rendering export…", "complete")
                step("encode", "Encoding video…", "running")
            if event_type == "error":
                raise RuntimeError(event.get("detail") or "Route preview export failed.")

        return_code = process.wait()
        if return_code != 0:
            raise RuntimeError(f"Route preview exporter exited with code {return_code}.")
        if not output_path.is_file():
            raise RuntimeError("Route preview export finished without producing a video file.")

        step("encode", "Encoding video…", "complete")
        race_store.record_route_preview(race_id)
        state.export.status = "complete"
        state.export.completed_at = _utc_now()
        state.export.progress = {}
        emit({"type": "complete", "data": {"has_video": True, "race_id": race_id}})
    except Exception as exc:
        state.export.status = "error"
        state.export.error = str(exc)
        state.export.completed_at = _utc_now()
        emit({"type": "error", "detail": str(exc)})
    finally:
        with _preview_lock:
            _preview_jobs[race_id] = state


def start_preview_prepare(race_id: str, emit: EmitCallback) -> None:
    with _preview_lock:
        existing = _preview_jobs.get(race_id)
        if existing and existing.prepare.status == "running":
            raise RuntimeError("Route preview prepare is already running for this race.")

    thread = threading.Thread(
        target=_run_preview_prepare,
        args=(race_id, emit),
        daemon=True,
    )
    thread.start()


def start_preview_generation(
    race_id: str,
    emit: EmitCallback,
    *,
    quick: bool = False,
) -> None:
    with _preview_lock:
        existing = _preview_jobs.get(race_id)
        if existing and existing.export.status == "running":
            raise RuntimeError("Route preview export is already running for this race.")

    thread = threading.Thread(
        target=_run_preview_export,
        args=(race_id, emit),
        kwargs={"quick": quick},
        daemon=True,
    )
    thread.start()


# Backward-compatible alias.
start_preview_export = start_preview_generation
