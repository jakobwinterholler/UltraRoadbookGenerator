"""POI detection engine: OSM download, classification, and route projection."""

from dataclasses import dataclass
import hashlib
import json
import time
from pathlib import Path

from gpx_parser import TrackPoint
from osm_fetch import fetch_overpass_query
from poi_profile import (
    DINING_CATEGORIES,
    FOOD_RESUPPLY_CATEGORIES,
    PoiPlanningProfile,
    DEFAULT_ULTRA_POI_PROFILE,
    profile_includes_dining,
)
from poi_types import PoiDataset, PointOfInterest, active_overpass_filters, category_from_tags, is_dining_category
from progress import ProgressReporter
from route_geometry import track_bounding_box
from route_segment_index import RouteSegmentIndex

# --- OSM download settings ---

BBOX_BUFFER_M = 500.0
MAX_OFF_ROUTE_M = 500.0
# Gas stations beside highways can sit further from the GPX track.
FUEL_MAX_OFF_ROUTE_M = 1200.0

OVERPASS_URLS = (
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
)

OVERPASS_MAX_RETRIES = 4
OVERPASS_RETRY_DELAY_S = 3.0


@dataclass(frozen=True)
class PoiDetectionDiscard:
    """One OSM element rejected during POI detection."""

    osm_id: int
    osm_type: str
    name: str | None
    brand: str | None
    category: str | None
    lat: float | None
    lon: float | None
    discard_stage: str
    discard_reason: str
    distance_along_km: float | None = None
    distance_off_route_m: float | None = None


def _cache_path(cache_dir: Path, gpx_path: Path, profile: PoiPlanningProfile) -> Path:
    profile_key = "_".join(
        key
        for key, enabled in sorted(profile.to_dict().items())
        if isinstance(enabled, bool) and enabled
    )
    profile_hash = hashlib.sha256(profile_key.encode("utf-8")).hexdigest()[:4]
    return cache_dir / f"poi_{gpx_path.stem}_{profile_hash}.json"


def _build_overpass_query(
    bbox: tuple[float, float, float, float],
    profile: PoiPlanningProfile,
) -> str:
    south, west, north, east = bbox
    filters = "\n      ".join(
        f"{poi_filter}({south},{west},{north},{east});"
        for poi_filter in active_overpass_filters(profile)
    )
    return f"""
    [out:json][timeout:180];
    (
      {filters}
    );
    out center tags;
    """


def poi_bbox(track: list[TrackPoint]) -> tuple[float, float, float, float]:
    return track_bounding_box(track, BBOX_BUFFER_M)


def load_poi_osm_elements(
    track: list[TrackPoint],
    cache_dir: Path,
    gpx_path: Path,
    profile: PoiPlanningProfile,
    *,
    refresh_osm: bool = False,
) -> tuple[list[dict] | None, bool]:
    cache_file = _cache_path(cache_dir, gpx_path, profile)
    if refresh_osm and cache_file.is_file():
        cache_file.unlink()
        return None, True

    cached = _load_osm_cache(cache_file, track)
    if cached is not None:
        return cached, False
    return None, True


def fetch_poi_osm_elements(
    track: list[TrackPoint],
    cache_dir: Path,
    gpx_path: Path,
    profile: PoiPlanningProfile,
) -> list[dict]:
    bbox = poi_bbox(track)
    elements = _fetch_osm_elements(bbox, profile)
    _save_osm_cache(_cache_path(cache_dir, gpx_path, profile), track, elements)
    return elements


def _fetch_osm_elements(
    bbox: tuple[float, float, float, float],
    profile: PoiPlanningProfile,
) -> list[dict]:
    query = _build_overpass_query(bbox, profile)
    return fetch_overpass_query(query)


def _fetch_osm_elements_with_progress(
    bbox: tuple[float, float, float, float],
    profile: PoiPlanningProfile,
    progress: ProgressReporter | None,
) -> list[dict]:
    if progress is not None:
        progress.transition("Downloading POI data from OpenStreetMap…")
        progress.set_stage_fraction("osm_poi_data", 0.2, label="Downloading POI data")
    return fetch_overpass_query(_build_overpass_query(bbox, profile))


def _load_osm_cache(
    cache_file: Path,
    track: list[TrackPoint],
) -> list[dict] | None:
    if not cache_file.is_file():
        return None

    with cache_file.open(encoding="utf-8") as handle:
        cached = json.load(handle)

    cached_distance_km = cached.get("route_distance_km")
    current_distance_km = round(track[-1].distance_km, 3)
    if cached_distance_km != current_distance_km:
        return None

    return cached.get("elements", [])


def _save_osm_cache(cache_file: Path, track: list[TrackPoint], elements: list[dict]) -> None:
    cache_file.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "route_distance_km": round(track[-1].distance_km, 3),
        "elements": elements,
    }
    with cache_file.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle)


def _load_osm_elements(
    track: list[TrackPoint],
    cache_dir: Path,
    gpx_path: Path,
    profile: PoiPlanningProfile,
    *,
    refresh_osm: bool = False,
    progress: ProgressReporter | None = None,
    prefetched_elements: list[dict] | None = None,
) -> tuple[list[dict], bool]:
    if prefetched_elements is not None:
        return prefetched_elements, True

    cached, needs_download = load_poi_osm_elements(
        track,
        cache_dir,
        gpx_path,
        profile,
        refresh_osm=refresh_osm,
    )
    if cached is not None:
        return cached, False

    bbox = poi_bbox(track)
    if progress is not None:
        elements = _fetch_osm_elements_with_progress(bbox, profile, progress)
    else:
        elements = fetch_poi_osm_elements(track, cache_dir, gpx_path, profile)
        return elements, True

    _save_osm_cache(_cache_path(cache_dir, gpx_path, profile), track, elements)
    return elements, True


def _element_coordinates(element: dict) -> tuple[float, float] | None:
    if element.get("type") == "node":
        lat = element.get("lat")
        lon = element.get("lon")
        if lat is None or lon is None:
            return None
        return float(lat), float(lon)

    center = element.get("center")
    if center and "lat" in center and "lon" in center:
        return float(center["lat"]), float(center["lon"])

    geometry = element.get("geometry")
    if geometry:
        lats = [point["lat"] for point in geometry]
        lons = [point["lon"] for point in geometry]
        return sum(lats) / len(lats), sum(lons) / len(lons)

    return None


def _normalize_tags(raw_tags: dict | None) -> dict[str, str]:
    if not raw_tags:
        return {}
    return {str(key): str(value) for key, value in raw_tags.items()}


def _nearest_food_distance_km(
    distance_along_km: float,
    food_distances_km: list[float],
) -> float | None:
    if not food_distances_km:
        return None

    nearest = min(abs(distance - distance_along_km) for distance in food_distances_km)
    return nearest


def _keep_dining_poi(
    poi: PointOfInterest,
    profile: PoiPlanningProfile,
    food_distances_km: list[float],
) -> bool:
    if not is_dining_category(poi.category):
        return True
    if profile_includes_dining(profile):
        return True
    if not profile.dining_fallback_enabled:
        return False

    nearest_food_km = _nearest_food_distance_km(poi.distance_along_km, food_distances_km)
    if nearest_food_km is None:
        return True
    return nearest_food_km >= profile.dining_fallback_km


def _build_poi(
    element: dict,
    route_index: RouteSegmentIndex,
    profile: PoiPlanningProfile,
) -> tuple[PointOfInterest | None, PoiDetectionDiscard | None]:
    tags = _normalize_tags(element.get("tags"))
    classification = category_from_tags(tags, profile=profile)
    osm_id = element.get("id")
    osm_type = element.get("type")
    name = tags.get("name")
    brand = tags.get("brand")

    if osm_id is None or osm_type is None:
        return None, None

    osm_id_int = int(osm_id)
    osm_type_str = str(osm_type)

    if classification is None:
        return None, PoiDetectionDiscard(
            osm_id=osm_id_int,
            osm_type=osm_type_str,
            name=name,
            brand=brand,
            category=None,
            lat=None,
            lon=None,
            discard_stage="category",
            discard_reason="Unsupported or disabled OSM category",
        )

    category, priority = classification
    coordinates = _element_coordinates(element)
    if coordinates is None:
        return None, PoiDetectionDiscard(
            osm_id=osm_id_int,
            osm_type=osm_type_str,
            name=name,
            brand=brand,
            category=category,
            lat=None,
            lon=None,
            discard_stage="geometry",
            discard_reason="Missing coordinates",
        )

    lat, lon = coordinates
    max_off_route_m = FUEL_MAX_OFF_ROUTE_M if category == "Gas station" else MAX_OFF_ROUTE_M
    projection = route_index.project(lat, lon, search_radius_m=max_off_route_m)
    if projection is None:
        return None, PoiDetectionDiscard(
            osm_id=osm_id_int,
            osm_type=osm_type_str,
            name=name,
            brand=brand,
            category=category,
            lat=round(lat, 6),
            lon=round(lon, 6),
            discard_stage="distance",
            discard_reason=f"No route segment within {int(max_off_route_m)} m",
        )

    if projection.distance_off_route_m > max_off_route_m:
        return None, PoiDetectionDiscard(
            osm_id=osm_id_int,
            osm_type=osm_type_str,
            name=name,
            brand=brand,
            category=category,
            lat=round(lat, 6),
            lon=round(lon, 6),
            discard_stage="distance",
            discard_reason=f"Too far from route ({round(projection.distance_off_route_m)} m > {int(max_off_route_m)} m)",
            distance_along_km=round(projection.distance_along_km, 2),
            distance_off_route_m=round(projection.distance_off_route_m, 0),
        )

    return PointOfInterest(
        osm_id=osm_id_int,
        osm_type=osm_type_str,
        name=name,
        category=category,
        priority=int(priority),
        lat=round(lat, 6),
        lon=round(lon, 6),
        distance_along_km=round(projection.distance_along_km, 2),
        distance_off_route_m=round(projection.distance_off_route_m, 0),
        tags=tags,
        opening_hours=tags.get("opening_hours"),
        brand=brand,
    ), None


def detect_pois(
    track: list[TrackPoint],
    gpx_path: Path,
    cache_dir: Path,
    *,
    refresh_osm: bool = False,
    progress: ProgressReporter | None = None,
    profile: PoiPlanningProfile = DEFAULT_ULTRA_POI_PROFILE,
    route_index: RouteSegmentIndex | None = None,
    prefetched_elements: list[dict] | None = None,
) -> PoiDataset:
    """Extract POIs near the GPX route."""
    if not track:
        return PoiDataset(pois=[], osm_load_s=0.0, matching_s=0.0)

    print("Loading POIs...")
    load_start = time.perf_counter()
    cache_file = _cache_path(cache_dir, gpx_path, profile)
    using_cache = not refresh_osm and _load_osm_cache(cache_file, track) is not None
    if progress is not None:
        progress.start("osm_poi_data", label=progress.osm_poi_label(not using_cache))
    elements, downloaded = _load_osm_elements(
        track,
        cache_dir,
        gpx_path,
        profile,
        refresh_osm=refresh_osm,
        progress=progress,
        prefetched_elements=prefetched_elements,
    )
    if progress is not None:
        progress.complete("osm_poi_data", label=progress.osm_poi_label(downloaded))
        progress.set_stage_fraction("osm_poi_data", 1.0, label=progress.osm_poi_label(downloaded))
        progress.milestone(
            "Downloaded POI data from OpenStreetMap"
            if downloaded
            else "Using cached POI data",
        )
    load_elapsed = time.perf_counter() - load_start
    if downloaded:
        print(f"✓ Done ({load_elapsed:.1f}s)")
    else:
        print(f"✓ Done ({load_elapsed:.1f}s, from cache)")

    print("Matching POIs to route...")
    if progress is not None:
        progress.start("finding_pois")
    match_start = time.perf_counter()

    resolved_index = route_index or RouteSegmentIndex.build(track)
    primary_pois: list[PointOfInterest] = []
    dining_candidates: list[PointOfInterest] = []
    discarded: list[PoiDetectionDiscard] = []
    total_elements = len(elements)
    report_interval = max(1, total_elements // 25)

    for index, element in enumerate(elements):
        if progress is not None and (index == 0 or index % report_interval == 0 or index == total_elements - 1):
            progress.subprogress(
                "finding_pois",
                index + 1,
                total_elements,
                "Processing POIs",
            )

        poi, discard = _build_poi(element, resolved_index, profile)
        if discard is not None:
            discarded.append(discard)
        if poi is None:
            continue
        if poi.category in DINING_CATEGORIES:
            dining_candidates.append(poi)
        else:
            primary_pois.append(poi)

    food_distances_km = sorted(
        poi.distance_along_km
        for poi in primary_pois
        if poi.category in FOOD_RESUPPLY_CATEGORIES
    )

    pois = list(primary_pois)
    for poi in dining_candidates:
        if _keep_dining_poi(poi, profile, food_distances_km):
            pois.append(poi)
        else:
            discarded.append(
                PoiDetectionDiscard(
                    osm_id=poi.osm_id,
                    osm_type=poi.osm_type,
                    name=poi.name,
                    brand=poi.brand,
                    category=poi.category,
                    lat=poi.lat,
                    lon=poi.lon,
                    discard_stage="dining_filter",
                    discard_reason="Dining fallback skipped — food resupply nearby",
                    distance_along_km=poi.distance_along_km,
                    distance_off_route_m=poi.distance_off_route_m,
                )
            )

    pois.sort(key=lambda poi: (poi.priority, poi.distance_along_km, poi.distance_off_route_m))
    match_elapsed = time.perf_counter() - match_start
    print(f"✓ Done ({match_elapsed:.1f}s, {len(pois)} POIs)")
    if progress is not None:
        progress.complete("finding_pois", detail=f"{len(pois)} POIs")
        progress.update_stats(poi_count=len(pois))
        progress.readiness("pois", "ready")
        progress.milestone(f"Matched {len(pois)} POIs to route")

    return PoiDataset(
        pois=pois,
        osm_load_s=round(load_elapsed, 2),
        matching_s=round(match_elapsed, 2),
        osm_downloaded=downloaded,
        discarded=tuple(discarded),
    )
