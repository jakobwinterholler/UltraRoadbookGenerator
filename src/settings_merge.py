"""Merge app defaults with per-race overrides."""

from __future__ import annotations

from app_settings import AppSettings, PlanningDefaults
from race_project import RaceSettings


def effective_planning(app: AppSettings, race: RaceSettings | None) -> PlanningDefaults:
    base = app.planning
    if race is None or race.use_app_defaults:
        return base

    return PlanningDefaults(
        poi_profile=race.poi_profile or base.poi_profile,
        climb_sensitivity=race.climb_sensitivity or base.climb_sensitivity,
        climb_config=race.climb_config or base.climb_config,
        preferred_stage_length_km=race.preferred_stage_length_km or base.preferred_stage_length_km,
        max_gap_without_resupply_km=race.max_gap_without_resupply_km or base.max_gap_without_resupply_km,
        default_arrival_time_window=(
            race.default_arrival_time_window
            if race.default_arrival_time_window is not None
            else base.default_arrival_time_window
        ),
        default_zone_density=race.default_zone_density or base.default_zone_density,
    )


def effective_settings_payload(app: AppSettings, race: RaceSettings | None, *, scope: str) -> dict:
    planning = effective_planning(app, race)
    return {
        "scope": scope,
        "use_app_defaults": race.use_app_defaults if race is not None else True,
        "planning": planning.to_dict(),
        "analysis": app.analysis.to_dict(),
        "appearance": app.appearance.to_dict(),
    }
