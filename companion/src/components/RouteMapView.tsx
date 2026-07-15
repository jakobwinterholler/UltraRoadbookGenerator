import { useEffect, useMemo, useRef } from "react";
import { analyzeClimbDifficulty } from "@shared/race/climbDifficulty";
import { buildRouteTrack, interpolateTrackAtKm } from "@shared/race/mapMatching";
import type { CompanionClimb } from "@shared/types/sync";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useCompanion } from "../context/CompanionContext";
import type { CompanionStop, CompanionUnsupportedSection } from "../types";

const MAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

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
          label: `${climb.lengthKm.toFixed(1)} km · ${climb.avgGradientPct.toFixed(1)}% · +${climb.elevationGainM} m`,
          difficulty: tier.label,
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
          label: `⛰ ${climb.lengthKm.toFixed(1)}km ${climb.avgGradientPct.toFixed(1)}% +${climb.elevationGainM}m`,
          difficulty: tier.label,
        },
        geometry: {
          type: "Point",
          coordinates: [point.lon, point.lat],
        },
      };
    }),
  };
}

interface RouteMapViewProps {
  embedded?: boolean;
  showClimbs?: boolean;
  onClimbSelect?: (climbId: string) => void;
}

export default function RouteMapView({
  embedded = false,
  showClimbs = false,
  onClimbSelect,
}: RouteMapViewProps) {
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
    mapGesturesLocked,
    setMapGesturesLocked,
  } = useCompanion();

  const selectedZoneId = selectedStop?.zoneId ?? null;
  const climbs = bundle.climbs ?? [];

  const visibleStops = useMemo(
    () =>
      bundle.stops.filter(
        (stop) => stop.verificationStatus === "verified" || showUnverified,
      ),
    [bundle.stops, showUnverified],
  );

  const followRider = !embedded && gps.lat != null && gps.lon != null;

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
      fitBoundsOptions: { padding: embedded ? 20 : 40 },
      dragRotate: !embedded,
      touchPitch: !embedded,
      touchZoomRotate: true,
      doubleClickZoom: !embedded,
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
          "line-width": embedded ? 8 : 10,
          "line-opacity": 0.45,
        },
      });

      map.addLayer({
        id: "route-core",
        type: "line",
        source: "route",
        paint: {
          "line-color": "#2563eb",
          "line-width": embedded ? 4 : 5,
          "line-opacity": 1,
        },
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

      map.addLayer({
        id: "climb-markers-label",
        type: "symbol",
        source: "climb-markers",
        layout: {
          visibility: showClimbs ? "visible" : "none",
          "text-field": ["get", "label"],
          "text-size": embedded ? 10 : 11,
          "text-offset": [0, 1.6],
          "text-anchor": "top",
          "text-allow-overlap": false,
        },
        paint: {
          "text-color": "#ffffff",
          "text-halo-color": "#000000",
          "text-halo-width": 1,
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
        data: stopsGeoJson(visibleStops, selectedZoneId),
      });

      map.addLayer({
        id: "stops-unverified",
        type: "circle",
        source: "stops",
        filter: ["==", ["get", "verified"], 0],
        paint: {
          "circle-radius": embedded ? 8 : 11,
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
          "circle-radius": embedded ? 9 : 12,
          "circle-color": "#10b981",
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
      });

      map.addLayer({
        id: "stops-selected-halo",
        type: "circle",
        source: "stops",
        filter: ["==", ["get", "selected"], 1],
        paint: {
          "circle-radius": embedded ? 16 : 22,
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
          "circle-radius": embedded ? 12 : 16,
          "circle-color": "transparent",
          "circle-stroke-width": 3,
          "circle-stroke-color": "#38bdf8",
        },
      });

      if (!embedded) {
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
      }
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
      if (climbFeatures.length > 0 && onClimbSelect) {
        const climbId = climbFeatures[0].properties?.climbId;
        if (typeof climbId === "string") {
          onClimbSelect(climbId);
          return;
        }
      }

      const stopFeatures = map.queryRenderedFeatures(event.point, {
        layers: ["stops-verified-bg", "stops-unverified", "stops-selected-ring"],
      });
      if (stopFeatures.length === 0) {
        return;
      }
      const zoneId = Number(stopFeatures[0].properties?.zoneId);
      const stop = bundle.stops.find((item) => item.zoneId === zoneId) ?? null;
      selectStop(stop);
    });

    if (!embedded) {
      const pauseFollow = () => {
        userMovedMapRef.current = true;
        setMapGesturesLocked(false);
      };
      map.on("dragstart", pauseFollow);
      map.on("zoomstart", pauseFollow);
      map.on("rotatestart", pauseFollow);
      map.on("pitchstart", pauseFollow);
    }

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [
    bundle.race.id,
    bundle.route.coordinates,
    bundle.route.bounds,
    bundle.stops,
    climbs,
    embedded,
    onClimbSelect,
    selectStop,
    setMapGesturesLocked,
    showClimbs,
    visibleStops,
    selectedZoneId,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getSource("stops")) {
      return;
    }
    (map.getSource("stops") as maplibregl.GeoJSONSource).setData(
      stopsGeoJson(visibleStops, selectedZoneId),
    );
  }, [visibleStops, selectedZoneId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getSource("climb-segments") || !map?.getSource("climb-markers")) {
      return;
    }
    const visibility = showClimbs && climbs.length > 0 ? "visible" : "none";
    (map.getSource("climb-segments") as maplibregl.GeoJSONSource).setData(
      climbSegmentsGeoJson(climbs, bundle.route.coordinates, bundle.race.distanceKm),
    );
    (map.getSource("climb-markers") as maplibregl.GeoJSONSource).setData(
      climbMarkersGeoJson(climbs, bundle.route.coordinates, bundle.race.distanceKm),
    );
    for (const layerId of ["climb-segments-line", "climb-markers-bg", "climb-markers-label"]) {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, "visibility", visibility);
      }
    }
  }, [bundle.race.distanceKm, bundle.route.coordinates, climbs, showClimbs]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getSource("rider") || gps.lat == null || gps.lon == null) {
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
      zoom: embedded ? 13 : Math.max(map.getZoom(), 14),
      duration: 350,
      essential: true,
    });
  }, [embedded, selectedStop?.zoneId]);

  return <div ref={hostRef} className="absolute inset-0" />;
}
