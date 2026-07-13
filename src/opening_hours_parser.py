"""Lightweight OSM opening_hours evaluation for typical time-of-day windows."""

from __future__ import annotations

import re
from dataclasses import dataclass

DAY_INDEX = {"mo": 0, "tu": 1, "we": 2, "th": 3, "fr": 4, "sa": 5, "su": 6}


@dataclass(frozen=True)
class TimeWindow:
    window_id: str
    start_minutes: int
    end_minutes: int


def _parse_time(value: str) -> int | None:
    match = re.fullmatch(r"(\d{1,2}):(\d{2})", value.strip())
    if not match:
        return None
    hours = int(match.group(1))
    minutes = int(match.group(2))
    if hours > 24 or minutes > 59:
        return None
    if hours == 24:
        return 24 * 60
    return hours * 60 + minutes


def _expand_days(token: str) -> set[int]:
    token = token.strip().lower()
    if token in DAY_INDEX:
        return {DAY_INDEX[token]}
    if "-" in token:
        start, end = token.split("-", 1)
        if start in DAY_INDEX and end in DAY_INDEX:
            start_idx = DAY_INDEX[start]
            end_idx = DAY_INDEX[end]
            if start_idx <= end_idx:
                return set(range(start_idx, end_idx + 1))
            return set(range(start_idx, 7)) | set(range(0, end_idx + 1))
    return set()


def _parse_day_tokens(part: str) -> set[int]:
    days: set[int] = set()
    for token in part.split(","):
        token = token.strip().lower()
        if not token:
            continue
        days.update(_expand_days(token))
    return days


@dataclass(frozen=True)
class OpeningRule:
    days: frozenset[int]
    start_minutes: int
    end_minutes: int


def parse_opening_hours(opening_hours: str | None) -> list[OpeningRule]:
    if not opening_hours:
        return []

    normalized = opening_hours.strip().lower()
    if not normalized:
        return []

    if "24/7" in normalized or normalized.startswith("24"):
        return [OpeningRule(frozenset(range(7)), 0, 24 * 60)]

    rules: list[OpeningRule] = []
    for chunk in opening_hours.split(";"):
        chunk = chunk.strip()
        if not chunk:
            continue
        lower = chunk.lower()
        if lower in {"off", "closed"}:
            continue

        day_part = chunk
        time_part = ""
        if " " in chunk:
            day_part, time_part = chunk.rsplit(" ", 1)
            if "-" not in time_part and " " in day_part:
                parts = chunk.split()
                if len(parts) >= 2 and "-" in parts[-1]:
                    day_part = " ".join(parts[:-1])
                    time_part = parts[-1]

        if not time_part or "-" not in time_part:
            continue

        start_raw, end_raw = time_part.split("-", 1)
        start_minutes = _parse_time(start_raw)
        end_minutes = _parse_time(end_raw)
        if start_minutes is None or end_minutes is None:
            continue

        days = _parse_day_tokens(day_part)
        if not days:
            days = set(range(7))

        rules.append(OpeningRule(frozenset(days), start_minutes, end_minutes))

    return rules


def _open_at_minute(rules: list[OpeningRule], day: int, minute: int) -> bool:
    for rule in rules:
        if day not in rule.days:
            continue
        if rule.end_minutes > rule.start_minutes:
            if rule.start_minutes <= minute < rule.end_minutes:
                return True
        elif rule.end_minutes < rule.start_minutes:
            if minute >= rule.start_minutes or minute < rule.end_minutes:
                return True
    return False


def window_midpoint(window: TimeWindow) -> int:
    if window.end_minutes > window.start_minutes:
        return (window.start_minutes + window.end_minutes) // 2
    return ((window.start_minutes + window.end_minutes + 24 * 60) // 2) % (24 * 60)


def evaluate_opening_hours(
    opening_hours: str | None,
    window: TimeWindow,
) -> str:
    """
    Return availability status for a typical week: open, closed, or unknown.

    Uses the midpoint of the window and checks whether any weekday rule covers it.
    """
    rules = parse_opening_hours(opening_hours)
    if not rules:
        return "unknown"

    minute = window_midpoint(window)
    for day in range(7):
        if _open_at_minute(rules, day, minute):
            return "open"

    return "closed"
