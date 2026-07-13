import type { ClimbRow } from "../api";
import { climbDisplayName } from "../planning/climbLabels";

export interface ClimbChartLayout {
  climb: ClimbRow;
  index: number;
  x1: number;
  x2: number;
  centerX: number;
  segmentWidth: number;
  name: string;
  showLabel: boolean;
}

const MIN_SEGMENT_WIDTH_FOR_LABEL = 52;
const LABEL_CHAR_WIDTH = 5.5;
const LABEL_PREFIX_WIDTH = 12;
const LABEL_GAP = 8;

function estimateLabelWidth(name: string): number {
  return name.length * LABEL_CHAR_WIDTH + LABEL_PREFIX_WIDTH;
}

function truncateName(name: string, maxWidth: number): string {
  const maxChars = Math.max(4, Math.floor((maxWidth - LABEL_PREFIX_WIDTH) / LABEL_CHAR_WIDTH));
  if (name.length <= maxChars) {
    return name;
  }
  return `${name.slice(0, Math.max(1, maxChars - 1))}…`;
}

function rangesOverlap(
  leftA: number,
  rightA: number,
  leftB: number,
  rightB: number,
  gap: number,
): boolean {
  return !(rightA + gap < leftB || leftA - gap > rightB);
}

export function climbAtKm(climbs: ClimbRow[], km: number): ClimbRow | null {
  return climbs.find((climb) => km >= climb.start_km && km <= climb.end_km) ?? null;
}

export function layoutClimbLabels(
  climbs: ClimbRow[],
  xForKm: (km: number) => number,
  selectedClimbId: string | null,
  hoveredClimbId: string | null,
): ClimbChartLayout[] {
  const layouts: ClimbChartLayout[] = climbs.map((climb, index) => {
    const x1 = xForKm(climb.start_km);
    const x2 = xForKm(climb.end_km);
    const segmentWidth = Math.abs(x2 - x1);
    return {
      climb,
      index,
      x1,
      x2,
      centerX: (x1 + x2) / 2,
      segmentWidth,
      name: truncateName(climbDisplayName(climb, index), segmentWidth),
      showLabel: false,
    };
  });

  const forcedIds = new Set<string>();
  if (selectedClimbId) {
    forcedIds.add(selectedClimbId);
  }
  if (hoveredClimbId) {
    forcedIds.add(hoveredClimbId);
  }

  const placed: { left: number; right: number }[] = [];

  function tryPlace(layout: ClimbChartLayout, force: boolean): void {
    const labelWidth = estimateLabelWidth(layout.name);
    const left = layout.centerX - labelWidth / 2;
    const right = layout.centerX + labelWidth / 2;

    if (!force) {
      if (layout.segmentWidth < MIN_SEGMENT_WIDTH_FOR_LABEL) {
        return;
      }
      const overlaps = placed.some((rect) =>
        rangesOverlap(left, right, rect.left, rect.right, LABEL_GAP),
      );
      if (overlaps) {
        return;
      }
    }

    layout.showLabel = true;
    placed.push({ left, right });
  }

  for (const layout of layouts
    .filter((item) => forcedIds.has(item.climb.id))
    .sort((left, right) => right.segmentWidth - left.segmentWidth)) {
    tryPlace(layout, true);
  }

  for (const layout of layouts
    .filter((item) => !item.showLabel)
    .sort((left, right) => right.segmentWidth - left.segmentWidth)) {
    tryPlace(layout, false);
  }

  return layouts;
}
