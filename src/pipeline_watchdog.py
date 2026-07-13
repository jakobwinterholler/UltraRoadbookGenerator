"""Detect stalled analysis stages and fail fast instead of hanging forever."""

from __future__ import annotations

import logging
import os
import threading
from typing import Callable

logger = logging.getLogger(__name__)

DEFAULT_STAGE_STALL_TIMEOUT_S = float(os.environ.get("ANALYSIS_STAGE_TIMEOUT_S", "600"))


class PipelineStalledError(RuntimeError):
    """Raised when a pipeline stage stops reporting progress for too long."""

    def __init__(self, stage_id: str, label: str, timeout_s: float) -> None:
        self.stage_id = stage_id
        self.label = label
        self.timeout_s = timeout_s
        super().__init__(
            f"Analysis stalled during “{label}” ({stage_id}). "
            f"No progress for {int(timeout_s)} seconds. "
            "Try again, disable POI profile options you don't need, or use cached OSM data."
        )


class StageWatchdog:
    """
    Reset a timer whenever progress is reported.
    If the timer fires, invoke on_stall (typically raises PipelineStalledError).
    """

    def __init__(
        self,
        timeout_s: float = DEFAULT_STAGE_STALL_TIMEOUT_S,
        on_stall: Callable[[], None] | None = None,
    ) -> None:
        self.timeout_s = timeout_s
        self._on_stall = on_stall
        self._lock = threading.Lock()
        self._timer: threading.Timer | None = None
        self._active_stage_id = "startup"
        self._active_label = "Starting analysis"
        self._running = False
        self._stalled = False
        self._stall_error: PipelineStalledError | None = None

    @property
    def active_stage_id(self) -> str:
        return self._active_stage_id

    @property
    def active_label(self) -> str:
        return self._active_label

    def start(self) -> None:
        with self._lock:
            self._running = True
            self._schedule_locked()

    def stop(self) -> None:
        with self._lock:
            self._running = False
            if self._timer is not None:
                self._timer.cancel()
                self._timer = None

    def heartbeat(self, *, stage_id: str | None = None, label: str | None = None) -> None:
        with self._lock:
            if stage_id:
                self._active_stage_id = stage_id
            if label:
                self._active_label = label
            if self._running:
                self._schedule_locked()

    def _schedule_locked(self) -> None:
        if self._timer is not None:
            self._timer.cancel()
        self._timer = threading.Timer(self.timeout_s, self._handle_timeout)
        self._timer.daemon = True
        self._timer.name = f"analysis-watchdog-{self._active_stage_id}"
        self._timer.start()

    def check(self) -> None:
        """Raise if the watchdog detected a stall (call from long-running loops)."""
        if self._stall_error is not None:
            raise self._stall_error

    def _handle_timeout(self) -> None:
        with self._lock:
            if not self._running:
                return
            stage_id = self._active_stage_id
            label = self._active_label
            self._stalled = True
            self._stall_error = PipelineStalledError(stage_id, label, self.timeout_s)
        logger.error(
            "Analysis watchdog timeout after %ss at stage=%s label=%s",
            self.timeout_s,
            stage_id,
            label,
        )
        if self._on_stall is not None:
            self._on_stall()
