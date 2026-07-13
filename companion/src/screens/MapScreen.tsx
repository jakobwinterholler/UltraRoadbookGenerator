import { useEffect, useMemo, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useCompanion } from "../context/CompanionContext";
import type { CompanionStop } from "../types";
import StopSheet from "../components/StopSheet";

const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

function stopsGeoJson(stops: CompanionStop[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: stops.map((stop) => ({
      type: "Feature",
      properties: {
        zoneId: stop.zoneId,
        verified: stop.verificationStatus === "verified" ? 1 : 0,
      },
      geometry: {
        type: "Point",
        coordinates: [stop.lon, stop.lat],
      },
    })),
  };
}

export default function MapScreen() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const {
    bundle,
    selectedStop,
    selectStop,
    showUnverified,
    setShowUnverified,
  } = useCompanion();

  const visibleStops = useMemo(
    () =>
      bundle.stops.filter(
        (stop) => stop.verificationStatus === "verified" || showUnverified,
      ),
    [bundle.stops, showUnverified],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const map = new maplibregl.Map({
      container: host,
      style: MAP_STYLE,
      bounds: [
        [bundle.route.bounds.west, bundle.route.bounds.south],
        [bundle.route.bounds.east, bundle.route.bounds.north],
      ],
      fitBoundsOptions: { padding: 40 },
    });
    mapRef.current = map;

    const setup = () => {
      if (map.getSource("route")) {
        return;
      }
      map.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: bundle.route.coordinates,
          },
        },
      });

      map.addLayer({
        id: "route-halo",
        type: "line",
        source: "route",
        paint: {
          "line-color": "#c4b5fd",
          "line-width": 7,
          "line-opacity": 0.55,
        },
      });

      map.addLayer({
        id: "route-core",
        type: "line",
        source: "route",
        paint: {
          "line-color": "#7c3aed",
          "line-width": 4,
          "line-opacity": 1,
        },
      });

      map.addSource("stops", {
        type: "geojson",
        data: stopsGeoJson(visibleStops),
      });

      map.addLayer({
        id: "stops-unverified",
        type: "circle",
        source: "stops",
        filter: ["==", ["get", "verified"], 0],
        paint: {
          "circle-radius": 8,
          "circle-color": "#64748b",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.addLayer({
        id: "stops-verified-bg",
        type: "circle",
        source: "stops",
        filter: ["==", ["get", "verified"], 1],
        paint: {
          "circle-radius": 9,
          "circle-color": "#10b981",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.addLayer({
        id: "stops-verified-check",
        type: "symbol",
        source: "stops",
        filter: ["==", ["get", "verified"], 1],
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
    };

    if (map.loaded()) {
      setup();
    } else {
      map.once("load", setup);
    }

    map.on("click", (event) => {
      const features = map.queryRenderedFeatures(event.point, {
        layers: ["stops-verified-bg", "stops-unverified"],
      });
      if (features.length === 0) {
        return;
      }
      const zoneId = Number(features[0].properties?.zoneId);
      const stop = bundle.stops.find((item) => item.zoneId === zoneId) ?? null;
      selectStop(stop);
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [bundle.race.id, bundle.route.coordinates, bundle.route.bounds, bundle.stops, selectStop]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource("stops")) {
      return;
    }
    (map.getSource("stops") as maplibregl.GeoJSONSource).setData(stopsGeoJson(visibleStops));
  }, [visibleStops]);

  return (
    <div className="relative h-full min-h-0">
      <div ref={hostRef} className="absolute inset-0" />
      <div className="pointer-events-none absolute left-3 top-3 z-10">
        <label className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/60 px-3 py-1.5 text-xs text-white backdrop-blur-sm">
          <input
            type="checkbox"
            checked={showUnverified}
            onChange={(event) => setShowUnverified(event.target.checked)}
            className="accent-emerald-500"
          />
          Unverified stops
        </label>
      </div>
      <StopSheet
        stop={selectedStop}
        totalKm={bundle.race.distanceKm}
        onClose={() => selectStop(null)}
      />
    </div>
  );
}
