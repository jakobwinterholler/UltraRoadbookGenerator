import type maplibregl from "maplibre-gl";
import type { RoutePreviewVerifiedStop } from "../../routePreview/routePreviewHud";

function verifiedStopsGeoJson(
  stops: RoutePreviewVerifiedStop[],
): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: stops.map((stop) => ({
      type: "Feature",
      properties: {
        zoneId: stop.zoneId,
        label: stop.label,
      },
      geometry: {
        type: "Point",
        coordinates: [stop.lon, stop.lat],
      },
    })),
  };
}

export function syncVerifiedStopLayers(
  map: maplibregl.Map,
  stops: RoutePreviewVerifiedStop[],
): void {
  const data = verifiedStopsGeoJson(stops);

  if (!map.getSource("verified-stops")) {
    map.addSource("verified-stops", {
      type: "geojson",
      data,
    });

    map.addLayer({
      id: "verified-stops-bg",
      type: "circle",
      source: "verified-stops",
      paint: {
        "circle-radius": 9,
        "circle-color": "#10b981",
        "circle-stroke-width": 2,
        "circle-stroke-color": "#ffffff",
        "circle-opacity": 0.95,
      },
    });

    map.addLayer({
      id: "verified-stops-check",
      type: "symbol",
      source: "verified-stops",
      layout: {
        "text-field": "✓",
        "text-size": 11,
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      },
      paint: {
        "text-color": "#ffffff",
      },
    });
    return;
  }

  (map.getSource("verified-stops") as maplibregl.GeoJSONSource).setData(data);
}

export function removeVerifiedStopLayers(map: maplibregl.Map): void {
  if (map.getLayer("verified-stops-check")) {
    map.removeLayer("verified-stops-check");
  }
  if (map.getLayer("verified-stops-bg")) {
    map.removeLayer("verified-stops-bg");
  }
  if (map.getSource("verified-stops")) {
    map.removeSource("verified-stops");
  }
}
