import { useEffect, useMemo, useRef } from "react";
import { buildRouteTrack, interpolateTrackAtKm } from "@shared/race/mapMatching";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useCompanion } from "../context/CompanionContext";
import type { CompanionStop } from "../types";
import FloatingCard from "../components/FloatingCard";
import StopSheet from "../components/StopSheet";

const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
/** Header block height below safe-area (px) */

function stopsGeoJson(
  stops: CompanionStop[],
  selectedZoneId: number | null,
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: stops.map((stop) => ({
      type: "Feature",
      properties: {
        zoneId: stop.zoneId,
        verified: stop.verificationStatus === "verified" ? 1 : 0,
        selected: stop.zoneId === selectedZoneId ? 1 : 0,
      },
      geometry: {
        type: "Point",
        coordinates: [stop.lon, stop.lat],
      },
    })),
  };
}

function unsupportedGeoJson(
  sections: import("../types").CompanionUnsupportedSection[],
  coordinates: [number, number][],
  totalKm: number,
): GeoJSON.FeatureCollection {
  const track = buildRouteTrack(coordinates, totalKm);
  return {
    type: "FeatureCollection",
    features: sections.map((section) => {
      const start = interpolateTrackAtKm(track, section.startKm);
      const end = interpolateTrackAtKm(track, section.endKm);
      const segmentCoords: [number, number][] = track.points
        .filter((point) => point.km >= section.startKm && point.km <= section.endKm)
        .map((point) => [point.lon, point.lat]);
      if (segmentCoords.length < 2) {
        segmentCoords.push([start.lon, start.lat], [end.lon, end.lat]);
      }
      return {
        type: "Feature",
        properties: { id: section.id, label: section.displayLabel },
        geometry: {
          type: "LineString",
          coordinates: segmentCoords,
        },
      };
    }),
  };
}

export default function MapScreen({ embedded = false }: { embedded?: boolean }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const userMovedMapRef = useRef(false);
  const {
    bundle,
    gps,
    currentKm,
    selectedStop,
    selectStop,
    showUnverified,
    setShowUnverified,
    mapGesturesLocked,
    setMapGesturesLocked,
  } = useCompanion();

  const selectedZoneId = selectedStop?.zoneId ?? null;

  const visibleStops = useMemo(
    () =>
      bundle.stops.filter(
        (stop) => stop.verificationStatus === "verified" || showUnverified,
      ),
    [bundle.stops, showUnverified],
  );

  const followRider = !embedded && gps.lat != null && gps.lon != null;
  const followPaused = followRider && !mapGesturesLocked;

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
      dragRotate: true,
      touchPitch: true,
      touchZoomRotate: true,
      doubleClickZoom: true,
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
          "line-color": "#93c5fd",
          "line-width": 10,
          "line-opacity": 0.45,
        },
      });

      map.addLayer({
        id: "route-core",
        type: "line",
        source: "route",
        paint: {
          "line-color": "#2563eb",
          "line-width": 5,
          "line-opacity": 1,
        },
      });

      map.addSource("unsupported", {
        type: "geojson",
        data: unsupportedGeoJson(
          bundle.unsupportedSections,
          bundle.route.coordinates,
          bundle.race.distanceKm,
        ),
      });

      map.addLayer({
        id: "unsupported-line",
        type: "line",
        source: "unsupported",
        paint: {
          "line-color": "#f59e0b",
          "line-width": 5,
          "line-opacity": 0.7,
        },
      });

      map.addSource("stops", {
        type: "geojson",
        data: stopsGeoJson(visibleStops, selectedZoneId),
      });

      map.addLayer({
        id: "stops-unverified",
        type: "circle",
        source: "stops",
        filter: ["==", ["get", "verified"], 0],
        paint: {
          "circle-radius": 11,
          "circle-color": "#64748b",
          "circle-stroke-width": 2.5,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.addLayer({
        id: "stops-verified-bg",
        type: "circle",
        source: "stops",
        filter: ["==", ["get", "verified"], 1],
        paint: {
          "circle-radius": 12,
          "circle-color": "#10b981",
          "circle-stroke-width": 2.5,
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
          "text-size": 13,
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: {
          "text-color": "#ffffff",
        },
      });

      map.addLayer({
        id: "stops-selected-halo",
        type: "circle",
        source: "stops",
        filter: ["==", ["get", "selected"], 1],
        paint: {
          "circle-radius": 22,
          "circle-color": "#38bdf8",
          "circle-opacity": 0.25,
          "circle-stroke-width": 0,
        },
      });

      map.addLayer({
        id: "stops-selected-ring",
        type: "circle",
        source: "stops",
        filter: ["==", ["get", "selected"], 1],
        paint: {
          "circle-radius": 16,
          "circle-color": "transparent",
          "circle-stroke-width": 3,
          "circle-stroke-color": "#38bdf8",
        },
      });

      map.addSource("rider", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "Point", coordinates: [0, 0] },
        },
      });

      map.addLayer({
        id: "rider-pulse",
        type: "circle",
        source: "rider",
        paint: {
          "circle-radius": 18,
          "circle-color": "#0ea5e9",
          "circle-opacity": 0.18,
        },
      });

      map.addLayer({
        id: "rider-halo",
        type: "circle",
        source: "rider",
        paint: {
          "circle-radius": 14,
          "circle-color": "#0ea5e9",
          "circle-opacity": 0.35,
        },
      });

      map.addLayer({
        id: "rider-core",
        type: "circle",
        source: "rider",
        paint: {
          "circle-radius": 8,
          "circle-color": "#0ea5e9",
          "circle-stroke-width": 3,
          "circle-stroke-color": "#ffffff",
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
        layers: ["stops-verified-bg", "stops-unverified", "stops-selected-ring"],
      });
      if (features.length === 0) {
        return;
      }
      const zoneId = Number(features[0].properties?.zoneId);
      const stop = bundle.stops.find((item) => item.zoneId === zoneId) ?? null;
      selectStop(stop);
    });

    const pauseFollow = () => {
      userMovedMapRef.current = true;
      setMapGesturesLocked(false);
    };
    map.on("dragstart", pauseFollow);
    map.on("zoomstart", pauseFollow);
    map.on("rotatestart", pauseFollow);
    map.on("pitchstart", pauseFollow);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [bundle.race.id, bundle.route.coordinates, bundle.route.bounds, bundle.stops, selectStop, setMapGesturesLocked]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource("stops")) {
      return;
    }
    (map.getSource("stops") as maplibregl.GeoJSONSource).setData(
      stopsGeoJson(visibleStops, selectedZoneId),
    );
  }, [visibleStops, selectedZoneId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource("rider") || gps.lat == null || gps.lon == null) {
      return;
    }
    (map.getSource("rider") as maplibregl.GeoJSONSource).setData({
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: [gps.lon, gps.lat] },
    });
  }, [gps.lat, gps.lon]);

  useEffect(() => {
    const map = mapRef.current;
    if (
      !map ||
      !followRider ||
      !mapGesturesLocked ||
      userMovedMapRef.current ||
      gps.lat == null ||
      gps.lon == null
    ) {
      return;
    }
    map.easeTo({
      center: [gps.lon, gps.lat],
      bearing: gps.bearing,
      zoom: Math.max(map.getZoom(), 14),
      duration: 500,
      essential: true,
    });
  }, [followRider, mapGesturesLocked, gps.lat, gps.lon, gps.bearing, currentKm]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedStop) {
      return;
    }
    map.easeTo({
      center: [selectedStop.lon, selectedStop.lat],
      duration: 350,
      essential: true,
    });
  }, [selectedStop?.zoneId]);

  function resumeFollow() {
    userMovedMapRef.current = false;
    setMapGesturesLocked(true);
    recenterOnRider();
  }

  function recenterOnRider() {
    const map = mapRef.current;
    if (!map || gps.lat == null || gps.lon == null) {
      return;
    }
    map.easeTo({
      center: [gps.lon, gps.lat],
      bearing: gps.bearing,
      zoom: Math.max(map.getZoom(), 14),
      duration: 400,
      essential: true,
    });
  }

  function zoomIn() {
    mapRef.current?.zoomIn({ duration: 200 });
  }

  function zoomOut() {
    mapRef.current?.zoomOut({ duration: 200 });
  }

  const controlsTop = embedded ? "top-3" : "top-4";

  return (
    <div className={`relative min-h-0 ${embedded ? "h-full" : "h-full"}`}>
      <div ref={hostRef} className="absolute inset-0" />

      {!embedded ? (
        <>
          <div className={`pointer-events-none absolute left-4 z-10 ${controlsTop}`}>
            <FloatingCard className="pointer-events-auto p-1">
              <label className="flex min-h-[44px] cursor-pointer items-center gap-2.5 px-3 py-2 text-sm text-white/85">
                <input
                  type="checkbox"
                  checked={showUnverified}
                  onChange={(event) => setShowUnverified(event.target.checked)}
                  className="h-4 w-4 rounded accent-orange-500"
                />
                Unverified
              </label>
            </FloatingCard>
          </div>

          <div className={`pointer-events-none absolute right-4 z-10 flex flex-col gap-2 ${controlsTop}`}>
            <FloatingCard className="pointer-events-auto overflow-hidden">
              <button
                type="button"
                onClick={() => {
                  if (mapGesturesLocked) {
                    setMapGesturesLocked(false);
                  } else {
                    resumeFollow();
                  }
                }}
                className="flex min-h-[44px] w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm font-medium text-white/90 hover:bg-white/5"
                aria-pressed={mapGesturesLocked}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    mapGesturesLocked ? "bg-sky-500/25 text-sky-300" : "bg-white/10 text-white/50"
                  }`}
                  aria-hidden
                >
                  ◎
                </span>
                {mapGesturesLocked ? "Following" : "Follow off"}
              </button>
              <button
                type="button"
                onClick={recenterOnRider}
                className="flex min-h-[44px] w-full items-center gap-2.5 border-t border-white/10 px-3.5 py-2.5 text-left text-sm font-medium text-white/90 hover:bg-white/5"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-xs" aria-hidden>
                  ⊕
                </span>
                Recenter
              </button>
            </FloatingCard>
          </div>

          {followPaused ? (
            <button
              type="button"
              onClick={resumeFollow}
              className="absolute bottom-28 left-1/2 z-20 -translate-x-1/2 rounded-full bg-sky-500/90 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-500/30 backdrop-blur transition active:scale-[0.97]"
              style={{ marginBottom: "max(0px, env(safe-area-inset-bottom))" }}
            >
              Resume follow
            </button>
          ) : null}

          <div
            className="pointer-events-none absolute bottom-4 right-4 z-10"
            style={{ marginBottom: "max(0px, env(safe-area-inset-bottom))" }}
          >
            <FloatingCard className="pointer-events-auto overflow-hidden">
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={zoomIn}
                  aria-label="Zoom in"
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center text-lg text-white/90 hover:bg-white/5"
                >
                  +
                </button>
                <button
                  type="button"
                  onClick={zoomOut}
                  aria-label="Zoom out"
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center border-t border-white/10 text-lg text-white/90 hover:bg-white/5"
                >
                  −
                </button>
              </div>
            </FloatingCard>
          </div>
        </>
      ) : null}

      {!embedded ? (
        <StopSheet
          stop={selectedStop}
          totalKm={bundle.race.distanceKm}
          routeCoordinates={bundle.route.coordinates}
          onClose={() => selectStop(null)}
        />
      ) : null}
    </div>
  );
}
