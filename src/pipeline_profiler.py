"""Pipeline stage timing and memory profiling."""

from __future__ import annotations

import sys
import time
from contextlib import contextmanager
from dataclasses import dataclass, field


def _memory_peak_mb() -> float:
    try:
        import resource

        usage = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        if sys.platform == "darwin":
            return usage / (1024 * 1024)
        return usage / 1024
    except Exception:
        return 0.0


@dataclass
class StageTiming:
    """Measured runtime for one pipeline stage."""

    stage_id: str
    label: str
    duration_s: float


@dataclass
class PipelineProfiler:
    """Collect per-stage execution times during analysis."""

    _timings: list[StageTiming] = field(default_factory=list)
    _active: dict[str, tuple[str, float]] = field(default_factory=dict)

    @contextmanager
    def stage(self, stage_id: str, label: str):
        """Time one pipeline stage."""
        started = time.perf_counter()
        self._active[stage_id] = (label, started)
        try:
            yield
        finally:
            _, stage_started = self._active.pop(stage_id, (label, started))
            duration_s = time.perf_counter() - stage_started
            self._timings.append(StageTiming(stage_id, label, duration_s))

    def record(self, stage_id: str, label: str, duration_s: float) -> None:
        """Record a pre-measured stage duration."""
        self._timings.append(StageTiming(stage_id, label, duration_s))

    @property
    def memory_peak_mb(self) -> float:
        return round(_memory_peak_mb(), 1)

    @property
    def total_s(self) -> float:
        return sum(timing.duration_s for timing in self._timings)

    def report(self) -> list[dict[str, str | float]]:
        """Return stage timings with percentage of total runtime."""
        total = self.total_s
        rows: list[dict[str, str | float]] = []
        for timing in self._timings:
            pct = (timing.duration_s / total * 100.0) if total > 0 else 0.0
            rows.append(
                {
                    "stage_id": timing.stage_id,
                    "label": timing.label,
                    "duration_s": round(timing.duration_s, 1),
                    "percent": round(pct, 1),
                }
            )
        rows.append(
            {
                "stage_id": "total",
                "label": "Total",
                "duration_s": round(total, 1),
                "percent": 100.0,
            }
        )
        return rows
