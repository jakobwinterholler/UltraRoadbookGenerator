import type { PrioritizedStop } from "./priority";
import type { VerifiedStopRecord } from "./types";
import { verifiedStopKey } from "./types";

export interface VerifiedNeighbor {
  name: string;
  gapKm: number;
}

export interface VerifiedStopContext {
  previous: VerifiedNeighbor | null;
  next: VerifiedNeighbor | null;
}

export function verifiedStopContext(
  route: PrioritizedStop[],
  verifiedStops: Record<string, VerifiedStopRecord>,
  currentIndex: number,
): VerifiedStopContext {
  const current = route[currentIndex];
  if (!current) {
    return { previous: null, next: null };
  }
  const currentKm = current.zone.distance_along_km;

  let previous: VerifiedNeighbor | null = null;
  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    const item = route[index];
    const record = verifiedStops[verifiedStopKey(item.zone.zone_id)];
    if (record?.status === "verified") {
      previous = {
        name: item.zone.name,
        gapKm: Math.round(currentKm - item.zone.distance_along_km),
      };
      break;
    }
  }

  let next: VerifiedNeighbor | null = null;
  for (let index = currentIndex + 1; index < route.length; index += 1) {
    const item = route[index];
    const record = verifiedStops[verifiedStopKey(item.zone.zone_id)];
    if (record?.status === "verified") {
      next = {
        name: item.zone.name,
        gapKm: Math.round(item.zone.distance_along_km - currentKm),
      };
      break;
    }
  }

  return { previous, next };
}
