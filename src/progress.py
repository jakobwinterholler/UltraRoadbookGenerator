"""Modular analysis progress reporting for the web UI."""

from __future__ import annotations

import logging
import threading
from dataclasses import dataclass
from typing import Callable, Literal

logger = logging.getLogger(__name__)

ProgressStatus = Literal["active", "complete", "error"]
ReadinessStatus = Literal["waiting", "running", "ready"]


@dataclass(frozen=True)
class ProgressStepDefinition:
    """One registered pipeline step shown in the loading UI."""

    id: str
    label: str
    active_label: str | None = None


@dataclass(frozen=True)
class AnalysisStageDefinition:
    """Weighted analysis stage for overall progress calculation."""

    id: str
    label: str
    weight: float


# Legacy step catalog — still emitted for compatibility.
PIPELINE_STEPS: tuple[ProgressStepDefinition, ...] = (
    ProgressStepDefinition("reading_gpx", "Reading GPX"),
    ProgressStepDefinition("calculating_distance", "Calculating distance"),
    ProgressStepDefinition(
        "osm_surface_data",
        "Downloading OSM data",
        active_label="Downloading OSM data",
    ),
    ProgressStepDefinition("detecting_surfaces", "Detecting surfaces"),
    ProgressStepDefinition(
        "osm_poi_data",
        "Downloading POI data",
        active_label="Downloading POI data",
    ),
    ProgressStepDefinition("finding_pois", "Finding POIs"),
    ProgressStepDefinition("creating_resupply_zones", "Creating Resupply Zones"),
    ProgressStepDefinition("detecting_climbs", "Detecting climbs"),
    ProgressStepDefinition("calculating_gradients", "Calculating gradients"),
    ProgressStepDefinition("calculating_resupply_quality", "Calculating Resupply Quality"),
    ProgressStepDefinition("generating_route_visualization", "Generating Route Visualization"),
    ProgressStepDefinition("preparing_dashboard", "Preparing Dashboard"),
    ProgressStepDefinition("complete", "Complete"),
)

ANALYSIS_STAGES: tuple[AnalysisStageDefinition, ...] = (
    AnalysisStageDefinition("reading_gpx", "Read GPX", 0.02),
    AnalysisStageDefinition("calculating_distance", "Parse geometry", 0.03),
    AnalysisStageDefinition("generate_map", "Generate map", 0.05),
    AnalysisStageDefinition("osm_surface_data", "Download surface data", 0.10),
    AnalysisStageDefinition("osm_poi_data", "Download POI data", 0.10),
    AnalysisStageDefinition("detecting_surfaces", "Detect surfaces", 0.22),
    AnalysisStageDefinition("finding_pois", "Find POIs", 0.20),
    AnalysisStageDefinition("creating_resupply_zones", "Generate resupply zones", 0.05),
    AnalysisStageDefinition("detecting_climbs", "Detect climbs", 0.04),
    AnalysisStageDefinition("calculating_gradients", "Calculate gradients", 0.03),
    AnalysisStageDefinition("calculating_resupply_quality", "Resupply quality", 0.01),
    AnalysisStageDefinition("generating_route_visualization", "Generate timeline", 0.03),
    AnalysisStageDefinition("preparing_dashboard", "Prepare dashboard", 0.02),
)

STAGE_WEIGHTS = {stage.id: stage.weight for stage in ANALYSIS_STAGES}
CHECKLIST_STAGES: tuple[AnalysisStageDefinition, ...] = (
    AnalysisStageDefinition("reading_gpx", "Read GPX", 0.02),
    AnalysisStageDefinition("calculating_distance", "Parse geometry", 0.03),
    AnalysisStageDefinition("generate_map", "Generate map", 0.05),
    AnalysisStageDefinition("detecting_climbs", "Detect climbs", 0.04),
    AnalysisStageDefinition("detecting_surfaces", "Detect surfaces", 0.22),
    AnalysisStageDefinition("finding_pois", "Find POIs", 0.20),
    AnalysisStageDefinition("creating_resupply_zones", "Generate resupply zones", 0.05),
    AnalysisStageDefinition("generating_route_visualization", "Generate timeline", 0.03),
    AnalysisStageDefinition("preparing_dashboard", "Prepare dashboard", 0.02),
)

STEP_BY_ID = {step.id: step for step in PIPELINE_STEPS}


ProgressEventCallback = Callable[[dict], None]


class ProgressReporter:
    """Emit structured step events for streaming analysis progress."""

    def __init__(
        self,
        callback: ProgressEventCallback | None = None,
        *,
        watchdog: "StageWatchdog | None" = None,
    ) -> None:
        self._callback = callback
        self._watchdog = watchdog
        self._lock = threading.Lock()
        self._active_step_id: str | None = None
        self._stage_fractions: dict[str, float] = {stage.id: 0.0 for stage in ANALYSIS_STAGES}
        self._active_stage_id: str | None = None
        self._active_stage_label: str | None = None
        self._stats: dict[str, float | int | str | None] = {}
        self._readiness: dict[str, ReadinessStatus] = {
            "distance": "waiting",
            "elevation": "waiting",
            "map": "waiting",
            "climbs": "waiting",
            "surface": "waiting",
            "pois": "waiting",
            "resupply": "waiting",
            "timeline": "waiting",
        }

    @property
    def steps(self) -> tuple[ProgressStepDefinition, ...]:
        return PIPELINE_STEPS

    @property
    def total_steps(self) -> int:
        return len(PIPELINE_STEPS)

    def _emit(self, payload: dict) -> None:
        stage_id = payload.get("stage_id") or payload.get("step_id") or self._active_stage_id
        label = payload.get("label")
        if self._watchdog is not None:
            self._watchdog.check()
            self._watchdog.heartbeat(
                stage_id=str(stage_id) if stage_id else None,
                label=str(label) if isinstance(label, str) else None,
            )
        if self._callback is None:
            return
        with self._lock:
            self._callback(payload)

    def transition(self, message: str) -> None:
        """Log a pipeline transition for debugging (also visible in the UI activity log)."""
        logger.info("Pipeline: %s", message)
        self._emit({"type": "log", "message": message, "level": "debug"})

    def _emit_step(
        self,
        step_id: str,
        status: ProgressStatus,
        *,
        label: str | None = None,
        detail: str | None = None,
    ) -> None:
        step = STEP_BY_ID.get(step_id)
        resolved_label = label or (step.label if step else step_id)
        self._emit(
            {
                "type": "step",
                "step_id": step_id,
                "status": status,
                "label": resolved_label,
                "detail": detail,
                "step_index": next(
                    (index for index, item in enumerate(PIPELINE_STEPS) if item.id == step_id),
                    -1,
                ),
                "total_steps": len(PIPELINE_STEPS),
            }
        )

    def _overall_percent(self) -> float:
        total = 0.0
        for stage in ANALYSIS_STAGES:
            fraction = self._stage_fractions.get(stage.id, 0.0)
            total += stage.weight * max(0.0, min(1.0, fraction))
        return round(total * 100, 1)

    def _emit_analysis_progress(self, *, label: str | None = None) -> None:
        resolved_label = label or self._active_stage_label or "Analysing route…"
        self._emit(
            {
                "type": "progress",
                "percent": self._overall_percent(),
                "stage_id": self._active_stage_id,
                "label": resolved_label,
            }
        )

    def set_stage_fraction(
        self,
        stage_id: str,
        fraction: float,
        *,
        label: str | None = None,
    ) -> None:
        self._stage_fractions[stage_id] = max(0.0, min(1.0, fraction))
        self._active_stage_id = stage_id
        if label:
            self._active_stage_label = label
        self._emit_analysis_progress(label=label)

    def complete_stage(self, stage_id: str, *, label: str | None = None) -> None:
        self._stage_fractions[stage_id] = 1.0
        self._active_stage_id = stage_id
        if label:
            self._active_stage_label = label
        self._emit_analysis_progress(label=label)

    def start(self, step_id: str, *, label: str | None = None, detail: str | None = None) -> None:
        self._active_step_id = step_id
        step = STEP_BY_ID.get(step_id)
        resolved_label = label or (step.active_label if step and step.active_label else step.label if step else step_id)
        logger.info("Stage start: %s (%s)", step_id, resolved_label)
        self.transition(f"Started · {resolved_label}")
        self._emit_step(step_id, "active", label=resolved_label, detail=detail)
        if step_id in STAGE_WEIGHTS and self._stage_fractions.get(step_id, 0.0) <= 0.0:
            self.set_stage_fraction(step_id, 0.0, label=resolved_label)

    def complete(self, step_id: str, *, label: str | None = None, detail: str | None = None) -> None:
        if self._active_step_id == step_id:
            self._active_step_id = None
        step = STEP_BY_ID.get(step_id)
        resolved_label = label or (step.label if step else step_id)
        detail_suffix = f" ({detail})" if detail else ""
        logger.info("Stage complete: %s%s", step_id, detail_suffix)
        self.transition(f"Completed · {resolved_label}{detail_suffix}")
        self._emit_step(step_id, "complete", label=resolved_label, detail=detail)
        if step_id in STAGE_WEIGHTS:
            self.complete_stage(step_id, label=resolved_label)

    def error(self, step_id: str, detail: str) -> None:
        logger.error("Stage error: %s — %s", step_id, detail)
        self.transition(f"Failed · {detail}")
        self._emit_step(step_id, "error", detail=detail)
        self._emit({"type": "error", "detail": detail, "stage_id": step_id})

    def osm_surface_label(self, downloaded: bool) -> str:
        return "Downloading OSM data" if downloaded else "Using cached OSM data"

    def osm_poi_label(self, downloaded: bool) -> str:
        return "Downloading POI data" if downloaded else "Using cached POI data"

    def partial(self, slice_id: str, data: dict) -> None:
        if self._callback is None:
            return
        self._callback({"type": "partial", "slice": slice_id, "data": data})

    def performance(self, report: list[dict], *, summary: dict | None = None) -> None:
        if self._callback is None:
            return
        payload: dict = {"type": "performance", "report": report}
        if summary is not None:
            payload["summary"] = summary
        self._callback(payload)

    def subprogress(
        self,
        stage_id: str,
        current: int,
        total: int,
        label: str,
    ) -> None:
        if total <= 0:
            return
        fraction = current / total
        self.set_stage_fraction(stage_id, fraction, label=label)
        self._emit(
            {
                "type": "subprogress",
                "stage_id": stage_id,
                "current": current,
                "total": total,
                "label": label,
            }
        )

    def update_stats(self, **values: float | int | str | None) -> None:
        self._stats.update(values)
        self._emit({"type": "stats", "payload": dict(self._stats)})

    def readiness(self, slice_id: str, status: ReadinessStatus) -> None:
        self._readiness[slice_id] = status
        self._emit({"type": "readiness", "slice": slice_id, "status": status})

    def milestone(self, message: str) -> None:
        self._emit({"type": "log", "message": message, "level": "info"})


def pipeline_step_catalog() -> list[dict[str, str | None]]:
    """Return the registered pipeline steps for the frontend."""
    return [
        {
            "id": step.id,
            "label": step.label,
            "active_label": step.active_label,
        }
        for step in PIPELINE_STEPS
    ]


def analysis_checklist_catalog() -> list[dict[str, str | float]]:
    """Return weighted checklist stages for the analysis UI."""
    return [
        {"id": stage.id, "label": stage.label, "weight": stage.weight}
        for stage in CHECKLIST_STAGES
    ]
