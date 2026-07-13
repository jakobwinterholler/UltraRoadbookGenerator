/** Shared layout math for route timeline rows — keeps markers, ranges, and overlays aligned. */

export const MAJOR_CLIMB_MIN_ELEVATION_GAIN_M = 300;

export interface TimelineLayout {
  labelWidth: number;
  gap: number;
  trackInset: number;
}

export function timelineLayout(compact: boolean): TimelineLayout {
  const labelWidth = compact ? 64 : 88;
  const gap = compact ? 8 : 12;
  return {
    labelWidth,
    gap,
    trackInset: labelWidth + gap,
  };
}

export function timelineKmPercent(km: number, totalKm: number): number {
  if (totalKm <= 0) {
    return 0;
  }
  return Math.min(Math.max((km / totalKm) * 100, 0), 100);
}

export function timelineRangeStyle(
  startKm: number,
  endKm: number,
  totalKm: number,
): { left: string; width: string } {
  const leftPct = timelineKmPercent(startKm, totalKm);
  const widthPct = timelineKmPercent(endKm - startKm, totalKm);
  return {
    left: `${leftPct}%`,
    width: `${Math.max(widthPct, 0)}%`,
  };
}

export function timelinePointStyle(km: number, totalKm: number): { left: string } {
  return { left: `${timelineKmPercent(km, totalKm)}%` };
}
