"""Tests for resupply zone spatial clustering on loop routes."""

from poi_types import PointOfInterest
from resupply_zone_config import ResupplyZoneConfig
from resupply_zones import build_resupply_zones


def _poi(
    osm_id: int,
    *,
    lat: float,
    lon: float,
    distance_along_km: float,
    category: str = "Gas station",
    name: str | None = None,
) -> PointOfInterest:
    return PointOfInterest(
        osm_id=osm_id,
        osm_type="node",
        name=name,
        category=category,
        priority=1,
        lat=lat,
        lon=lon,
        distance_along_km=distance_along_km,
        distance_off_route_m=20.0,
        tags={"amenity": "fuel", "name": name or f"POI {osm_id}"},
        opening_hours=None,
        brand=name,
    )


def test_loop_route_does_not_chain_distant_stops_into_one_zone() -> None:
    """Physically close POIs far apart along a loop must not share one zone."""
    start = _poi(1, lat=41.4303, lon=2.1289, distance_along_km=7.0, name="Oilprix")
    loop_return = _poi(2, lat=41.4310, lon=2.1295, distance_along_km=34.0, name="Return town")
    config = ResupplyZoneConfig(merge_radius_m=500.0, max_along_route_spread_km=3.0)

    plan = build_resupply_zones([start, loop_return], config=config)

    zone_ids = {plan.poi_zone_ids[(start.osm_id, start.osm_type)], plan.poi_zone_ids[(loop_return.osm_id, loop_return.osm_type)]}
    assert len(zone_ids) == 2

    oilprix_zone = next(zone for zone in plan.zones if zone.zone_id == plan.poi_zone_ids[(start.osm_id, start.osm_type)])
    assert abs(oilprix_zone.distance_along_km - 7.0) < 1.0
