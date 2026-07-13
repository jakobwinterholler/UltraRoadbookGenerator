import type { TimeWindow } from "./timeWindows";
import { windowMidpoint } from "./timeWindows";

const DAY_INDEX: Record<string, number> = {
  mo: 0,
  tu: 1,
  we: 2,
  th: 3,
  fr: 4,
  sa: 5,
  su: 6,
};

interface OpeningRule {
  days: Set<number>;
  startMinutes: number;
  endMinutes: number;
}

function parseTime(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 24 || minutes > 59) {
    return null;
  }
  if (hours === 24) {
    return 24 * 60;
  }
  return hours * 60 + minutes;
}

function expandDays(token: string): Set<number> {
  const normalized = token.trim().toLowerCase();
  if (normalized in DAY_INDEX) {
    return new Set([DAY_INDEX[normalized]]);
  }
  if (normalized.includes("-")) {
    const [start, end] = normalized.split("-", 2);
    if (start in DAY_INDEX && end in DAY_INDEX) {
      const startIdx = DAY_INDEX[start];
      const endIdx = DAY_INDEX[end];
      const days = new Set<number>();
      if (startIdx <= endIdx) {
        for (let day = startIdx; day <= endIdx; day += 1) {
          days.add(day);
        }
      } else {
        for (let day = startIdx; day < 7; day += 1) {
          days.add(day);
        }
        for (let day = 0; day <= endIdx; day += 1) {
          days.add(day);
        }
      }
      return days;
    }
  }
  return new Set();
}

function parseDayTokens(part: string): Set<number> {
  const days = new Set<number>();
  for (const token of part.split(",")) {
    for (const day of expandDays(token)) {
      days.add(day);
    }
  }
  return days;
}

export function parseOpeningHours(openingHours: string | null | undefined): OpeningRule[] {
  if (!openingHours?.trim()) {
    return [];
  }

  const normalized = openingHours.trim().toLowerCase();
  if (normalized.includes("24/7") || normalized.startsWith("24")) {
    return [{ days: new Set([0, 1, 2, 3, 4, 5, 6]), startMinutes: 0, endMinutes: 24 * 60 }];
  }

  const rules: OpeningRule[] = [];
  for (const chunk of openingHours.split(";")) {
    const trimmed = chunk.trim();
    if (!trimmed) {
      continue;
    }
    const lower = trimmed.toLowerCase();
    if (lower === "off" || lower === "closed") {
      continue;
    }

    let dayPart = trimmed;
    let timePart = "";
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2 && parts[parts.length - 1].includes("-")) {
      timePart = parts[parts.length - 1];
      dayPart = parts.slice(0, -1).join(" ");
    }

    if (!timePart.includes("-")) {
      continue;
    }

    const [startRaw, endRaw] = timePart.split("-", 2);
    const startMinutes = parseTime(startRaw);
    const endMinutes = parseTime(endRaw);
    if (startMinutes === null || endMinutes === null) {
      continue;
    }

    const days = parseDayTokens(dayPart);
    if (days.size === 0) {
      for (let day = 0; day < 7; day += 1) {
        days.add(day);
      }
    }

    rules.push({ days, startMinutes, endMinutes });
  }

  return rules;
}

function openAtMinute(rules: OpeningRule[], day: number, minute: number): boolean {
  for (const rule of rules) {
    if (!rule.days.has(day)) {
      continue;
    }
    if (rule.endMinutes > rule.startMinutes) {
      if (minute >= rule.startMinutes && minute < rule.endMinutes) {
        return true;
      }
    } else if (rule.endMinutes < rule.startMinutes) {
      if (minute >= rule.startMinutes || minute < rule.endMinutes) {
        return true;
      }
    }
  }
  return false;
}

export function evaluateOpeningHours(
  openingHours: string | null | undefined,
  window: TimeWindow,
): "open" | "closed" | "unknown" {
  const rules = parseOpeningHours(openingHours);
  if (rules.length === 0) {
    return "unknown";
  }

  const minute = windowMidpoint(window);
  for (let day = 0; day < 7; day += 1) {
    if (openAtMinute(rules, day, minute)) {
      return "open";
    }
  }

  return "closed";
}
