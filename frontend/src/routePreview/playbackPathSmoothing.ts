import type { TrackPoint } from "../api";

const EARTH_RADIUS_M = 6_371_000;
const RESAMPLE_STEP_M = 20;
const CONTROL_MIN_SPACING_M = 8;
const MAX_DEVIATION_TARGET_M = 10;
const BEARING_LOOKAHEAD_M = 28;
const MAX_PLAYBACK_POINTS = 15_000;

interface Vec2 {
  x: number;
  y: number;
}

export interface PlaybackPathPoint {
  lat: number;
  lon: number;
  /** Distance along the race using the original GPX km scale. */
  km: number;
  /** Arc length along the smoothed polyline from the start, in meters. */
  arcM: number;
}

export interface PlaybackPathVerification {
  maxDeviationM: number;
  meanDeviationM: number;
  p95DeviationM: number;
  sampleCount: number;
  withinTolerance: boolean;
  alpha: number;
}

export interface SmoothedPlaybackPath {
  points: PlaybackPathPoint[];
  totalKm: number;
  coordinates: [number, number][];
  verification: PlaybackPathVerification;
}

export function haversineM(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const dPhi = ((lat2 - lat1) * Math.PI) / 180;
  const dLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

function normalizeBearing(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

function bearingBetween(from: { lon: number; lat: number }, to: { lon: number; lat: number }): number {
  const fromLat = (from.lat * Math.PI) / 180;
  const toLat = (to.lat * Math.PI) / 180;
  const deltaLon = ((to.lon - from.lon) * Math.PI) / 180;
  const y = Math.sin(deltaLon) * Math.cos(toLat);
  const x =
    Math.cos(fromLat) * Math.sin(toLat) -
    Math.sin(fromLat) * Math.cos(toLat) * Math.cos(deltaLon);
  return normalizeBearing((Math.atan2(y, x) * 180) / Math.PI);
}

function toLocalMeters(
  point: Pick<TrackPoint, "lat" | "lon">,
  originLat: number,
  originLon: number,
): Vec2 {
  const cosLat = Math.cos((originLat * Math.PI) / 180);
  return {
    x: (point.lon - originLon) * cosLat * (Math.PI / 180) * EARTH_RADIUS_M,
    y: (point.lat - originLat) * (Math.PI / 180) * EARTH_RADIUS_M,
  };
}

function fromLocalMeters(point: Vec2, originLat: number, originLon: number) {
  const cosLat = Math.cos((originLat * Math.PI) / 180);
  const lat = originLat + (point.y / EARTH_RADIUS_M) * (180 / Math.PI);
  const lon = originLon + (point.x / (EARTH_RADIUS_M * cosLat)) * (180 / Math.PI);
  return { lat, lon };
}

function lerpVec(a: Vec2, b: Vec2, t: number): Vec2 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

function distVec(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function catmullRomCentripetal(
  p0: Vec2,
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  u: number,
  alpha: number,
): Vec2 {
  if (u <= 0) {
    return p1;
  }
  if (u >= 1) {
    return p2;
  }

  const d01 = Math.max(1e-6, distVec(p0, p1));
  const d12 = Math.max(1e-6, distVec(p1, p2));
  const d23 = Math.max(1e-6, distVec(p2, p3));

  const t0 = 0;
  const t1 = t0 + d01 ** alpha;
  const t2 = t1 + d12 ** alpha;
  const t3 = t2 + d23 ** alpha;
  const t = t1 + u * (t2 - t1);

  const lerpAt = (a: Vec2, b: Vec2, ta: number, tb: number, tc: number) => {
    if (Math.abs(tb - ta) < 1e-9) {
      return a;
    }
    return lerpVec(a, b, (tc - ta) / (tb - ta));
  };

  const a1 = lerpAt(p0, p1, t0, t1, t);
  const a2 = lerpAt(p1, p2, t1, t2, t);
  const a3 = lerpAt(p2, p3, t2, t3, t);
  const b1 = lerpAt(a1, a2, t0, t2, t);
  const b2 = lerpAt(a2, a3, t1, t3, t);
  return lerpAt(b1, b2, t1, t2, t);
}

function buildControlPolygon(points: TrackPoint[], minSpacingM: number): TrackPoint[] {
  if (points.length <= 2) {
    return points.slice();
  }

  const kept: TrackPoint[] = [points[0]];
  for (let index = 1; index < points.length - 1; index += 1) {
    const point = points[index];
    const last = kept[kept.length - 1];
    if (haversineM(last.lat, last.lon, point.lat, point.lon) >= minSpacingM) {
      kept.push(point);
    }
  }

  const finish = points[points.length - 1];
  const tail = kept[kept.length - 1];
  if (tail.lat !== finish.lat || tail.lon !== finish.lon) {
    kept.push(finish);
  }

  return kept.length >= 2 ? kept : points.slice();
}

function resampleCatmullRom(
  controls: TrackPoint[],
  originLat: number,
  originLon: number,
  originalTotalKm: number,
  alpha: number,
): PlaybackPathPoint[] {
  if (controls.length < 2) {
    const only = controls[0];
    return only
      ? [
          {
            lat: only.lat,
            lon: only.lon,
            km: only.km,
            arcM: 0,
          },
        ]
      : [];
  }

  const local = controls.map((point) => toLocalMeters(point, originLat, originLon));
  const dense: PlaybackPathPoint[] = [];
  let arcM = 0;
  let prevLocal: Vec2 | null = null;

  const pushLocal = (sample: Vec2) => {
    if (prevLocal) {
      const stepM = distVec(prevLocal, sample);
      if (stepM < 0.5) {
        return;
      }
      arcM += stepM;
    }
    prevLocal = sample;
    const { lat, lon } = fromLocalMeters(sample, originLat, originLon);
    dense.push({ lat, lon, km: 0, arcM });
  };

  pushLocal(local[0]);

  const approxLengthM = local.reduce(
    (sum, point, index) => (index === 0 ? 0 : sum + distVec(local[index - 1], point)),
    0,
  );
  const resampleStepM = Math.max(
    RESAMPLE_STEP_M,
    approxLengthM / Math.max(1, MAX_PLAYBACK_POINTS),
  );

  for (let index = 0; index < controls.length - 1; index += 1) {
    const p0 = local[Math.max(0, index - 1)];
    const p1 = local[index];
    const p2 = local[index + 1];
    const p3 = local[Math.min(local.length - 1, index + 2)];

    const chordM = distVec(p1, p2);
    const steps = Math.max(1, Math.ceil(chordM / resampleStepM));
    for (let step = 1; step <= steps; step += 1) {
      const u = step / steps;
      pushLocal(catmullRomCentripetal(p0, p1, p2, p3, u, alpha));
    }
  }

  const totalArcM = dense[dense.length - 1]?.arcM ?? 0;
  for (const point of dense) {
    point.km =
      totalArcM <= 0
        ? 0
        : (point.arcM / totalArcM) * Math.max(0, originalTotalKm);
  }

  return dense;
}

function closestDistanceToPolylineM(
  lat: number,
  lon: number,
  polyline: PlaybackPathPoint[],
): number {
  if (polyline.length === 0) {
    return Infinity;
  }
  if (polyline.length === 1) {
    return haversineM(lat, lon, polyline[0].lat, polyline[0].lon);
  }

  let best = Infinity;
  for (let index = 0; index < polyline.length - 1; index += 1) {
    const a = polyline[index];
    const b = polyline[index + 1];
    const ax = a.lon;
    const ay = a.lat;
    const bx = b.lon;
    const by = b.lat;
    const px = lon;
    const py = lat;
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    const t =
      lenSq <= 1e-12 ? 0 : Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / lenSq));
    const projLon = ax + dx * t;
    const projLat = ay + dy * t;
    best = Math.min(best, haversineM(lat, lon, projLat, projLon));
  }

  return best;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * sorted.length)));
  return sorted[index];
}

export function verifyPlaybackPath(
  original: TrackPoint[],
  playback: PlaybackPathPoint[],
  alpha: number,
): PlaybackPathVerification {
  const deviations: number[] = [];
  const stride = original.length > 4000 ? Math.ceil(original.length / 4000) : 1;

  for (let index = 0; index < original.length; index += stride) {
    const point = original[index];
    deviations.push(closestDistanceToPolylineM(point.lat, point.lon, playback));
  }

  const maxDeviationM = deviations.length > 0 ? Math.max(...deviations) : 0;
  const meanDeviationM =
    deviations.length > 0
      ? deviations.reduce((sum, value) => sum + value, 0) / deviations.length
      : 0;

  return {
    maxDeviationM,
    meanDeviationM,
    p95DeviationM: percentile(deviations, 0.95),
    sampleCount: deviations.length,
    withinTolerance: maxDeviationM <= MAX_DEVIATION_TARGET_M,
    alpha,
  };
}

function buildWithAlpha(
  original: TrackPoint[],
  alpha: number,
): SmoothedPlaybackPath {
  const valid = original.filter(
    (point) => Number.isFinite(point.lat) && Number.isFinite(point.lon),
  );
  const totalKm = valid[valid.length - 1]?.km ?? 0;
  if (valid.length < 2) {
    const only = valid[0];
    const points = only
      ? [{ lat: only.lat, lon: only.lon, km: only.km, arcM: 0 }]
      : [];
    return {
      points,
      totalKm,
      coordinates: points.map((point) => [point.lon, point.lat]),
      verification: {
        maxDeviationM: 0,
        meanDeviationM: 0,
        p95DeviationM: 0,
        sampleCount: 0,
        withinTolerance: true,
        alpha,
      },
    };
  }

  const originLat = valid[0].lat;
  const originLon = valid[0].lon;
  const controls = buildControlPolygon(valid, CONTROL_MIN_SPACING_M);
  const points = resampleCatmullRom(controls, originLat, originLon, totalKm, alpha);

  return {
    points,
    totalKm,
    coordinates: points.map((point) => [point.lon, point.lat]),
    verification: verifyPlaybackPath(valid, points, alpha),
  };
}

/**
 * Builds a smoothed playback path from raw GPX track points.
 * The original track is never modified — only the derived animation path is smoothed.
 */
export function buildSmoothedPlaybackPath(original: TrackPoint[]): SmoothedPlaybackPath {
  const alphas = [0.5, 0.65, 0.8, 1];
  let best = buildWithAlpha(original, alphas[0]);

  for (const alpha of alphas) {
    const candidate = buildWithAlpha(original, alpha);
    if (candidate.verification.withinTolerance) {
      return candidate;
    }
    if (candidate.verification.maxDeviationM < best.verification.maxDeviationM) {
      best = candidate;
    }
  }

  return best;
}

function samplePointAtKm(points: PlaybackPathPoint[], km: number): PlaybackPathPoint {
  if (points.length === 0) {
    return { lat: 0, lon: 0, km: 0, arcM: 0 };
  }
  if (points.length === 1 || km <= points[0].km) {
    return points[0];
  }

  const last = points[points.length - 1];
  if (km >= last.km) {
    return last;
  }

  let low = 0;
  let high = points.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (points[mid].km < km) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  const index = Math.max(1, low);
  const prev = points[index - 1];
  const next = points[index];
  const span = Math.max(0.000001, next.km - prev.km);
  const blend = (km - prev.km) / span;
  return {
    lat: prev.lat + (next.lat - prev.lat) * blend,
    lon: prev.lon + (next.lon - prev.lon) * blend,
    km,
    arcM: prev.arcM + (next.arcM - prev.arcM) * blend,
  };
}

export interface PlaybackSample {
  lng: number;
  lat: number;
  bearing: number;
  km: number;
}

export function samplePlaybackAtProgress(
  path: SmoothedPlaybackPath,
  progress: number,
): PlaybackSample {
  if (path.points.length === 0) {
    return { lng: 0, lat: 0, bearing: 0, km: 0 };
  }

  const clamped = Math.min(1, Math.max(0, progress));
  const targetKm = clamped * path.totalKm;
  const current = samplePointAtKm(path.points, targetKm);
  const lookKm = Math.min(path.totalKm, targetKm + BEARING_LOOKAHEAD_M / 1000);
  const ahead = samplePointAtKm(path.points, lookKm);
  const bearing = bearingBetween(
    { lon: current.lon, lat: current.lat },
    { lon: ahead.lon, lat: ahead.lat },
  );

  return {
    lng: current.lon,
    lat: current.lat,
    bearing,
    km: targetKm,
  };
}

export function samplePlaybackAtKm(path: SmoothedPlaybackPath, km: number): PlaybackSample {
  const progress = path.totalKm <= 0 ? 0 : km / path.totalKm;
  return samplePlaybackAtProgress(path, progress);
}
