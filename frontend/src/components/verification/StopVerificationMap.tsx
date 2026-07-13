import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import type { RouteVisualization } from "../../api";
import { findNearestTrackIndexByLatLng, trackPositionsInKmRange } from "../routeUtils";
import { VERIFY_MAP_STATIC_PROPS } from "../maps/planningMapInteraction";
import {
  detourComplexityLabel,
  mapContextWindowKm,
} from "../../planning/stopVerification/stopMapContext";

const ROUTE_CORE = "#6D28D9";
const ROUTE_HALO = "#C4B5FD";
const ROUTE_GLOW = "#FFFFFF";
const ROUTE_FADED = "#A78BFA";
const DETOUR_COLOR = "#2563EB";
const BASEMAP_URL = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

interface StopVerificationMapProps {
  route: RouteVisualization;
  stopKm: number;
  stopLat: number;
  stopLon: number;
  detourM: number;
}

function endpointIcon(label: string): L.DivIcon {
  return L.divIcon({
    html: `<div class="verification-route-endpoint">${label}</div>`,
    className: "",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

function markerDivIcon(): L.DivIcon {
  return L.divIcon({
    html: `<div class="route-context-marker route-context-marker--active" aria-hidden="true">🟢</div>`,
    className: "",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function FitStopBounds({
  route,
  stopKm,
  stopLat,
  stopLon,
  windowKm,
}: StopVerificationMapProps & { windowKm: number }) {
  const map = useMap();

  useEffect(() => {
    const routeSegment = trackPositionsInKmRange(
      route.track_points,
      Math.max(0, stopKm - windowKm),
      stopKm + windowKm,
    );

    const trackIndex = findNearestTrackIndexByLatLng(route.track_points, stopLat, stopLon);
    const trackPoint = route.track_points[trackIndex];
    const boundsPoints: [number, number][] = [
      [stopLat, stopLon],
      ...routeSegment,
    ];
    if (trackPoint) {
      boundsPoints.push([trackPoint.lat, trackPoint.lon]);
    }

    if (boundsPoints.length >= 2) {
      map.fitBounds(boundsPoints, {
        padding: [20, 20],
        maxZoom: 17,
        animate: false,
      });
      return;
    }

    map.setView([stopLat, stopLon], 16, { animate: false });
  }, [map, route.track_points, stopKm, stopLat, stopLon, windowKm]);

  return null;
}

function RouteGlowLayers({ positions }: { positions: [number, number][] }) {
  if (positions.length < 2) {
    return null;
  }

  return (
    <>
      <Polyline
        positions={positions}
        interactive={false}
        pathOptions={{
          color: ROUTE_GLOW,
          weight: 20,
          opacity: 0.92,
          lineCap: "round",
          lineJoin: "round",
        }}
      />
      <Polyline
        positions={positions}
        interactive={false}
        pathOptions={{
          color: ROUTE_HALO,
          weight: 14,
          opacity: 0.95,
          lineCap: "round",
          lineJoin: "round",
        }}
      />
      <Polyline
        positions={positions}
        interactive={false}
        pathOptions={{
          color: ROUTE_CORE,
          weight: 9,
          opacity: 1,
          lineCap: "round",
          lineJoin: "round",
        }}
      />
    </>
  );
}

export default function StopVerificationMap({
  route,
  stopKm,
  stopLat,
  stopLon,
  detourM,
}: StopVerificationMapProps) {
  const windowKm = mapContextWindowKm(stopKm, detourM);
  const extendedKm = windowKm * 1.6;

  const routeSegment = useMemo(
    () =>
      trackPositionsInKmRange(
        route.track_points,
        Math.max(0, stopKm - windowKm),
        stopKm + windowKm,
      ),
    [route.track_points, stopKm, windowKm],
  );

  const extendedSegment = useMemo(
    () =>
      trackPositionsInKmRange(
        route.track_points,
        Math.max(0, stopKm - extendedKm),
        stopKm + extendedKm,
      ),
    [route.track_points, stopKm, extendedKm],
  );

  const trackIndex = findNearestTrackIndexByLatLng(route.track_points, stopLat, stopLon);
  const trackPoint = route.track_points[trackIndex];
  const detourLine: [number, number][] | null =
    trackPoint && (trackPoint.lat !== stopLat || trackPoint.lon !== stopLon)
      ? [
          [trackPoint.lat, trackPoint.lon],
          [stopLat, stopLon],
        ]
      : null;

  const entryPoint = routeSegment[0] ?? null;
  const exitPoint = routeSegment.length > 1 ? routeSegment[routeSegment.length - 1] : null;

  if (route.track_points.length < 2) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line/50 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-line/40 bg-canvas/50 px-3 py-2">
        <p className="text-xs font-medium text-ink">Race route through this area</p>
        <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-medium text-purple-900">
          {detourComplexityLabel(detourM)}
        </span>
      </div>
      <div className="h-60 sm:h-72">
        <MapContainer
          center={[stopLat, stopLon]}
          zoom={16}
          className="h-full w-full verification-map"
          attributionControl={false}
          {...VERIFY_MAP_STATIC_PROPS}
        >
          <TileLayer url={BASEMAP_URL} />
          <FitStopBounds
            route={route}
            stopKm={stopKm}
            stopLat={stopLat}
            stopLon={stopLon}
            detourM={detourM}
            windowKm={windowKm}
          />
          {extendedSegment.length >= 2 && (
            <Polyline
              positions={extendedSegment}
              interactive={false}
              pathOptions={{
                color: ROUTE_FADED,
                weight: 4,
                opacity: 0.35,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
          )}
          <RouteGlowLayers positions={routeSegment} />
          {detourLine && (
            <>
              <Polyline
                positions={detourLine}
                pathOptions={{
                  color: DETOUR_COLOR,
                  weight: 6,
                  opacity: 0.18,
                  dashArray: "2 4",
                }}
              />
              <Polyline
                positions={detourLine}
                pathOptions={{
                  color: DETOUR_COLOR,
                  weight: 3,
                  opacity: 0.95,
                  dashArray: "7 9",
                  lineCap: "round",
                }}
              />
            </>
          )}
          {entryPoint && (
            <Marker position={entryPoint} icon={endpointIcon("In")} interactive={false} />
          )}
          {exitPoint && (
            <Marker position={exitPoint} icon={endpointIcon("Out")} interactive={false} />
          )}
          <Marker position={[stopLat, stopLon]} icon={markerDivIcon()} />
        </MapContainer>
      </div>
    </div>
  );
}
