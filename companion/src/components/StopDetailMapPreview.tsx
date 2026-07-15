import { useEffect, useMemo, useState } from "react";
import { buildRouteTrack, haversineM } from "@shared/race/mapMatching";
import type { CompanionBundle, CompanionStop } from "../types";

const PREVIEW_RADIUS_M = 150;

interface StopDetailMapPreviewProps {
  stop: CompanionStop;
  bundle: CompanionBundle;
  riderLat?: number | null;
  riderLon?: number | null;
}

interface ProjectedPoint {
  x: number;
  y: number;
}

function projectToSvg(
  items: Array<{ lat: number; lon: number }>,
  width: number,
  height: number,
  padding: number,
): ProjectedPoint[] {
  const lats = items.map((point) => point.lat);
  const lons = items.map((point) => point.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  const latSpan = Math.max(maxLat - minLat, 0.0008);
  const lonSpan = Math.max(maxLon - minLon, 0.0008);
  const latCenter = (minLat + maxLat) / 2;
  const lonCenter = (minLon + maxLon) / 2;

  const paddedMinLat = latCenter - latSpan / 2;
  const paddedMaxLat = latCenter + latSpan / 2;
  const paddedMinLon = lonCenter - lonSpan / 2;
  const paddedMaxLon = lonCenter + lonSpan / 2;

  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  return items.map((point) => ({
    x:
      padding +
      ((point.lon - paddedMinLon) / Math.max(paddedMaxLon - paddedMinLon, 1e-9)) * innerWidth,
    y:
      padding +
      (1 - (point.lat - paddedMinLat) / Math.max(paddedMaxLat - paddedMinLat, 1e-9)) * innerHeight,
  }));
}

export default function StopDetailMapPreview({
  stop,
  bundle,
  riderLat,
  riderLon,
}: StopDetailMapPreviewProps) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setAnimated(true), 40);
    return () => window.clearTimeout(timer);
  }, [stop.poiId, stop.zoneId]);

  const preview = useMemo(() => {
    const coordinates = bundle.route.coordinates;
    const totalKm = bundle.race.distanceKm;
    if (coordinates.length < 2) {
      return null;
    }

    const track = buildRouteTrack(coordinates, totalKm);
    const windowKm = PREVIEW_RADIUS_M / 1000;
    const routeNearStop = track.points
      .filter((point) => Math.abs(point.km - stop.km) <= windowKm)
      .map((point) => ({ lat: point.lat, lon: point.lon }));

    const boundsPoints = [...routeNearStop, { lat: stop.lat, lon: stop.lon }];

    const showRider =
      riderLat != null &&
      riderLon != null &&
      haversineM(riderLat, riderLon, stop.lat, stop.lon) <= PREVIEW_RADIUS_M * 2.5;

    if (showRider) {
      boundsPoints.push({ lat: riderLat, lon: riderLon });
    }

    if (routeNearStop.length < 2) {
      routeNearStop.push(
        { lat: stop.lat + 0.0009, lon: stop.lon - 0.0009 },
        { lat: stop.lat - 0.0009, lon: stop.lon + 0.0009 },
      );
    }

    const width = 400;
    const height = 208;
    const routeProjected = projectToSvg(routeNearStop, width, height, 28);
    const poiProjected = projectToSvg([{ lat: stop.lat, lon: stop.lon }], width, height, 28)[0]!;
    const riderProjected = showRider
      ? projectToSvg([{ lat: riderLat!, lon: riderLon! }], width, height, 28)[0]!
      : null;

    const routePath = routeProjected
      .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
      .join(" ");

    return {
      width,
      height,
      routePath,
      poi: poiProjected,
      rider: riderProjected,
    };
  }, [bundle.race.distanceKm, bundle.route.coordinates, riderLat, riderLon, stop.km, stop.lat, stop.lon]);

  if (!preview) {
    return (
      <div className="flex h-full items-center justify-center bg-[#0c1018] text-sm text-white/40">
        Map preview unavailable
      </div>
    );
  }

  return (
    <svg
      viewBox={`0 0 ${preview.width} ${preview.height}`}
      className={`h-full w-full transition duration-500 ease-out ${
        animated ? "scale-100 opacity-100" : "scale-[0.97] opacity-0"
      }`}
      role="img"
      aria-label={`Map preview around ${stop.name}`}
    >
      <rect width={preview.width} height={preview.height} fill="#0c1018" />
      {preview.routePath ? (
        <>
          <path
            d={preview.routePath}
            fill="none"
            stroke="#60a5fa"
            strokeWidth={14}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.45}
          />
          <path
            d={preview.routePath}
            fill="none"
            stroke="#38bdf8"
            strokeWidth={5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : null}
      {preview.rider ? (
        <>
          <circle cx={preview.rider.x} cy={preview.rider.y} r={12} fill="#0ea5e9" opacity={0.2} />
          <circle
            cx={preview.rider.x}
            cy={preview.rider.y}
            r={6}
            fill="#0ea5e9"
            stroke="#ffffff"
            strokeWidth={2}
          />
        </>
      ) : null}
      <circle cx={preview.poi.x} cy={preview.poi.y} r={22} fill="#38bdf8" opacity={0.25} />
      <circle
        cx={preview.poi.x}
        cy={preview.poi.y}
        r={10}
        fill="#ffffff"
        stroke="#38bdf8"
        strokeWidth={3}
      />
    </svg>
  );
}
