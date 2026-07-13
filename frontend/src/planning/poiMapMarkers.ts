import type { ResupplyZone, ZonePoiOption } from "../api";
import { formatPoiName } from "../components/poiUi";
import type { ZoneDensityMode } from "./types";

const POI_ICONS: Record<string, string> = {
  "Mini supermarket": "🛒",
  "Small supermarket": "🛒",
  Supermarket: "🏪",
  Bakery: "🥖",
  "Drinking water": "💧",
  "Gas station": "⛽",
  Café: "☕",
  Restaurant: "🍽",
  "Fast food": "🍔",
};

export interface MapPoiMarker {
  poi: ZonePoiOption;
  zone: ResupplyZone;
  icon: string;
  label: string;
}

export function poiIcon(category: string): string {
  return POI_ICONS[category] ?? "📍";
}

export function primaryMapPois(zones: ResupplyZone[], density: ZoneDensityMode): MapPoiMarker[] {
  const markers: MapPoiMarker[] = [];

  for (const zone of zones) {
    for (const group of zone.categories) {
      if (density === "minimal" && group.key === "dining") {
        continue;
      }
      if (density === "planning" && group.key === "dining") {
        continue;
      }

      const options =
        density === "detailed"
          ? [group.primary, ...group.alternatives].filter(
              (option): option is ZonePoiOption => option !== null,
            )
          : [group.primary].filter((option): option is ZonePoiOption => option !== null);

      for (const poi of options) {
        markers.push({
          poi,
          zone,
          icon: poiIcon(poi.poi_category),
          label: formatPoiName(poi.name, poi.brand, {
            poiCategory: poi.poi_category,
            categoryKey: group.key,
          }),
        });
      }
    }
  }

  return markers;
}
