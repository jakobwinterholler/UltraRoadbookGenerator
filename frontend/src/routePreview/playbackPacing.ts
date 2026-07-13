import type { ClimbRow, TrackPoint } from "../api";
import type { AnalyzedClimb } from "../planning/climbAnalysis";
import { elevationAtKm } from "./routePreviewHud";

const PACE_STEP_KM = 0.4;

export interface PlaybackPaceTable {
  kmSamples: number[];
  progressSamples: number[];
  totalDurationS: number;
}

function gradientAtKm(points: TrackPoint[], km: number, totalKm: number): number {
  const delta = 0.12;
  const start = Math.max(0, km - delta);
  const end = Math.min(totalKm, km + delta);
  const rise = elevationAtKm(points, end) - elevationAtKm(points, start);
  const distanceM = Math.max(1, (end - start) * 1000);
  return (rise / distanceM) * 100;
}

function keyClimbAtKm(km: number, keyClimbs: AnalyzedClimb[]): AnalyzedClimb | null {
  return keyClimbs.find((climb) => km >= climb.start_km && km <= climb.end_km) ?? null;
}

function paceMultiplier(
  km: number,
  gradientPct: number,
  keyClimbs: AnalyzedClimb[],
): number {
  const activeClimb = keyClimbAtKm(km, keyClimbs);
  if (activeClimb) {
    if (activeClimb.avg_gradient_pct >= 8) {
      return 0.32;
    }
    if (activeClimb.avg_gradient_pct >= 6) {
      return 0.42;
    }
    return 0.52;
  }

  for (const climb of keyClimbs) {
    const approachKm = climb.start_km - km;
    if (approachKm > 0 && approachKm <= 1.2 && climb.avg_gradient_pct >= 5) {
      return 0.72;
    }
  }

  if (gradientPct <= -2.5) {
    return 1.3;
  }
  if (gradientPct < 1.5) {
    return 1.38;
  }
  if (gradientPct < 3.5) {
    return 1.05;
  }
  if (gradientPct < 5.5) {
    return 0.82;
  }
  if (gradientPct < 7.5) {
    return 0.58;
  }
  return 0.4;
}

export function buildPlaybackPaceTable(
  trackPoints: TrackPoint[],
  totalKm: number,
  totalDurationS: number,
  keyClimbs: AnalyzedClimb[],
): PlaybackPaceTable {
  const kmSamples: number[] = [];
  const weights: number[] = [];

  for (let km = 0; km <= totalKm; km += PACE_STEP_KM) {
    const sampleKm = Math.min(totalKm, km);
    kmSamples.push(sampleKm);
    const gradientPct = gradientAtKm(trackPoints, sampleKm, totalKm);
    const multiplier = paceMultiplier(sampleKm, gradientPct, keyClimbs);
    weights.push(PACE_STEP_KM / Math.max(0.15, multiplier));
  }

  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let cumulative = 0;
  const progressSamples = weights.map((weight) => {
    cumulative += weight / totalWeight;
    return cumulative;
  });
  if (progressSamples.length > 0) {
    progressSamples[progressSamples.length - 1] = 1;
  }

  return { kmSamples, progressSamples, totalDurationS };
}

export function progressAtElapsed(table: PlaybackPaceTable, elapsedS: number): number {
  if (table.progressSamples.length === 0) {
    return 0;
  }
  const ratio = Math.min(1, Math.max(0, elapsedS / table.totalDurationS));
  if (ratio >= 1) {
    return 1;
  }

  let low = 0;
  let high = table.progressSamples.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (table.progressSamples[mid] < ratio) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  const index = Math.max(0, low);
  const prevIndex = Math.max(0, index - 1);
  const prevProgress = table.progressSamples[prevIndex] ?? 0;
  const nextProgress = table.progressSamples[index] ?? 1;
  const span = Math.max(1e-9, nextProgress - prevProgress);
  const blend = (ratio - prevProgress) / span;
  return prevProgress + (nextProgress - prevProgress) * Math.min(1, Math.max(0, blend));
}

export function elapsedAtProgress(table: PlaybackPaceTable, progress: number): number {
  if (table.progressSamples.length === 0) {
    return 0;
  }
  const clamped = Math.min(1, Math.max(0, progress));
  if (clamped <= 0) {
    return 0;
  }
  if (clamped >= 1) {
    return table.totalDurationS;
  }

  let low = 0;
  let high = table.progressSamples.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (table.progressSamples[mid] < clamped) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  const index = Math.max(0, low);
  const prevIndex = Math.max(0, index - 1);
  const prevProgress = table.progressSamples[prevIndex] ?? 0;
  const nextProgress = table.progressSamples[index] ?? 1;
  const span = Math.max(1e-9, nextProgress - prevProgress);
  const blend = (clamped - prevProgress) / span;
  const ratio = prevProgress + (nextProgress - prevProgress) * Math.min(1, Math.max(0, blend));
  return ratio * table.totalDurationS;
}

export function activeKeyClimbAtKm(
  km: number,
  keyClimbs: AnalyzedClimb[],
): AnalyzedClimb | null {
  return keyClimbAtKm(km, keyClimbs);
}

export function climbMaxGradientPct(climb: ClimbRow): number {
  return (
    climb.max_1000_m_pct ??
    climb.max_500_m_pct ??
    climb.max_250_m_pct ??
    climb.max_100_m_pct ??
    climb.max_50_m_pct ??
    climb.avg_gradient_pct
  );
}

export function estimateClimbRidingMinutes(climb: ClimbRow): number {
  const speedKmh = Math.max(8, 24 - climb.avg_gradient_pct * 2.1);
  return (climb.length_km / speedKmh) * 60;
}

export function formatRidingDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) {
    return "—";
  }
  const totalMinutes = Math.round(minutes);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours <= 0) {
    return `${mins} min`;
  }
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}m`;
}
