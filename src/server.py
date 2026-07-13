"""FastAPI server for the Ultra Roadbook Generator web UI."""

import asyncio
import json
import threading
from dataclasses import asdict
from typing import Any
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from climb_config import ClimbDetectionConfig, DEFAULT_CLIMB_DETECTION_CONFIG
from excel_export import export_roadbook
from pipeline import (
    analyze_gpx_upload,
    analyze_race_gpx,
    clear_race_cache,
    clear_session_cache,
    ensure_race_cache,
    get_race_cache,
    recalculate_climbs,
    roadbook_to_dict,
    update_climb_nicknames,
)
from app_settings import AppSettings, app_settings_store
from race_project import RaceSettings, race_store
from route_preview_render import get_preview_status, start_preview_generation, start_preview_prepare
from race_open_trace import race_open_trace

PREVIEW_NO_CACHE_HEADERS = {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
}
from settings_merge import effective_planning, effective_settings_payload
from poi_profile import DEFAULT_ULTRA_POI_PROFILE, PoiPlanningProfile, profile_catalog
from pipeline_watchdog import PipelineStalledError, StageWatchdog
from progress import ProgressReporter, pipeline_step_catalog
from surface_gpx_export import export_surface_validation_gpx

PROJECT_ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DIST = PROJECT_ROOT / "frontend" / "dist"
EXPORT_DIR = PROJECT_ROOT / "output"

EXCEL_PATH = EXPORT_DIR / "Roadbook.xlsx"
VALIDATION_GPX_PATH = EXPORT_DIR / "surface_validation.gpx"

app = FastAPI(title="Ultra Roadbook Generator", version="0.15")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _require_session():
    from pipeline import get_session_cache

    cache = get_session_cache()
    if cache is None:
        raise HTTPException(status_code=400, detail="Generate a roadbook first.")
    return cache


def _require_race(race_id: str):
    try:
        return race_store.get_race(race_id)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Race not found.") from exc


def _effective_race_planning(race_id: str):
    app = app_settings_store.load()
    race = race_store.get_race(race_id)
    return effective_planning(app, race.settings)


def _race_cache(race_id: str):
    race = _require_race(race_id)
    planning = _effective_race_planning(race_id)
    try:
        return ensure_race_cache(
            race_id,
            gpx_path=race_store.get_gpx_path(race_id),
            poi_profile=planning.poi_profile,
            climb_nicknames=race.preparation.climb_nicknames,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "version": "0.15"}


class AppSettingsBody(BaseModel):
    planning: dict | None = None
    analysis: dict | None = None
    appearance: dict | None = None


class RaceSettingsBody(BaseModel):
    use_app_defaults: bool | None = None
    planning: dict | None = None


@app.get("/api/settings")
def get_app_settings() -> dict:
    app = app_settings_store.load()
    storage = app_settings_store.storage_summary()
    return {
        **effective_settings_payload(app, None, scope="app"),
        "account": {
            "signed_in": False,
            "cloud_sync_enabled": False,
            "storage": storage,
        },
    }


@app.patch("/api/settings")
def patch_app_settings(body: AppSettingsBody) -> dict:
    from app_settings import AnalysisDefaults, AppearanceDefaults, PlanningDefaults

    current = app_settings_store.load()
    if body.planning is not None:
        merged = {**current.planning.to_dict(), **body.planning}
        current.planning = PlanningDefaults.from_dict(merged)
    if body.analysis is not None:
        merged = {**current.analysis.to_dict(), **body.analysis}
        current.analysis = AnalysisDefaults.from_dict(merged)
    if body.appearance is not None:
        merged = {**current.appearance.to_dict(), **body.appearance}
        current.appearance = AppearanceDefaults.from_dict(merged)
    app_settings_store.save(current)
    storage = app_settings_store.storage_summary()
    return {
        **effective_settings_payload(current, None, scope="app"),
        "account": {
            "signed_in": False,
            "cloud_sync_enabled": False,
            "storage": storage,
        },
    }


@app.get("/api/races/{race_id}/settings")
def get_race_settings(race_id: str) -> dict:
    race = _require_race(race_id)
    app = app_settings_store.load()
    storage = app_settings_store.storage_summary()
    return {
        **effective_settings_payload(app, race.settings, scope="race"),
        "race_id": race_id,
        "race_name": race.meta.name,
        "has_analysis": race_store.has_analysis(race_id),
        "account": {
            "signed_in": False,
            "cloud_sync_enabled": False,
            "storage": storage,
        },
    }


@app.patch("/api/races/{race_id}/settings")
def patch_race_settings(race_id: str, body: RaceSettingsBody) -> dict:
    race = _require_race(race_id)
    settings = race.settings
    if body.use_app_defaults is not None:
        settings.use_app_defaults = body.use_app_defaults
    if body.planning is not None:
        planning = body.planning
        if "poi_profile" in planning:
            settings.poi_profile = PoiPlanningProfile.from_dict(planning["poi_profile"])
        if "climb_sensitivity" in planning:
            settings.climb_sensitivity = planning["climb_sensitivity"]
        if "climb_config" in planning:
            settings.climb_config = ClimbDetectionConfig.from_dict(planning["climb_config"])
        if "preferred_stage_length_km" in planning:
            settings.preferred_stage_length_km = int(planning["preferred_stage_length_km"])
        if "max_gap_without_resupply_km" in planning:
            settings.max_gap_without_resupply_km = int(planning["max_gap_without_resupply_km"])
        if "default_arrival_time_window" in planning:
            settings.default_arrival_time_window = planning["default_arrival_time_window"]
        if "default_zone_density" in planning:
            settings.default_zone_density = planning["default_zone_density"]
        settings.use_app_defaults = False
    race_store.update_settings(race_id, settings)
    return get_race_settings(race_id)


class ClimbDetectionConfigBody(BaseModel):
    smoothing_window_m: float = Field(default=60, ge=10, le=500)
    rolling_gradient_window_m: float = Field(default=100, ge=20, le=1000)
    gradient_threshold_pct: float = Field(default=1.0, ge=0.1, le=10)
    meaningful_descent_threshold_m: float = Field(default=50, ge=10, le=300)
    min_elevation_gain_m: float = Field(default=50, ge=10, le=500)
    min_average_gradient_pct: float = Field(default=3.0, ge=0.5, le=15)


@app.get("/api/climbs/config")
def climb_config_defaults() -> dict:
    return {"config": DEFAULT_CLIMB_DETECTION_CONFIG.to_dict()}


@app.post("/api/climbs/recalculate")
def recalculate_climbs_endpoint(body: ClimbDetectionConfigBody) -> dict:
    """Re-run climb detection on the cached route track."""
    try:
        config = ClimbDetectionConfig(
            smoothing_window_m=body.smoothing_window_m,
            rolling_gradient_window_m=body.rolling_gradient_window_m,
            gradient_threshold_pct=body.gradient_threshold_pct,
            meaningful_descent_threshold_m=body.meaningful_descent_threshold_m,
            min_elevation_gain_m=body.min_elevation_gain_m,
            min_average_gradient_pct=body.min_average_gradient_pct,
        )
        artifacts = recalculate_climbs(config)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "climbs": [asdict(climb) for climb in artifacts.roadbook.climbs],
        "climb_candidates": [
            asdict(candidate) for candidate in artifacts.roadbook.climb_candidates
        ],
        "summary": {"climb_count": artifacts.roadbook.summary.climb_count},
        "config": config.to_dict(),
    }


class ClimbNicknamesBody(BaseModel):
    nicknames: dict[str, str]


@app.post("/api/climbs/nicknames")
def save_climb_nicknames(body: ClimbNicknamesBody) -> dict:
    try:
        artifacts = update_climb_nicknames(body.nicknames)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "climbs": [asdict(climb) for climb in artifacts.roadbook.climbs],
    }


@app.get("/api/climbs/debug")
def climb_debug() -> dict:
    cache = _require_session()
    return {
        "climbs": [asdict(climb) for climb in cache.roadbook.climbs],
        "candidates": [asdict(candidate) for candidate in cache.roadbook.climb_candidates],
    }


@app.get("/api/progress/steps")
def progress_steps() -> dict:
    """Return the registered analysis pipeline steps for the loading UI."""
    return {"steps": pipeline_step_catalog()}


def _validate_gpx_upload(file: UploadFile, file_bytes: bytes) -> None:
    if not file.filename or not file.filename.lower().endswith(".gpx"):
        raise HTTPException(status_code=400, detail="Please upload a .gpx file.")
    if not file_bytes:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")


def _parse_poi_profile(raw: str | None) -> PoiPlanningProfile:
    if not raw:
        return DEFAULT_ULTRA_POI_PROFILE
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail="Invalid poi_profile JSON.") from exc
    return PoiPlanningProfile.from_dict(payload)


@app.get("/api/poi/profile/default")
def poi_profile_default() -> dict:
    return {
        "profile": DEFAULT_ULTRA_POI_PROFILE.to_dict(),
        "catalog": profile_catalog(),
    }


# --- Race projects (local) ---


class RaceRenameBody(BaseModel):
    name: str


class PreparationProgressBody(BaseModel):
    progress: dict[str, bool] = Field(default_factory=dict)
    verified_stops: dict[str, dict[str, Any]] | None = None


@app.get("/api/races")
def list_races() -> dict:
    return {"races": [summary.to_dict() for summary in race_store.list_races()]}


@app.post("/api/races")
async def create_race(
    file: UploadFile = File(...),
    name: str | None = Form(default=None),
) -> dict:
    file_bytes = await file.read()
    _validate_gpx_upload(file, file_bytes)
    race = race_store.create_race(filename=file.filename, gpx_bytes=file_bytes, name=name)
    return {"race": race_store.get_summary(race.id).to_dict()}


@app.get("/api/races/{race_id}")
def get_race(race_id: str) -> dict:
    race_open_trace("open_race.api.get_race.start", race_id=race_id)
    race = _require_race(race_id)
    race_store.touch_opened(race_id)
    race_open_trace("open_race.api.get_race.done", race_id=race_id)
    return {
        "race": race_store.get_summary(race_id).to_dict(),
        "settings": race.settings.to_dict(),
        "preparation": race.preparation.to_dict(),
        "exports": [record.to_dict() for record in race.exports],
    }


@app.patch("/api/races/{race_id}")
def patch_race(race_id: str, body: RaceRenameBody) -> dict:
    _require_race(race_id)
    race = race_store.rename_race(race_id, body.name)
    return {"race": race_store.get_summary(race.id).to_dict()}


@app.patch("/api/races/{race_id}/preparation")
def patch_race_preparation(race_id: str, body: PreparationProgressBody) -> dict:
    _require_race(race_id)
    race = race_store.update_preparation(
        race_id,
        progress=body.progress if body.progress else None,
        verified_stops=body.verified_stops,
    )
    return {
        "preparation": race.preparation.to_dict(),
        "race": race_store.get_summary(race_id).to_dict(),
    }


@app.delete("/api/races/{race_id}")
def delete_race(race_id: str) -> dict[str, str]:
    _require_race(race_id)
    clear_race_cache(race_id)
    race_store.delete_race(race_id)
    return {"status": "deleted"}


@app.get("/api/races/{race_id}/roadbook")
def get_race_roadbook(race_id: str) -> dict:
    race_open_trace("open_race.api.get_roadbook.start", race_id=race_id)
    _require_race(race_id)
    roadbook = race_store.load_analysis(race_id)
    if roadbook is None:
        race_open_trace("open_race.api.get_roadbook.missing", race_id=race_id)
        raise HTTPException(status_code=404, detail="This race has not been analyzed yet.")
    race_open_trace("open_race.api.get_roadbook.done", race_id=race_id)
    return roadbook


def _run_race_analysis_with_progress(
    race_id: str,
    loop: asyncio.AbstractEventLoop,
    queue: asyncio.Queue,
) -> None:
    def emit(event: dict) -> None:
        asyncio.run_coroutine_threadsafe(queue.put(event), loop)

    watchdog = StageWatchdog()
    watchdog.start()
    reporter = ProgressReporter(callback=emit, watchdog=watchdog)

    try:
        race = race_store.get_race(race_id)
        gpx_path = race_store.get_gpx_path(race_id)
        planning = _effective_race_planning(race_id)
        artifacts = analyze_race_gpx(
            race_id,
            gpx_path,
            progress=reporter,
            poi_profile=planning.poi_profile,
            climb_nicknames=race.preparation.climb_nicknames,
        )
        roadbook = roadbook_to_dict(artifacts.roadbook)
        race_store.save_analysis(race_id, roadbook)
        emit({"type": "complete", "data": roadbook})
    except PipelineStalledError as exc:
        emit({"type": "error", "detail": str(exc)})
    except FileNotFoundError as exc:
        emit({"type": "error", "detail": str(exc)})
    except ValueError as exc:
        emit({"type": "error", "detail": str(exc)})
    except RuntimeError as exc:
        emit({"type": "error", "detail": str(exc)})
    except Exception as exc:  # pragma: no cover
        emit({"type": "error", "detail": f"Analysis failed: {exc}"})
    finally:
        watchdog.stop()
        asyncio.run_coroutine_threadsafe(queue.put(None), loop)


@app.post("/api/races/{race_id}/analyze")
def analyze_race(race_id: str) -> dict:
    _require_race(race_id)
    race = race_store.get_race(race_id)
    gpx_path = race_store.get_gpx_path(race_id)
    planning = _effective_race_planning(race_id)
    try:
        artifacts = analyze_race_gpx(
            race_id,
            gpx_path,
            poi_profile=planning.poi_profile,
            climb_nicknames=race.preparation.climb_nicknames,
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    roadbook = roadbook_to_dict(artifacts.roadbook)
    race_store.save_analysis(race_id, roadbook)
    return roadbook


@app.post("/api/races/{race_id}/analyze/stream")
async def analyze_race_stream(race_id: str) -> StreamingResponse:
    _require_race(race_id)

    loop = asyncio.get_running_loop()
    queue: asyncio.Queue = asyncio.Queue()
    thread = threading.Thread(
        target=_run_race_analysis_with_progress,
        args=(race_id, loop, queue),
        daemon=True,
    )
    thread.start()

    async def event_stream():
        while True:
            event = await queue.get()
            if event is None:
                break
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/races/{race_id}/climbs/recalculate")
def recalculate_race_climbs(race_id: str, body: ClimbDetectionConfigBody) -> dict:
    _race_cache(race_id)
    try:
        config = ClimbDetectionConfig(
            smoothing_window_m=body.smoothing_window_m,
            rolling_gradient_window_m=body.rolling_gradient_window_m,
            gradient_threshold_pct=body.gradient_threshold_pct,
            meaningful_descent_threshold_m=body.meaningful_descent_threshold_m,
            min_elevation_gain_m=body.min_elevation_gain_m,
            min_average_gradient_pct=body.min_average_gradient_pct,
        )
        artifacts = recalculate_climbs(config, race_id=race_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    roadbook = roadbook_to_dict(artifacts.roadbook)
    race_store.save_analysis(race_id, roadbook)
    return {
        "climbs": roadbook["climbs"],
        "climb_candidates": roadbook["climb_candidates"],
        "summary": {"climb_count": roadbook["summary"]["climb_count"]},
        "config": config.to_dict(),
    }


@app.post("/api/races/{race_id}/climbs/nicknames")
def save_race_climb_nicknames(race_id: str, body: ClimbNicknamesBody) -> dict:
    _race_cache(race_id)
    try:
        artifacts = update_climb_nicknames(body.nicknames, race_id=race_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    race_store.update_preparation(race_id, climb_nicknames=body.nicknames)
    return {"climbs": [asdict(climb) for climb in artifacts.roadbook.climbs]}


@app.get("/api/races/{race_id}/preview/status")
def get_route_preview_status(race_id: str) -> dict:
    _require_race(race_id)
    return get_preview_status(race_id)


@app.post("/api/races/{race_id}/preview/generate/stream")
async def generate_route_preview_stream(race_id: str) -> StreamingResponse:
    _require_race(race_id)
    if not race_store.has_analysis(race_id):
        raise HTTPException(status_code=400, detail="Analyze this race before generating a route preview.")

    loop = asyncio.get_running_loop()
    queue: asyncio.Queue = asyncio.Queue()

    def emit(event: dict) -> None:
        asyncio.run_coroutine_threadsafe(queue.put(event), loop)

    try:
        start_preview_generation(race_id, emit)
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    async def event_stream():
        while True:
            event = await queue.get()
            if event is None:
                break
            yield f"data: {json.dumps(event)}\n\n"
            if event.get("type") in {"complete", "error"}:
                break
        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/races/{race_id}/preview/runtime")
def get_route_preview_runtime(race_id: str) -> FileResponse:
    _require_race(race_id)
    runtime_path = race_store.preview_runtime_path(race_id)
    if not runtime_path.is_file():
        raise HTTPException(status_code=404, detail="Route preview runtime has not been prepared yet.")
    return FileResponse(
        runtime_path,
        media_type="application/json",
        filename="runtime.json",
        headers=PREVIEW_NO_CACHE_HEADERS,
    )


@app.get("/api/races/{race_id}/preview/cache/{asset_path:path}")
def get_route_preview_cache_asset(race_id: str, asset_path: str) -> FileResponse:
    _require_race(race_id)
    cache_dir = race_store.preview_cache_dir(race_id).resolve()
    requested = (cache_dir / asset_path).resolve()
    if cache_dir not in requested.parents and requested != cache_dir:
        raise HTTPException(status_code=404, detail="Cache asset not found.")
    if not requested.is_file():
        raise HTTPException(status_code=404, detail="Cache asset not found.")
    media_types = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".json": "application/json",
        ".bin": "application/octet-stream",
    }
    return FileResponse(
        requested,
        media_type=media_types.get(requested.suffix.lower(), "application/octet-stream"),
        headers=PREVIEW_NO_CACHE_HEADERS,
    )


@app.post("/api/races/{race_id}/preview/prepare/stream")
async def prepare_route_preview_stream(race_id: str) -> StreamingResponse:
    _require_race(race_id)
    if not race_store.has_analysis(race_id):
        raise HTTPException(status_code=400, detail="Analyze this race before preparing a route preview.")

    loop = asyncio.get_running_loop()
    queue: asyncio.Queue = asyncio.Queue()

    def emit(event: dict) -> None:
        asyncio.run_coroutine_threadsafe(queue.put(event), loop)

    try:
        start_preview_prepare(race_id, emit)
    except RuntimeError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    async def event_stream():
        while True:
            event = await queue.get()
            yield f"data: {json.dumps(event)}\n\n"
            if event.get("type") in {"complete", "error", "done"}:
                break

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/races/{race_id}/preview/video")
def get_route_preview_video(race_id: str) -> FileResponse:
    _require_race(race_id)
    video_path = race_store.preview_video_path(race_id)
    if not video_path.is_file():
        raise HTTPException(status_code=404, detail="Route preview video has not been generated yet.")
    return FileResponse(
        video_path,
        media_type="video/mp4",
        filename="route-preview.mp4",
        headers=PREVIEW_NO_CACHE_HEADERS,
    )


@app.get("/api/races/{race_id}/exports/excel")
def export_race_excel(race_id: str) -> FileResponse:
    cache = _race_cache(race_id)
    export_path = race_store.export_path(race_id, "Roadbook.xlsx")
    export_path.parent.mkdir(parents=True, exist_ok=True)
    export_roadbook(cache.climbs_with_gradients, export_path, nicknames=cache.climb_nicknames)
    race_store.record_export(race_id, export_type="excel", filename="Roadbook.xlsx")
    return FileResponse(
        export_path,
        filename="Roadbook.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@app.get("/api/races/{race_id}/exports/validation-gpx")
def export_race_validation_gpx(race_id: str) -> FileResponse:
    cache = _race_cache(race_id)
    export_path = race_store.export_path(race_id, "surface_validation.gpx")
    export_path.parent.mkdir(parents=True, exist_ok=True)
    export_surface_validation_gpx(cache.track, cache.surface_dataset, export_path)
    race_store.record_export(race_id, export_type="validation_gpx", filename="surface_validation.gpx")
    return FileResponse(
        export_path,
        filename="surface_validation.gpx",
        media_type="application/gpx+xml",
    )


def _run_analysis_with_progress(
    file_name: str,
    file_bytes: bytes,
    loop: asyncio.AbstractEventLoop,
    queue: asyncio.Queue,
    poi_profile: PoiPlanningProfile,
) -> None:
    def emit(event: dict) -> None:
        asyncio.run_coroutine_threadsafe(queue.put(event), loop)

    watchdog = StageWatchdog()
    watchdog.start()
    reporter = ProgressReporter(callback=emit, watchdog=watchdog)

    try:
        artifacts = analyze_gpx_upload(
            file_name,
            file_bytes,
            progress=reporter,
            poi_profile=poi_profile,
        )
        emit({"type": "complete", "data": roadbook_to_dict(artifacts.roadbook)})
    except PipelineStalledError as exc:
        emit({"type": "error", "detail": str(exc)})
    except FileNotFoundError as exc:
        emit({"type": "error", "detail": str(exc)})
    except ValueError as exc:
        emit({"type": "error", "detail": str(exc)})
    except RuntimeError as exc:
        emit({"type": "error", "detail": str(exc)})
    except Exception as exc:  # pragma: no cover - defensive fallback
        emit({"type": "error", "detail": f"Analysis failed: {exc}"})
    finally:
        watchdog.stop()
        asyncio.run_coroutine_threadsafe(queue.put(None), loop)


@app.post("/api/generate")
async def generate_roadbook(
    file: UploadFile = File(...),
    poi_profile: str | None = Form(default=None),
) -> dict:
    """Analyze an uploaded GPX file and return roadbook data as JSON."""
    file_bytes = await file.read()
    _validate_gpx_upload(file, file_bytes)
    profile = _parse_poi_profile(poi_profile)

    try:
        artifacts = analyze_gpx_upload(file.filename, file_bytes, poi_profile=profile)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return roadbook_to_dict(artifacts.roadbook)


@app.post("/api/generate/stream")
async def generate_roadbook_stream(
    file: UploadFile = File(...),
    poi_profile: str | None = Form(default=None),
) -> StreamingResponse:
    """Analyze a GPX upload and stream real pipeline progress events."""
    file_bytes = await file.read()
    _validate_gpx_upload(file, file_bytes)
    profile = _parse_poi_profile(poi_profile)

    loop = asyncio.get_running_loop()
    queue: asyncio.Queue = asyncio.Queue()
    thread = threading.Thread(
        target=_run_analysis_with_progress,
        args=(file.filename, file_bytes, loop, queue, profile),
        daemon=True,
    )
    thread.start()

    async def event_stream():
        while True:
            event = await queue.get()
            if event is None:
                break
            yield f"data: {json.dumps(event)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/api/session/clear")
def clear_session() -> dict[str, str]:
    """Clear cached analysis data (used when loading a new route)."""
    clear_session_cache()
    return {"status": "cleared"}


@app.get("/api/export/excel")
def export_excel() -> FileResponse:
    """Export the current roadbook as an Excel file."""
    cache = _require_session()
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    export_roadbook(cache.climbs_with_gradients, EXCEL_PATH, nicknames=cache.climb_nicknames)
    return FileResponse(
        EXCEL_PATH,
        filename="Roadbook.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@app.get("/api/export/validation-gpx")
def export_validation_gpx() -> FileResponse:
    """Export the current route as a colored surface-validation GPX."""
    cache = _require_session()
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    export_surface_validation_gpx(cache.track, cache.surface_dataset, VALIDATION_GPX_PATH)
    return FileResponse(
        VALIDATION_GPX_PATH,
        filename="surface_validation.gpx",
        media_type="application/gpx+xml",
    )


# Serve the built React app when available (production / single-server mode).
if FRONTEND_DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str) -> FileResponse:
        file_path = FRONTEND_DIST / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(FRONTEND_DIST / "index.html")
