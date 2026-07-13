import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, TileLayer, useMap } from "react-leaflet";
import type { ResupplyZone, RouteVisualization } from "../../api";
import type { VerifiedPlanStop } from "../../planning/stopVerification/verifiedPlan";
import type { VerifiedStopRecord } from "../../planning/stopVerification/types";
import { verifiedStopKey } from "../../planning/stopVerification/types";
import { VerificationStatusLegendItem } from "./VerificationStatusBadge";
import { VERIFICATION_STATUS_ORDER } from "../../planning/stopVerification/verificationStatusPresentation";
import { VERIFY_MAP_STATIC_PROPS } from "../maps/planningMapInteraction";

const ROUTE_CORE = "#6D28D9";
const ROUTE_HALO = "#C4B5FD";
const ROUTE_GLOW = "#FFFFFF";
const BASEMAP_URL = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

interface VerifiedPlanMapProps {
  route: RouteVisualization;
  verifiedStops: VerifiedPlanStop[];
  planningHubs: ResupplyZone[];
  verifiedRecords: Record<string, VerifiedStopRecord>;
  showUnreviewed?: boolean;
}

function stopIcon(status: "verified" | "rejected" | "deferred" | "not_reviewed", size = 14): L.DivIcon {
  const presentation = {
    verified: { bg: "#10B981", ring: "#059669" },
    rejected: { bg: "#EF4444", ring: "#DC2626" },
    deferred: { bg: "#F59E0B", ring: "#D97706" },
    not_reviewed: { bg: "#FFFFFF", ring: "#CBD5E1" },
  }[status];
  const glyph =
    status === "verified"
      ? "✓"
      : status === "rejected"
        ? "✕"
        : status === "deferred"
          ? "⏳"
          : "○";
  const color = status === "not_reviewed" ? "#94A3B8" : "#FFFFFF";
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;border-radius:9999px;background:${presentation.bg};border:2px solid ${presentation.ring};box-shadow:0 1px 3px rgba(0,0,0,0.2);display:flex;align-items:center;justify-content:center;color:${color};font-size:${Math.max(8, size - 6)}px;font-weight:700;line-height:1">${glyph}</div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function FitRouteBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();

  useEffect(() => {
    if (positions.length >= 2) {
      map.fitBounds(positions, { padding: [24, 24], animate: false });
    }
  }, [map, positions]);

  return null;
}

export default function VerifiedPlanMap({
  route,
  verifiedStops,
  planningHubs,
  verifiedRecords,
  showUnreviewed = false,
}: VerifiedPlanMapProps) {
  const routePositions = useMemo(
    () => route.track_points.map((point) => [point.lat, point.lon] as [number, number]),
    [route.track_points],
  );

  const rejectedMarkers = useMemo(
    () =>
      planningHubs
        .filter((zone) => verifiedRecords[verifiedStopKey(zone.zone_id)]?.status === "rejected")
        .map((zone) => ({
          zoneId: zone.zone_id,
          lat: zone.lat,
          lon: zone.lon,
        })),
    [planningHubs, verifiedRecords],
  );

  const deferredMarkers = useMemo(
    () =>
      planningHubs
        .filter((zone) => verifiedRecords[verifiedStopKey(zone.zone_id)]?.status === "deferred")
        .map((zone) => ({
          zoneId: zone.zone_id,
          lat: zone.lat,
          lon: zone.lon,
        })),
    [planningHubs, verifiedRecords],
  );

  const unreviewedMarkers = useMemo(() => {
    if (!showUnreviewed) {
      return [];
    }
    return planningHubs
      .filter((zone) => !verifiedRecords[verifiedStopKey(zone.zone_id)])
      .map((zone) => ({
        zoneId: zone.zone_id,
        lat: zone.lat,
        lon: zone.lon,
      }));
  }, [planningHubs, verifiedRecords, showUnreviewed]);

  if (route.track_points.length < 2) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line/50 bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-line/40 bg-canvas/50 px-3 py-2">
        <p className="text-xs font-medium text-ink">Verified plan</p>
        <div className="flex flex-wrap items-center gap-3">
          {VERIFICATION_STATUS_ORDER.filter(
            (status) => showUnreviewed || status !== "not_reviewed",
          ).map((status) => (
            <VerificationStatusLegendItem key={status} status={status} />
          ))}
        </div>
      </div>
      <div className="h-48 sm:h-56">
        <MapContainer
          center={[route.track_points[0].lat, route.track_points[0].lon]}
          zoom={10}
          className="h-full w-full verification-map"
          attributionControl={false}
          {...VERIFY_MAP_STATIC_PROPS}
        >
          <TileLayer url={BASEMAP_URL} />
          <FitRouteBounds positions={routePositions} />
          <Polyline
            positions={routePositions}
            interactive={false}
            pathOptions={{
              color: ROUTE_GLOW,
              weight: 10,
              opacity: 0.9,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
          <Polyline
            positions={routePositions}
            interactive={false}
            pathOptions={{
              color: ROUTE_HALO,
              weight: 7,
              opacity: 0.95,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
          <Polyline
            positions={routePositions}
            interactive={false}
            pathOptions={{
              color: ROUTE_CORE,
              weight: 5,
              opacity: 1,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
          {unreviewedMarkers.map((marker) => (
            <Marker
              key={`pending-${marker.zoneId}`}
              position={[marker.lat, marker.lon]}
              icon={stopIcon("not_reviewed", 10)}
              interactive={false}
            />
          ))}
          {deferredMarkers.map((marker) => (
            <Marker
              key={`deferred-${marker.zoneId}`}
              position={[marker.lat, marker.lon]}
              icon={stopIcon("deferred", 11)}
              interactive={false}
            />
          ))}
          {rejectedMarkers.map((marker) => (
            <Marker
              key={`red-${marker.zoneId}`}
              position={[marker.lat, marker.lon]}
              icon={stopIcon("rejected", 12)}
              interactive={false}
            />
          ))}
          {verifiedStops.map((stop) => (
            <Marker
              key={`green-${stop.zoneId}`}
              position={[stop.lat, stop.lon]}
              icon={stopIcon("verified", 14)}
              interactive={false}
            />
          ))}
        </MapContainer>
      </div>
    </div>
  );
}
