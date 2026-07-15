"""Track POI import/discard status through the detection pipeline."""

from __future__ import annotations

from dataclasses import dataclass

from poi_scoring import DEFAULT_POI_SCORE_WEIGHTS, PoiScoreWeights, score_poi
from poi_types import PointOfInterest
from resupply_zone_config import FOOD_POI_CATEGORIES, FUEL_POI_CATEGORIES, WATER_POI_CATEGORIES
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
    primary_score: float | None = None
    fuel_score: float | None = None
    food_score: float | None = None
    water_score: float | None = None
    cluster_winner: bool | None = None
    bundle_exported: bool | None = None


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
        primary_score=None,
        fuel_score=None,
        food_score=None,
        water_score=None,
        cluster_winner=None,
        bundle_exported=None,
    )


def _category_score(
    poi: PointOfInterest,
    members: frozenset[str],
    weights: PoiScoreWeights,
    score_cache: dict[tuple[int, str], float] | None,
) -> float | None:
    if poi.category not in members:
        return None
    if score_cache is not None:
        return score_cache.get((poi.osm_id, poi.osm_type), score_poi(poi, weights))
    return score_poi(poi, weights)


def _score_fields(
    poi: PointOfInterest,
    weights: PoiScoreWeights,
    score_cache: dict[tuple[int, str], float] | None,
) -> tuple[float | None, float | None, float | None, float | None]:
    fuel_score = _category_score(poi, FUEL_POI_CATEGORIES, weights, score_cache)
    food_score = _category_score(poi, FOOD_POI_CATEGORIES, weights, score_cache)
    water_score = _category_score(poi, WATER_POI_CATEGORIES, weights, score_cache)
    primary_score = fuel_score or food_score or water_score
    if primary_score is None and score_cache is not None:
        primary_score = score_cache.get((poi.osm_id, poi.osm_type))
    if primary_score is None:
        primary_score = score_poi(poi, weights)
    return primary_score, fuel_score, food_score, water_score


def _planning_score(option, category_key: str) -> float:
    score = float(option.score or 0)
    detour = float(option.distance_off_route_m or 0)
    boost = {"fuel": 10.0, "food": 5.0, "water": 2.0, "dining": 0.0}.get(category_key, 0.0)
    return score - min(detour / 8.0, 35.0) + boost


def _bundle_exported_keys(resupply_plan: ResupplyZonePlan) -> set[tuple[int, str]]:
    """POIs that appear in the Companion bundle for each zone."""
    exported: set[tuple[int, str]] = set()
    for zone in resupply_plan.zones:
        ranked: list[tuple] = []
        seen: set[tuple[int, str]] = set()
        for group in zone.categories:
            for option in [group.primary, *group.alternatives]:
                if option is None:
                    continue
                poi_key = (option.osm_id, option.osm_type)
                if poi_key in seen:
                    continue
                seen.add(poi_key)
                ranked.append((option, group.key))
        ranked.sort(key=lambda entry: _planning_score(entry[0], entry[1]), reverse=True)
        for option, _ in ranked[:6]:
            exported.add((option.osm_id, option.osm_type))
    return exported


def _zone_option_dict(option) -> dict | None:
    if option is None:
        return None
    return {
        "osm_id": option.osm_id,
        "osm_type": option.osm_type,
        "name": option.name,
        "poi_category": option.poi_category,
        "distance_along_km": option.distance_along_km,
        "distance_off_route_m": option.distance_off_route_m,
        "score": option.score,
        "brand": option.brand,
        "lat": option.lat,
        "lon": option.lon,
    }


def _enrich_entry(
    entry: PoiDebugEntry,
    poi_lookup: dict[tuple[int, str], PointOfInterest],
    weights: PoiScoreWeights,
    score_cache: dict[tuple[int, str], float] | None,
    bundle_keys: set[tuple[int, str]],
) -> PoiDebugEntry:
    poi_key = (entry.osm_id, entry.osm_type)
    poi = poi_lookup.get(poi_key)
    if poi is None:
        return entry
    primary_score, fuel_score, food_score, water_score = _score_fields(poi, weights, score_cache)
    return PoiDebugEntry(
        osm_id=entry.osm_id,
        osm_type=entry.osm_type,
        name=entry.name,
        brand=entry.brand,
        category=entry.category,
        lat=entry.lat,
        lon=entry.lon,
        status=entry.status,
        discard_stage=entry.discard_stage,
        discard_reason=entry.discard_reason,
        distance_along_km=entry.distance_along_km,
        distance_off_route_m=entry.distance_off_route_m,
        score=entry.score if entry.score is not None else primary_score,
        zone_id=entry.zone_id,
        cluster_id=entry.cluster_id,
        zone_role=entry.zone_role,
        primary_score=primary_score,
        fuel_score=fuel_score,
        food_score=food_score,
        water_score=water_score,
        cluster_winner=entry.zone_role == "primary",
        bundle_exported=poi_key in bundle_keys,
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
    bundle_keys = _bundle_exported_keys(resupply_plan)
    poi_lookup = {(poi.osm_id, poi.osm_type): poi for poi in imported_pois}

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
                primary_score=None,
                fuel_score=None,
                food_score=None,
                water_score=None,
                cluster_winner=None,
                bundle_exported=None,
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
            primary_score=None,
            fuel_score=None,
            food_score=None,
            water_score=None,
            cluster_winner=None,
            bundle_exported=None,
        )

    enriched = [
        _enrich_entry(entry, poi_lookup, weights, score_cache, bundle_keys) for entry in entries.values()
    ]
    return sorted(
        enriched,
        key=lambda entry: (
            entry.distance_along_km if entry.distance_along_km is not None else 9999.0,
            entry.osm_id,
        ),
    )
