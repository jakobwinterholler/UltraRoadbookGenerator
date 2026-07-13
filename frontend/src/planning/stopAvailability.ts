import type { PoiRow, ResupplyZone, ZonePoiOption } from "../api";
import type { TimeMode } from "./types";
import { evaluateOpeningHours } from "./openingHours";
import type { TimeWindow, TimeWindowId } from "./timeWindows";
import { timeWindowById } from "./timeWindows";

export type AvailabilityStatus = "open" | "likely_open" | "closed" | "unknown";

export interface StopAvailability {
  status: AvailabilityStatus;
  label: string;
}

export type StopLike = {
  poi_category?: string;
  category?: string;
  opening_hours: string | null;
  night_usability: string;
};

function categoryOf(stop: StopLike): string {
  return stop.poi_category ?? stop.category ?? "";
}

function heuristicAvailability(
  stop: StopLike,
  window: TimeWindow,
  timeMode: TimeMode,
): StopAvailability {
  const category = categoryOf(stop);
  const midpoint =
    window.endMinutes > window.startMinutes
      ? (window.startMinutes + window.endMinutes) / 2
      : ((window.startMinutes + window.endMinutes + 1440) / 2) % 1440;
  const isNightWindow = midpoint >= 1260 || midpoint < 360;

  if (category === "Gas station" || category === "Drinking water") {
    return { status: "likely_open", label: "Usually available" };
  }

  if (timeMode === "night" || isNightWindow) {
    if (stop.night_usability === "usually_available") {
      return { status: "likely_open", label: "Usually available at night" };
    }
    if (stop.night_usability === "depends_on_hours") {
      return { status: "unknown", label: "Check opening hours" };
    }
    if (stop.night_usability === "usually_closed") {
      return { status: "closed", label: "Usually closed at night" };
    }
  }

  if (category === "Bakery") {
    if (window.id === "06_09" || window.id === "09_12") {
      return { status: "likely_open", label: "Typical bakery hours" };
    }
    return { status: "closed", label: "Usually closed outside morning" };
  }

  if (category === "Supermarket" || category === "Small supermarket" || category === "Mini supermarket") {
    if (["06_09", "09_12", "12_15", "15_18", "18_21"].includes(window.id)) {
      return { status: "likely_open", label: "Typical shop hours" };
    }
    return { status: "unknown", label: "Hours unknown" };
  }

  if (category === "Café" || category === "Restaurant" || category === "Fast food") {
    if (["12_15", "15_18", "18_21"].includes(window.id)) {
      return { status: "likely_open", label: "Typical dining hours" };
    }
    if (window.id === "09_12") {
      return { status: "unknown", label: "May serve breakfast" };
    }
    return { status: "closed", label: "Usually closed outside meal times" };
  }

  return { status: "unknown", label: "Hours unknown" };
}

export function getStopAvailability(
  stop: StopLike,
  timeWindowId: TimeWindowId | null,
  timeMode: TimeMode,
): StopAvailability | null {
  if (!timeWindowId) {
    return null;
  }

  const window = timeWindowById(timeWindowId);
  const parsed = evaluateOpeningHours(stop.opening_hours, window);

  if (parsed === "open") {
    return { status: "open", label: "Open during this window" };
  }
  if (parsed === "closed") {
    return { status: "closed", label: "Closed during this window" };
  }

  return heuristicAvailability(stop, window, timeMode);
}

export function isStopAvailable(
  stop: StopLike,
  timeWindowId: TimeWindowId | null,
  timeMode: TimeMode,
): boolean {
  const availability = getStopAvailability(stop, timeWindowId, timeMode);
  if (!availability) {
    return true;
  }
  return availability.status === "open" || availability.status === "likely_open";
}

function zoneRelevantStops(zone: ResupplyZone): ZonePoiOption[] {
  return zone.categories
    .filter((group) => group.key !== "dining")
    .flatMap((group) => [group.primary, ...group.alternatives])
    .filter((option): option is ZonePoiOption => option !== null);
}

export function zoneAvailability(
  zone: ResupplyZone,
  timeWindowId: TimeWindowId | null,
  timeMode: TimeMode,
): StopAvailability | null {
  if (!timeWindowId) {
    return null;
  }

  const relevantStops = zoneRelevantStops(zone);
  if (relevantStops.length === 0) {
    return { status: "unknown", label: "No resupply options listed" };
  }

  const ranked = relevantStops
    .map((stop) => getStopAvailability(stop, timeWindowId, timeMode))
    .filter((value): value is StopAvailability => value !== null);

  if (ranked.some((item) => item.status === "open")) {
    return { status: "open", label: "Open during this window" };
  }
  if (ranked.some((item) => item.status === "likely_open")) {
    return { status: "likely_open", label: "Likely available" };
  }
  if (ranked.every((item) => item.status === "closed")) {
    return { status: "closed", label: "Closed during this window" };
  }
  return { status: "unknown", label: "Availability uncertain" };
}

export function poiRowAvailability(
  poi: PoiRow,
  timeWindowId: TimeWindowId | null,
  timeMode: TimeMode,
): StopAvailability | null {
  return getStopAvailability(
    {
      category: poi.category,
      opening_hours: poi.opening_hours,
      night_usability: poi.night_usability,
    },
    timeWindowId,
    timeMode,
  );
}

export function availabilityClass(status: AvailabilityStatus): string {
  switch (status) {
    case "open":
      return "bg-emerald-50 text-emerald-800 ring-emerald-200";
    case "likely_open":
      return "bg-sky-50 text-sky-800 ring-sky-200";
    case "closed":
      return "bg-red-50 text-red-800 ring-red-200";
    case "unknown":
      return "bg-amber-50 text-amber-800 ring-amber-200";
  }
}
