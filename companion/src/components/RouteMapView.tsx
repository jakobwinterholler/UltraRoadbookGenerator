import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { analyzeClimbDifficulty } from "@shared/race/climbDifficulty";
import { buildRouteTrack, interpolateTrackAtKm } from "@shared/race/mapMatching";
import { collectAllBundlePois, resolveRenderedStop } from "@shared/race/bundlePois";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useCompanion } from "../context/CompanionContext";
import { buildRouteArrowPoints } from "../lib/routeDirectionArrows";
import type { CompanionClimb } from "@shared/types/sync";
import type { CompanionStop, CompanionUnsupportedSection } from "../types";

const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const FOLLOW_ZOOM = 14;
const EMBEDDED_FOCUS_ZOOM = 17;
const EMBEDDED_FOCUS_OFFSET: [number, number] = [0, -90];
const FOCUS_ANIMATION_MS = 800;

function stopPoiId(stop: Pick<CompanionStop, "poiId" | "zoneId">): string {
  return stop.poiId ?? `zone-${stop.zoneId}`;
}

function isStopVerified(status: CompanionStop["verificationStatus"]): boolean {
  return status === "verified" || status === "pending";
}

export interface RouteMapHandle {
  recenter: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetNorth: () => void;
}

interface RouteMapViewProps {
  embedded?: boolean;
  showClimbs?: boolean;
  onClimbSelect?: (climbId: string) => void;
  focusStop?: Pick<CompanionStop, "lat" | "lon" | "zoneId"> | null;
}

function stopsGeoJson(
  stops: CompanionStop[],
  selectedPoiId: string | null,
  focusPoiId: string | null,
): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: stops.map((stop) => {
      const poiId = stopPoiId(stop);
      const isFocus = focusPoiId != null && poiId === focusPoiId;
      const isSelected = selectedPoiId != null && stop.poiId === selectedPoiId;
      const dimmed = focusPoiId != null && !isFocus && !isSelected;
      return {
        type: "Feature",
        properties: {
          zoneId: stop.zoneId,
          poiId,
          verified: isStopVerified(stop.verificationStatus) ? 1 : 0,
          selected: isFocus || isSelected ? 1 : 0,
          dimmed: dimmed ? 1 : 0,
        },
        geometry: {
          type: "Point",
          coordinates: [stop.lon, stop.lat],
        },
      };
    }),
  };
}

function unsupportedGeoJson(
  sections: CompanionUnsupportedSection[],
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

function climbSegmentsGeoJson(
  climbs: CompanionClimb[],
  coordinates: [number, number][],
  totalKm: number,
): GeoJSON.FeatureCollection {
  const track = buildRouteTrack(coordinates, totalKm);
  return {
    type: "FeatureCollection",
    features: climbs.map((climb) => {
      const segmentCoords: [number, number][] = track.points
        .filter((point) => point.km >= climb.startKm && point.km <= climb.endKm)
        .map((point) => [point.lon, point.lat]);
      if (segmentCoords.length < 2) {
        const start = interpolateTrackAtKm(track, climb.startKm);
        const end = interpolateTrackAtKm(track, climb.endKm);
        segmentCoords.push([start.lon, start.lat], [end.lon, end.lat]);
      }
      const tier = analyzeClimbDifficulty(climb);
      return {
        type: "Feature",
        properties: {
          climbId: climb.id,
          color: tier.color,
        },
        geometry: {
          type: "LineString",
          coordinates: segmentCoords,
        },
      };
    }),
  };
}

function climbMarkersGeoJson(
  climbs: CompanionClimb[],
  coordinates: [number, number][],
  totalKm: number,
): GeoJSON.FeatureCollection {
  const track = buildRouteTrack(coordinates, totalKm);
  return {
    type: "FeatureCollection",
    features: climbs.map((climb) => {
      const midpointKm = (climb.startKm + climb.endKm) / 2;
      const point = interpolateTrackAtKm(track, midpointKm);
      const tier = analyzeClimbDifficulty(climb);
      return {
        type: "Feature",
        properties: {
          climbId: climb.id,
          color: tier.color,
          label: `⛰ ${climb.lengthKm.toFixed(1)}km`,
        },
        geometry: {
          type: "Point",
          coordinates: [point.lon, point.lat],
        },
      };
    }),
  };
}

const RouteMapView = forwardRef<RouteMapHandle, RouteMapViewProps>(function RouteMapView(
  { embedded = false, showClimbs = false, onClimbSelect, focusStop = null },
  ref,
) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const userExploringRef = useRef(false);
  const initialFitDoneRef = useRef(false);
  const stopsRef = useRef<CompanionStop[]>([]);
  const onClimbSelectRef = useRef(onClimbSelect);
  const selectStopRef = useRef<(stop: CompanionStop | null) => void>(() => undefined);

  const {
    bundle,
    gps,
    selectedStop,
    selectStop,
    followGps,
    setFollowGps,
  } = useCompanion();

  const climbs = bundle.climbs ?? [];
  const visibleStops = useMemo(() => collectAllBundlePois(bundle).map((entry) => entry.stop), [bundle]);
  const selectedRenderedStop = useMemo(() => {
    if (!selectedStop) {
      return null;
    }
    return resolveRenderedStop(bundle, selectedStop);
  }, [bundle, selectedStop]);
  const selectedMarkerPoiId = selectedRenderedStop?.poiId ?? selectedStop?.poiId ?? null;
  const focusPoiId = focusStop ? stopPoiId(focusStop) : null;
  const embeddedFocus = embedded && focusStop != null;

  stopsRef.current = visibleStops;
  onClimbSelectRef.current = onClimbSelect;
  selectStopRef.current = selectStop;

  const recenter = useCallback(() => {
    const map = mapRef.current;
    if (!map || gps.lat == null || gps.lon == null) {
      return;
    }
    userExploringRef.current = false;
    setFollowGps(true);
    map.easeTo({
      center: [gps.lon, gps.lat],
      bearing: gps.bearing,
      zoom: Math.max(map.getZoom(), FOLLOW_ZOOM),
      duration: 450,
      essential: true,
    });
  }, [gps.bearing, gps.lat, gps.lon, setFollowGps]);

  useImperativeHandle(
    ref,
    () => ({
      recenter,
      zoomIn: () => {
        userExploringRef.current = true;
        setFollowGps(false);
        mapRef.current?.zoomIn({ duration: 200 });
      },
      zoomOut: () => {
        userExploringRef.current = true;
        setFollowGps(false);
        mapRef.current?.zoomOut({ duration: 200 });
      },
      resetNorth: () => {
        userExploringRef.current = true;
        setFollowGps(false);
        mapRef.current?.easeTo({ bearing: 0, duration: 300 });
      },
    }),
    [recenter, setFollowGps],
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    readyRef.current = false;
    userExploringRef.current = false;
    initialFitDoneRef.current = false;

    const map = new maplibregl.Map({
      container: host,
      style: MAP_STYLE,
      center: [
        (bundle.route.bounds.west + bundle.route.bounds.east) / 2,
        (bundle.route.bounds.south + bundle.route.bounds.north) / 2,
      ],
      zoom: embedded ? 11 : 10,
      dragRotate: !embedded,
      touchPitch: !embedded,
      touchZoomRotate: true,
      doubleClickZoom: !embedded,
      fadeDuration: 0,
      refreshExpiredTiles: false,
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
          "line-color": embeddedFocus ? "#60a5fa" : "#93c5fd",
          "line-width": embeddedFocus ? 10 : embedded ? 8 : 10,
          "line-opacity": embeddedFocus ? 0.55 : 0.45,
        },
      });

      map.addLayer({
        id: "route-core",
        type: "line",
        source: "route",
        paint: {
          "line-color": embeddedFocus ? "#38bdf8" : "#2563eb",
          "line-width": embeddedFocus ? 5 : embedded ? 4 : 5,
          "line-opacity": 1,
        },
      });

      map.addLayer({
        id: "route-direction",
        type: "symbol",
        source: "route",
        minzoom: 9,
        layout: {
          "symbol-placement": "line",
          "symbol-spacing": [
            "interpolate",
            ["linear"],
            ["zoom"],
            10,
            120,
            14,
            70,
            17,
            40,
          ],
          "text-field": "▸",
          "text-size": ["interpolate", ["linear"], ["zoom"], 10, 10, 14, 13, 17, 15],
          "text-keep-upright": false,
          "text-rotation-alignment": "map",
          "text-allow-overlap": true,
          "text-ignore-placement": true,
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "#1d4ed8",
          "text-halo-width": 1.2,
          "text-opacity": 0.9,
        },
      });

      map.addSource("route-arrows", {
        type: "geojson",
        data: buildRouteArrowPoints(bundle.route.coordinates, bundle.race.distanceKm),
      });

      map.addSource("climb-segments", {
        type: "geojson",
        data: climbSegmentsGeoJson(climbs, bundle.route.coordinates, bundle.race.distanceKm),
      });

      map.addLayer({
        id: "climb-segments-line",
        type: "line",
        source: "climb-segments",
        layout: { visibility: showClimbs ? "visible" : "none" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": embedded ? 5 : 7,
          "line-opacity": 0.95,
        },
      });

      map.addSource("climb-markers", {
        type: "geojson",
        data: climbMarkersGeoJson(climbs, bundle.route.coordinates, bundle.race.distanceKm),
      });

      map.addLayer({
        id: "climb-markers-bg",
        type: "circle",
        source: "climb-markers",
        layout: { visibility: showClimbs ? "visible" : "none" },
        paint: {
          "circle-radius": embedded ? 10 : 14,
          "circle-color": ["get", "color"],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
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
          "line-width": embedded ? 4 : 5,
          "line-opacity": 0.7,
        },
      });

      map.addSource("stops", {
        type: "geojson",
        data: stopsGeoJson(visibleStops, selectedMarkerPoiId, focusPoiId),
      });

      map.addLayer({
        id: "stops-unverified",
        type: "circle",
        source: "stops",
        filter: ["all", ["==", ["get", "verified"], 0], ["==", ["get", "selected"], 0]],
        paint: {
          "circle-radius": embeddedFocus ? 5 : embedded ? 8 : 11,
          "circle-color": "#64748b",
          "circle-opacity": embeddedFocus ? 0.35 : 1,
          "circle-stroke-width": embeddedFocus ? 1 : 2,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-opacity": embeddedFocus ? 0.5 : 1,
        },
      });

      map.addLayer({
        id: "stops-verified-bg",
        type: "circle",
        source: "stops",
        filter: ["all", ["==", ["get", "verified"], 1], ["==", ["get", "selected"], 0]],
        paint: {
          "circle-radius": embeddedFocus ? 5 : embedded ? 9 : 12,
          "circle-color": "#10b981",
          "circle-opacity": embeddedFocus ? 0.35 : 1,
          "circle-stroke-width": embeddedFocus ? 1 : 2,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-opacity": embeddedFocus ? 0.5 : 1,
        },
      });

      map.addLayer({
        id: "stops-selected-halo",
        type: "circle",
        source: "stops",
        filter: ["==", ["get", "selected"], 1],
        paint: {
          "circle-radius": embeddedFocus ? 22 : embedded ? 16 : 22,
          "circle-color": "#38bdf8",
          "circle-opacity": embeddedFocus ? 0.35 : 0.25,
          "circle-stroke-width": 0,
        },
      });

      map.addLayer({
        id: "stops-selected-ring",
        type: "circle",
        source: "stops",
        filter: ["==", ["get", "selected"], 1],
        paint: {
          "circle-radius": embeddedFocus ? 14 : embedded ? 12 : 16,
          "circle-color": embeddedFocus ? "#38bdf8" : "transparent",
          "circle-stroke-width": embeddedFocus ? 0 : 3,
          "circle-stroke-color": "#38bdf8",
        },
      });

      map.addLayer({
        id: "stops-selected-core",
        type: "circle",
        source: "stops",
        filter: ["==", ["get", "selected"], 1],
        paint: {
          "circle-radius": embeddedFocus ? 10 : 0,
          "circle-color": "#ffffff",
          "circle-stroke-width": embeddedFocus ? 3 : 0,
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

      if (!embedded) {
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
      } else {
        map.addLayer({
          id: "rider-core",
          type: "circle",
          source: "rider",
          layout: { visibility: "none" },
          paint: {
            "circle-radius": 7,
            "circle-color": "#0ea5e9",
            "circle-stroke-width": 2,
            "circle-stroke-color": "#ffffff",
          },
        });
      }

      if (!embedded && !initialFitDoneRef.current) {
        map.fitBounds(
          [
            [bundle.route.bounds.west, bundle.route.bounds.south],
            [bundle.route.bounds.east, bundle.route.bounds.north],
          ],
          { padding: 40, duration: 0 },
        );
        initialFitDoneRef.current = true;
      }

      readyRef.current = true;
    };

    if (map.loaded()) {
      setup();
    } else {
      map.once("load", setup);
    }

    map.on("click", (event) => {
      const climbFeatures = map.queryRenderedFeatures(event.point, {
        layers: ["climb-markers-bg", "climb-segments-line"],
      });
      if (climbFeatures.length > 0 && onClimbSelectRef.current) {
        const climbId = climbFeatures[0].properties?.climbId;
        if (typeof climbId === "string") {
          onClimbSelectRef.current(climbId);
          return;
        }
      }

      const stopFeatures = map.queryRenderedFeatures(event.point, {
        layers: ["stops-verified-bg", "stops-unverified", "stops-selected-ring"],
      });
      if (stopFeatures.length === 0) {
        return;
      }
      const poiId = stopFeatures[0].properties?.poiId;
      if (typeof poiId !== "string") {
        return;
      }
      const stop = stopsRef.current.find((item) => item.poiId === poiId) ?? null;
      selectStopRef.current(stop);
    });

    const pauseFollow = () => {
      userExploringRef.current = true;
      setFollowGps(false);
    };
    map.on("dragstart", pauseFollow);
    map.on("zoomstart", pauseFollow);
    map.on("rotatestart", pauseFollow);
    map.on("pitchstart", pauseFollow);

    return () => {
      readyRef.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, [bundle.race.id, embedded, setFollowGps]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getSource("stops") || !readyRef.current) {
      return;
    }
    (map.getSource("stops") as maplibregl.GeoJSONSource).setData(
      stopsGeoJson(visibleStops, selectedMarkerPoiId, focusPoiId),
    );
  }, [focusPoiId, selectedMarkerPoiId, visibleStops]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getSource("climb-segments") || !readyRef.current) {
      return;
    }
    const visibility = showClimbs && climbs.length > 0 ? "visible" : "none";
    (map.getSource("climb-segments") as maplibregl.GeoJSONSource).setData(
      climbSegmentsGeoJson(climbs, bundle.route.coordinates, bundle.race.distanceKm),
    );
    (map.getSource("climb-markers") as maplibregl.GeoJSONSource).setData(
      climbMarkersGeoJson(climbs, bundle.route.coordinates, bundle.race.distanceKm),
    );
    for (const layerId of ["climb-segments-line", "climb-markers-bg"]) {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, "visibility", visibility);
      }
    }
  }, [bundle.race.distanceKm, bundle.route.coordinates, climbs, showClimbs]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getSource("rider") || !readyRef.current || gps.lat == null || gps.lon == null) {
      return;
    }
    (map.getSource("rider") as maplibregl.GeoJSONSource).setData({
      type: "Feature",
      properties: {},
      geometry: { type: "Point", coordinates: [gps.lon, gps.lat] },
    });
    if (embedded && map.getLayer("rider-core")) {
      map.setLayoutProperty("rider-core", "visibility", "visible");
    }
  }, [embedded, gps.lat, gps.lon]);

  useEffect(() => {
    const map = mapRef.current;
    if (
      !map ||
      embedded ||
      !readyRef.current ||
      !followGps ||
      userExploringRef.current ||
      gps.lat == null ||
      gps.lon == null
    ) {
      return;
    }
    map.easeTo({
      center: [gps.lon, gps.lat],
      bearing: gps.bearing,
      duration: 450,
      essential: true,
    });
  }, [embedded, followGps, gps.bearing, gps.lat, gps.lon]);

  useEffect(() => {
    const map = mapRef.current;
    const target = focusStop ?? selectedStop;
    if (!map || !readyRef.current || !target) {
      return;
    }
    if (!embedded && followGps) {
      return;
    }
    map.flyTo({
      center: [target.lon, target.lat],
      zoom: embedded ? EMBEDDED_FOCUS_ZOOM : map.getZoom(),
      offset: embedded ? EMBEDDED_FOCUS_OFFSET : undefined,
      duration: FOCUS_ANIMATION_MS,
      essential: true,
    });
  }, [embedded, focusStop, followGps, selectedStop]);

  useEffect(() => {
    if (followGps) {
      userExploringRef.current = false;
    }
  }, [followGps]);

  return <div ref={hostRef} className="absolute inset-0 bg-[#0c1018]" />;
});

export default RouteMapView;
