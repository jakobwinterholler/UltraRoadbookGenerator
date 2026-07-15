import { useEffect, useMemo, useRef, useState } from "react";
import { buildRouteTrack } from "@shared/race/mapMatching";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { CompanionBundle, CompanionStop } from "../types";

const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const DETAIL_ZOOM = 17.1;
const DETAIL_OFFSET: [number, number] = [0, -36];
const ROUTE_WINDOW_KM = 0.22;
const FOCUS_ANIMATION_MS = 750;

interface StopDetailMapProps {
  stop: CompanionStop;
  bundle: CompanionBundle;
  riderLat?: number | null;
  riderLon?: number | null;
}

function routeSegmentGeoJson(
  coordinates: [number, number][],
  totalKm: number,
  stopKm: number,
): GeoJSON.FeatureCollection {
  const track = buildRouteTrack(coordinates, totalKm);
  const segment = track.points
    .filter((point) => Math.abs(point.km - stopKm) <= ROUTE_WINDOW_KM)
    .map((point) => [point.lon, point.lat] as [number, number]);

  if (segment.length < 2) {
    const anchor = track.points.find((point) => Math.abs(point.km - stopKm) <= 0.5);
    if (anchor) {
      segment.push([anchor.lon, anchor.lat], [anchor.lon + 0.0008, anchor.lat + 0.0008]);
    }
  }

  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: segment,
        },
      },
    ],
  };
}

export default function StopDetailMap({
  stop,
  bundle,
  riderLat,
  riderLon,
}: StopDetailMapProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const routeData = useMemo(
    () => routeSegmentGeoJson(bundle.route.coordinates, bundle.race.distanceKm, stop.km),
    [bundle.race.distanceKm, bundle.route.coordinates, stop.km],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !Number.isFinite(stop.lat) || !Number.isFinite(stop.lon)) {
      return;
    }

    let cancelled = false;
    setLoadError(null);
    readyRef.current = false;

    const map = new maplibregl.Map({
      container: host,
      style: MAP_STYLE,
      center: [stop.lon, stop.lat],
      zoom: DETAIL_ZOOM - 0.8,
      bearing: 0,
      pitch: 0,
      interactive: false,
      dragPan: false,
      scrollZoom: false,
      boxZoom: false,
      dragRotate: false,
      keyboard: false,
      doubleClickZoom: false,
      touchZoomRotate: false,
      touchPitch: false,
      fadeDuration: 0,
      refreshExpiredTiles: false,
      attributionControl: false,
    });
    mapRef.current = map;

    const fail = (message: string) => {
      if (cancelled) {
        return;
      }
      setLoadError(message);
    };

    map.on("error", (event) => {
      fail(event.error?.message ?? "Street map failed to load.");
    });

    const setup = () => {
      if (cancelled || map.getSource("detail-route")) {
        return;
      }

      try {
        map.addSource("detail-route", {
          type: "geojson",
          data: routeData,
        });

        map.addLayer({
          id: "detail-route-halo",
          type: "line",
          source: "detail-route",
          paint: {
            "line-color": "#60a5fa",
            "line-width": 12,
            "line-opacity": 0.5,
          },
        });

        map.addLayer({
          id: "detail-route-core",
          type: "line",
          source: "detail-route",
          paint: {
            "line-color": "#38bdf8",
            "line-width": 5,
            "line-opacity": 1,
          },
        });

        map.addSource("detail-poi", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                properties: {},
                geometry: {
                  type: "Point",
                  coordinates: [stop.lon, stop.lat],
                },
              },
            ],
          },
        });

        map.addLayer({
          id: "detail-poi-halo",
          type: "circle",
          source: "detail-poi",
          paint: {
            "circle-radius": 18,
            "circle-color": "#38bdf8",
            "circle-opacity": 0.28,
          },
        });

        map.addLayer({
          id: "detail-poi-pin",
          type: "circle",
          source: "detail-poi",
          paint: {
            "circle-radius": 9,
            "circle-color": "#ffffff",
            "circle-stroke-width": 3,
            "circle-stroke-color": "#38bdf8",
          },
        });

        map.addSource("detail-rider", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [],
          },
        });

        map.addLayer({
          id: "detail-rider",
          type: "circle",
          source: "detail-rider",
          layout: { visibility: "none" },
          paint: {
            "circle-radius": 7,
            "circle-color": "#0ea5e9",
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        });

        map.flyTo({
          center: [stop.lon, stop.lat],
          zoom: DETAIL_ZOOM,
          offset: DETAIL_OFFSET,
          duration: FOCUS_ANIMATION_MS,
          essential: true,
        });

        readyRef.current = true;
      } catch (error) {
        fail(error instanceof Error ? error.message : "Street map failed to set up.");
      }
    };

    if (map.loaded()) {
      setup();
    } else {
      map.once("load", setup);
    }

    return () => {
      cancelled = true;
      readyRef.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, [routeData, stop.lat, stop.lon, stop.poiId, stop.zoneId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getSource("detail-rider") || !readyRef.current) {
      return;
    }
    const source = map.getSource("detail-rider") as maplibregl.GeoJSONSource;
    if (riderLat == null || riderLon == null) {
      source.setData({ type: "FeatureCollection", features: [] });
      if (map.getLayer("detail-rider")) {
        map.setLayoutProperty("detail-rider", "visibility", "none");
      }
      return;
    }
    source.setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Point",
            coordinates: [riderLon, riderLat],
          },
        },
      ],
    });
    if (map.getLayer("detail-rider")) {
      map.setLayoutProperty("detail-rider", "visibility", "visible");
    }
  }, [riderLat, riderLon]);

  return (
    <div className="stop-detail-map relative h-full w-full touch-none select-none">
      <div ref={hostRef} className="pointer-events-none absolute inset-0" aria-hidden />
      {loadError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0c1018] px-4 text-center">
          <p className="text-sm font-medium text-white/70">Street preview unavailable</p>
          <p className="mt-1 text-xs text-white/40">{loadError}</p>
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#0c1018]/80 to-transparent px-2 pb-1.5 pt-6 text-[10px] text-white/35">
          Fixed street preview · OpenFreeMap
        </div>
      )}
    </div>
  );
}
