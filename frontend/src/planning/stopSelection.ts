import type { PoiRow, ResupplyZone, ZonePoiOption } from "../api";

export type StopSelection =
  | { kind: "zone"; zone: ResupplyZone }
  | { kind: "poi"; poi: ZonePoiOption | PoiRow; zone: ResupplyZone | null }
  | null;

export function poiKey(poi: { osm_id: number; osm_type: string }): string {
  return `${poi.osm_type}-${poi.osm_id}`;
}

export function findZoneForPoi(
  zones: ResupplyZone[],
  poi: { osm_id: number; osm_type: string },
): ResupplyZone | null {
  for (const zone of zones) {
    for (const group of zone.categories) {
      const options = [group.primary, ...group.alternatives].filter(
        (option): option is ZonePoiOption => option !== null,
      );
      if (options.some((option) => option.osm_id === poi.osm_id && option.osm_type === poi.osm_type)) {
        return zone;
      }
    }
  }
  return null;
}
