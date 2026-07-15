"""Track POI import/discard status through the detection pipeline."""

from __future__ import annotations

from dataclasses import dataclass

from poi_scoring import PoiScoreWeights, score_poi
from poi_types import PointOfInterest
from resupply_zones import ResupplyZonePlan


@dataclass(frozen=True)
class PoiDebugEntry:
    """One POI candidate with pipeline outcome for Desktop map debug."""

    osm_id: int
    osm_type: str
    name: str | None
    brand: str | None
    category: str | None
    lat: float | None
    lon: float | None
    status: str  # imported | discarded
    discard_stage: str | None
    discard_reason: str | None
    distance_along_km: float | None
    distance_off_route_m: float | None
    score: float | None
    zone_id: int | None
    cluster_id: int | None
    zone_role: str | None  # primary | alternative | zone_member | None


def detection_discard_to_debug(discard) -> PoiDebugEntry:
    """Convert a POI detection discard record to a debug entry."""
    return PoiDebugEntry(
        osm_id=discard.osm_id,
        osm_type=discard.osm_type,
        name=discard.name,
        brand=discard.brand,
        category=discard.category,
        lat=discard.lat,
        lon=discard.lon,
        status="discarded",
        discard_stage=discard.discard_stage,
        discard_reason=discard.discard_reason,
        distance_along_km=discard.distance_along_km,
        distance_off_route_m=discard.distance_off_route_m,
        score=None,
        zone_id=None,
        cluster_id=None,
        zone_role=None,
    )


def _zone_membership(
    resupply_plan: ResupplyZonePlan,
    score_cache: dict[tuple[int, str], float] | None,
    weights: PoiScoreWeights,
) -> dict[tuple[int, str], PoiDebugEntry]:
    """Map imported POIs to zone role and cluster membership."""
    entries: dict[tuple[int, str], PoiDebugEntry] = {}

    for zone in resupply_plan.zones:
        zone_poi_keys: set[tuple[int, str]] = set()
        for group in zone.categories:
            if group.primary is not None:
                zone_poi_keys.add((group.primary.osm_id, group.primary.osm_type))
            for alternative in group.alternatives:
                zone_poi_keys.add((alternative.osm_id, alternative.osm_type))

        for poi_key in zone_poi_keys:
            role = "zone_member"
            for group in zone.categories:
                if group.primary and (group.primary.osm_id, group.primary.osm_type) == poi_key:
                    role = "primary"
                    break
                if any(
                    (option.osm_id, option.osm_type) == poi_key for option in group.alternatives
                ):
                    role = "alternative"
                    break

            option = _find_zone_poi(zone, poi_key)
            entries[poi_key] = PoiDebugEntry(
                osm_id=poi_key[0],
                osm_type=poi_key[1],
                name=option.name if option else None,
                brand=option.brand if option else None,
                category=option.poi_category if option else None,
                lat=option.lat if option else None,
                lon=option.lon if option else None,
                status="imported",
                discard_stage=None,
                discard_reason=None,
                distance_along_km=option.distance_along_km if option else None,
                distance_off_route_m=option.distance_off_route_m if option else None,
                score=option.score if option else None,
                zone_id=zone.zone_id,
                cluster_id=zone.zone_id,
                zone_role=role,
            )

    return entries


def _find_zone_poi(zone, poi_key: tuple[int, str]):
    for group in zone.categories:
        if group.primary and (group.primary.osm_id, group.primary.osm_type) == poi_key:
            return group.primary
        for option in group.alternatives:
            if (option.osm_id, option.osm_type) == poi_key:
                return option
    return None


def build_poi_debug_entries(
    imported_pois: list[PointOfInterest],
    resupply_plan: ResupplyZonePlan,
    discarded: list[PoiDebugEntry],
    *,
    score_cache: dict[tuple[int, str], float] | None = None,
    weights: PoiScoreWeights | None = None,
) -> list[PoiDebugEntry]:
    """Merge imported zone POIs with earlier-stage discards."""
    from poi_scoring import DEFAULT_POI_SCORE_WEIGHTS

    weights = weights or DEFAULT_POI_SCORE_WEIGHTS
    zone_entries = _zone_membership(resupply_plan, score_cache, weights)

    entries: dict[tuple[int, str], PoiDebugEntry] = {
        (entry.osm_id, entry.osm_type): entry for entry in discarded
    }

    for poi in imported_pois:
        poi_key = (poi.osm_id, poi.osm_type)
        zone_id = resupply_plan.poi_zone_ids.get(poi_key)
        cached = zone_entries.get(poi_key)
        resolved_score = (
            score_cache.get(poi_key, score_poi(poi, weights)) if score_cache else score_poi(poi, weights)
        )

        if cached is not None:
            entries[poi_key] = cached
            continue

        if zone_id is None:
            entries[poi_key] = PoiDebugEntry(
                osm_id=poi.osm_id,
                osm_type=poi.osm_type,
                name=poi.name,
                brand=poi.brand,
                category=poi.category,
                lat=poi.lat,
                lon=poi.lon,
                status="discarded",
                discard_stage="clustering",
                discard_reason="Not assigned to a resupply zone",
                distance_along_km=poi.distance_along_km,
                distance_off_route_m=poi.distance_off_route_m,
                score=resolved_score,
                zone_id=None,
                cluster_id=None,
                zone_role=None,
            )
            continue

        entries[poi_key] = PoiDebugEntry(
            osm_id=poi.osm_id,
            osm_type=poi.osm_type,
            name=poi.name,
            brand=poi.brand,
            category=poi.category,
            lat=poi.lat,
            lon=poi.lon,
            status="imported",
            discard_stage=None,
            discard_reason=None,
            distance_along_km=poi.distance_along_km,
            distance_off_route_m=poi.distance_off_route_m,
            score=resolved_score,
            zone_id=zone_id,
            cluster_id=zone_id,
            zone_role="zone_member",
        )

    return sorted(
        entries.values(),
        key=lambda entry: (
            entry.distance_along_km if entry.distance_along_km is not None else 9999.0,
            entry.osm_id,
        ),
    )
