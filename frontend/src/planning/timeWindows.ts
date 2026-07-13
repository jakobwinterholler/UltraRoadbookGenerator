/** Three-hour arrival windows used for time-of-day planning. */

export type TimeWindowId =
  | "09_12"
  | "12_15"
  | "15_18"
  | "18_21"
  | "21_00"
  | "00_03"
  | "03_06"
  | "06_09";

export interface TimeWindow {
  id: TimeWindowId;
  label: string;
  startMinutes: number;
  endMinutes: number;
}

export const TIME_WINDOWS: TimeWindow[] = [
  { id: "06_09", label: "06:00–09:00", startMinutes: 360, endMinutes: 540 },
  { id: "09_12", label: "09:00–12:00", startMinutes: 540, endMinutes: 720 },
  { id: "12_15", label: "12:00–15:00", startMinutes: 720, endMinutes: 900 },
  { id: "15_18", label: "15:00–18:00", startMinutes: 900, endMinutes: 1080 },
  { id: "18_21", label: "18:00–21:00", startMinutes: 1080, endMinutes: 1260 },
  { id: "21_00", label: "21:00–00:00", startMinutes: 1260, endMinutes: 1440 },
  { id: "00_03", label: "00:00–03:00", startMinutes: 0, endMinutes: 180 },
  { id: "03_06", label: "03:00–06:00", startMinutes: 180, endMinutes: 360 },
];

export function timeWindowById(id: TimeWindowId): TimeWindow {
  const match = TIME_WINDOWS.find((window) => window.id === id);
  if (!match) {
    throw new Error(`Unknown time window: ${id}`);
  }
  return match;
}

export function windowMidpoint(window: TimeWindow): number {
  if (window.endMinutes > window.startMinutes) {
    return Math.floor((window.startMinutes + window.endMinutes) / 2);
  }
  return Math.floor((window.startMinutes + window.endMinutes + 1440) / 2) % 1440;
}

/**
 * Reserved for future stage planning: estimate arrival at each km from start time,
 * moving speed, stop time, and sleep blocks.
 */
export interface FutureArrivalPlanning {
  startTimeIso: string | null;
  averageMovingSpeedKmh: number | null;
  averageStoppedMinutes: number | null;
  plannedSleepBlocks: { startKm: number; durationHours: number }[];
}

export const EMPTY_ARRIVAL_PLANNING: FutureArrivalPlanning = {
  startTimeIso: null,
  averageMovingSpeedKmh: null,
  averageStoppedMinutes: null,
  plannedSleepBlocks: [],
};
