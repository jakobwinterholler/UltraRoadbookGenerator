import { computeStopConfidence } from "./stopConfidence";
import type { CompanionBundle, CompanionStop, CompanionStopAlternative } from "../types/sync";

export type GpsGpxDeviceProfile = "original" | "coros" | "garmin" | "wahoo";

export const GPS_GPX_DEVICE_PROFILES: GpsGpxDeviceProfile[] = [
  "original",
  "coros",
  "garmin",
  "wahoo",
];

export interface GpsGpxExportOptions {
  deviceProfile: GpsGpxDeviceProfile;
  verifiedOnly: boolean;
  includeHighConfidence: boolean;
  includeAlternatives: boolean;
}

export interface TrackFingerprint {
  trackPointCount: number;
  distanceKm: number;
  elevationGainM: number;
  geometryChecksum: string;
  trackBytesChecksum: string;
}

export interface GpsGpxExportSummary {
  deviceProfile: GpsGpxDeviceProfile;
  waypointCount: number;
  trackPointCount: number;
  distanceKm: number;
  elevationGainM: number;
}

export class GpxTrackModifiedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GpxTrackModifiedError";
  }
}

interface GpsWaypoint {
  lat: number;
  lon: number;
  ele: number | null;
  name: string;
  desc: string;
  category: string;
  km: number;
  isPrimary: boolean;
  osmKey: string;
}

const EARTH_RADIUS_M = 6_371_000;

function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const lat1R = (lat1 * Math.PI) / 180;
  const lon1R = (lon1 * Math.PI) / 180;
  const lat2R = (lat2 * Math.PI) / 180;
  const lon2R = (lon2 * Math.PI) / 180;
  const dLat = lat2R - lat1R;
  const dLon = lon2R - lon1R;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1R) * Math.cos(lat2R) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function sha256Hex(value: string): string {
  // Lightweight sync hash for validation (stable across runtimes).
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function decodeGpx(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return new TextDecoder("utf-8").decode(view);
}

function extractTrackBytes(gpxText: string): string {
  const matches = [...gpxText.matchAll(/<trk\b[^>]*>[\s\S]*?<\/trk>/gi)];
  if (matches.length === 0) {
    throw new Error("No <trk> sections found in GPX.");
  }
  return matches.map((match) => match[0]).join("");
}

function parseTrackPoints(gpxText: string): Array<{ lat: number; lon: number; ele: number | null }> {
  const points: Array<{ lat: number; lon: number; ele: number | null }> = [];
  const pattern =
    /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"[^>]*>([\s\S]*?)<\/trkpt>/gi;
  for (const match of gpxText.matchAll(pattern)) {
    const lat = Number(match[1]);
    const lon = Number(match[2]);
    const body = match[3] ?? "";
    const eleMatch = body.match(/<ele[^>]*>([^<]+)<\/ele>/i);
    const ele = eleMatch ? Number(eleMatch[1]) : null;
    points.push({
      lat,
      lon,
      ele: ele == null || Number.isNaN(ele) ? null : ele,
    });
  }
  if (points.length === 0) {
    throw new Error("No track points found in GPX.");
  }
  return points;
}

export function fingerprintGpxBytes(bytes: ArrayBuffer | Uint8Array): TrackFingerprint {
  const gpxText = decodeGpx(bytes);
  const points = parseTrackPoints(gpxText);
  let distanceKm = 0;
  let elevationGainM = 0;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    distanceKm += haversineM(previous.lat, previous.lon, current.lat, current.lon) / 1000;
    if (previous.ele != null && current.ele != null && current.ele > previous.ele) {
      elevationGainM += current.ele - previous.ele;
    }
  }
  const geometryParts = points.map(
    (point) => `${point.lat},${point.lon},${point.ele ?? ""}`,
  );
  const trackBytes = extractTrackBytes(gpxText);
  return {
    trackPointCount: points.length,
    distanceKm,
    elevationGainM,
    geometryChecksum: sha256Hex(geometryParts.join("|")),
    trackBytesChecksum: sha256Hex(trackBytes),
  };
}

function validateTrackUnchanged(before: TrackFingerprint, after: TrackFingerprint): void {
  const failures: string[] = [];
  if (before.trackPointCount !== after.trackPointCount) {
    failures.push(
      `Track point count changed (${before.trackPointCount} → ${after.trackPointCount}).`,
    );
  }
  if (Math.abs(before.distanceKm - after.distanceKm) >= 0.001) {
    failures.push("Route distance changed.");
  }
  if (Math.abs(before.elevationGainM - after.elevationGainM) >= 0.5) {
    failures.push("Elevation gain changed.");
  }
  if (before.geometryChecksum !== after.geometryChecksum) {
    failures.push("Route geometry checksum mismatch.");
  }
  if (before.trackBytesChecksum !== after.trackBytesChecksum) {
    failures.push("Track section changed.");
  }
  if (failures.length > 0) {
    throw new GpxTrackModifiedError(failures.join(" "));
  }
}

function formatKmLabel(km: number): string {
  return `KM${Math.round(km)}`;
}

function shortBrandLabel(name: string): string {
  return name.trim().slice(0, 14) || "Stop";
}

function serviceIcons(stop: CompanionStop): string {
  const icons: string[] = [];
  if (stop.hasFuel) {
    icons.push("⛽");
  }
  if (stop.hasWater) {
    icons.push("💧");
  }
  if (stop.hasFood) {
    icons.push("🛒");
  }
  if (stop.hasCoffee) {
    icons.push("☕");
  }
  if (icons.length > 0) {
    return [...new Set(icons)].join("");
  }
  const category = stop.category.toLowerCase();
  if (category.includes("fuel") || category.includes("gas")) {
    return "⛽";
  }
  if (category.includes("water")) {
    return "💧";
  }
  if (category.includes("supermarket") || category.includes("convenience")) {
    return "🛒";
  }
  if (category.includes("cafe") || category.includes("café") || category.includes("restaurant")) {
    return "🍽";
  }
  return stop.icon || "📍";
}

function serviceLabels(stop: CompanionStop): string {
  const services: string[] = [];
  if (stop.hasFuel) {
    services.push("Fuel");
  }
  if (stop.hasWater) {
    services.push("Water");
  }
  if (stop.hasFood) {
    services.push("Food");
  }
  if (stop.hasCoffee) {
    services.push("Coffee");
  }
  return services.length > 0 ? services.join(", ") : stop.categoryLabel;
}

function waypointName(
  stop: Pick<CompanionStop, "name" | "category" | "categoryLabel" | "hasFuel" | "hasWater" | "hasFood" | "hasCoffee" | "icon">,
  km: number,
  deviceProfile: GpsGpxDeviceProfile,
  isPrimary: boolean,
): string {
  const kmLabel = formatKmLabel(km);
  if (deviceProfile === "coros") {
    const prefix = isPrimary ? "" : "ALT ";
    const icons = serviceIcons(stop as CompanionStop);
    const shortLabel = shortBrandLabel(stop.name);
    const category = stop.category.toLowerCase();
    if (stop.hasFuel || category.includes("fuel") || category.includes("gas")) {
      const label = stop.hasWater ? "⛽💧" : "⛽";
      return `${prefix}${label} ${shortLabel} ${kmLabel}`.trim().slice(0, 32);
    }
    if (category.includes("supermarket") || category.includes("convenience")) {
      return `${prefix}🛒 ${shortLabel} ${kmLabel}`.trim().slice(0, 32);
    }
    if (stop.hasWater || category.includes("water")) {
      return `${prefix}💧 ${kmLabel}`.trim().slice(0, 32);
    }
    if (category.includes("cafe") || category.includes("café")) {
      return `${prefix}🍽 ${shortLabel} ${kmLabel}`.trim().slice(0, 32);
    }
    return `${prefix}${icons} ${shortLabel} ${kmLabel}`.trim().slice(0, 32);
  }
  const base = isPrimary ? stop.name : `ALT ${stop.name}`;
  return `${base} ${kmLabel}`.slice(0, 64);
}

function waypointDesc(
  stop: CompanionStop,
  km: number,
  isPrimary: boolean,
): string {
  const confidence = computeStopConfidence({
    verificationStatus: stop.verificationStatus,
    verifiedAt: stop.verificationDate,
    poiScore: stop.confidenceScore,
    openingHours: stop.openingHours,
    website: stop.website,
    phone: stop.phone,
  });
  return [
    `Type: ${stop.categoryLabel}`,
    `Services: ${serviceLabels(stop)}`,
    `Route km: ${km.toFixed(2)}`,
    `Opening hours: ${stop.openingHours ?? "Unknown"}`,
    `Confidence: ${confidence.label} (${confidence.score})`,
    `Role: ${isPrimary ? "Primary" : "Alternative"}`,
    `Verification: ${stop.verificationStatus}`,
  ].join("\n");
}

function shouldExportStop(stop: CompanionStop, options: GpsGpxExportOptions): boolean {
  if (stop.verificationStatus === "verified") {
    return true;
  }
  if (options.includeHighConfidence) {
    const confidence = computeStopConfidence({
      verificationStatus: stop.verificationStatus,
      verifiedAt: stop.verificationDate,
      poiScore: stop.confidenceScore,
      openingHours: stop.openingHours,
      website: stop.website,
      phone: stop.phone,
    });
    return confidence.level === "high";
  }
  return !options.verifiedOnly;
}

function alternativeToWaypointSource(
  anchor: CompanionStop,
  alternative: CompanionStopAlternative,
): Pick<
  CompanionStop,
  | "name"
  | "category"
  | "categoryLabel"
  | "hasFuel"
  | "hasWater"
  | "hasFood"
  | "hasCoffee"
  | "icon"
  | "openingHours"
  | "confidenceScore"
  | "verificationStatus"
  | "verificationDate"
  | "website"
  | "phone"
> {
  return {
    name: alternative.name,
    category: alternative.category,
    categoryLabel: alternative.categoryLabel,
    icon: alternative.icon,
    hasFuel: anchor.hasFuel,
    hasWater: anchor.hasWater,
    hasFood: anchor.hasFood,
    hasCoffee: anchor.hasCoffee,
    openingHours: alternative.openingHours,
    confidenceScore: alternative.score,
    verificationStatus: alternative.verificationStatus,
    verificationDate: null,
    website: alternative.website ?? null,
    phone: alternative.phone ?? null,
  };
}

function collectWaypoints(bundle: CompanionBundle, options: GpsGpxExportOptions): GpsWaypoint[] {
  const waypoints: GpsWaypoint[] = [];
  const seenOsm = new Set<string>();
  const seenZonePrimary = new Set<string>();

  const stops = [...bundle.stops].sort((left, right) => left.km - right.km);
  for (const stop of stops) {
    if (!shouldExportStop(stop, options)) {
      continue;
    }

    const primaryKey =
      stop.osmType && stop.osmId != null ? `${stop.osmType}-${stop.osmId}` : `zone-${stop.zoneId}`;
    if (!seenZonePrimary.has(String(stop.zoneId))) {
      seenZonePrimary.add(String(stop.zoneId));
      if (!seenOsm.has(primaryKey)) {
        seenOsm.add(primaryKey);
        waypoints.push({
          lat: stop.lat,
          lon: stop.lon,
          ele: null,
          name: waypointName(stop, stop.km, options.deviceProfile, true),
          desc: waypointDesc(stop, stop.km, true),
          category: stop.category,
          km: stop.km,
          isPrimary: true,
          osmKey: primaryKey,
        });
      }
    }

    if (!options.includeAlternatives) {
      continue;
    }

    for (const alternative of stop.alternatives ?? []) {
      const altKey = `${alternative.osmType}-${alternative.osmId}`;
      if (seenOsm.has(altKey)) {
        continue;
      }
      seenOsm.add(altKey);
      const source = alternativeToWaypointSource(stop, alternative);
      const km = alternative.distanceAlongKm ?? stop.km;
      waypoints.push({
        lat: alternative.lat,
        lon: alternative.lon,
        ele: null,
        name: waypointName(source, km, options.deviceProfile, false),
        desc: waypointDesc(
          {
            ...stop,
            ...source,
            lat: alternative.lat,
            lon: alternative.lon,
            km,
          },
          km,
          false,
        ),
        category: alternative.category,
        km,
        isPrimary: false,
        osmKey: altKey,
      });
    }
  }

  waypoints.sort((left, right) => left.km - right.km || Number(right.isPrimary) - Number(left.isPrimary));
  return waypoints;
}

function renderWaypointsXml(waypoints: GpsWaypoint[]): string {
  if (waypoints.length === 0) {
    return "";
  }
  const chunks = ["\n  <!-- Ultra Roadbook navigation waypoints -->\n"];
  for (const waypoint of waypoints) {
    const lat = waypoint.lat.toFixed(8).replace(/\.?0+$/, "");
    const lon = waypoint.lon.toFixed(8).replace(/\.?0+$/, "");
    chunks.push(`  <wpt lat="${lat}" lon="${lon}">\n`);
    if (waypoint.ele != null) {
      chunks.push(`    <ele>${waypoint.ele}</ele>\n`);
    }
    chunks.push(`    <name>${escapeXml(waypoint.name)}</name>\n`);
    chunks.push(`    <desc>${escapeXml(waypoint.desc)}</desc>\n`);
    chunks.push(`    <type>${escapeXml(waypoint.category)}</type>\n`);
    chunks.push("  </wpt>\n");
  }
  return chunks.join("");
}

function insertWaypoints(original: Uint8Array, waypointXml: string): Uint8Array {
  if (!waypointXml) {
    return original;
  }
  const text = decodeGpx(original);
  const closingMatch = text.match(/<\/gpx\s*>/i);
  if (!closingMatch || closingMatch.index == null) {
    throw new Error("Invalid GPX: missing </gpx> closing tag.");
  }
  const merged = `${text.slice(0, closingMatch.index)}${waypointXml}${text.slice(closingMatch.index)}`;
  return new TextEncoder().encode(merged);
}

const DEFAULT_OPTIONS: GpsGpxExportOptions = {
  deviceProfile: "coros",
  verifiedOnly: true,
  includeHighConfidence: false,
  includeAlternatives: false,
};

export function exportGpxForGps(
  originalGpx: ArrayBuffer | Uint8Array,
  bundle: CompanionBundle,
  options: Partial<GpsGpxExportOptions> = {},
): { bytes: Uint8Array; summary: GpsGpxExportSummary } {
  const resolved: GpsGpxExportOptions = { ...DEFAULT_OPTIONS, ...options };
  if (!GPS_GPX_DEVICE_PROFILES.includes(resolved.deviceProfile)) {
    throw new Error(`Unsupported device profile: ${resolved.deviceProfile}`);
  }

  const originalBytes =
    originalGpx instanceof Uint8Array ? originalGpx : new Uint8Array(originalGpx);
  const before = fingerprintGpxBytes(originalBytes);
  const waypoints = collectWaypoints(bundle, resolved);
  const outputBytes = insertWaypoints(originalBytes, renderWaypointsXml(waypoints));
  const after = fingerprintGpxBytes(outputBytes);
  validateTrackUnchanged(before, after);

  return {
    bytes: outputBytes,
    summary: {
      deviceProfile: resolved.deviceProfile,
      waypointCount: waypoints.length,
      trackPointCount: before.trackPointCount,
      distanceKm: before.distanceKm,
      elevationGainM: before.elevationGainM,
    },
  };
}
