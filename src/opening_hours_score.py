"""Opening-hours quality scoring for POI reliability."""

from __future__ import annotations

from opening_hours_parser import parse_opening_hours


def opening_hours_reliability_bonus(opening_hours: str | None) -> float:
    """
    Score how useful opening hours are for ultra planning.

    Longer typical hours and 24/7 operation increase reliability.
    """
    if not opening_hours:
        return 0.0

    normalized = opening_hours.strip().lower()
    if not normalized:
        return 0.0

    if "24/7" in normalized or normalized.startswith("24"):
        return 28.0

    rules = parse_opening_hours(opening_hours)
    if not rules:
        return 6.0

    total_open_minutes = 0
    covered_days = set()

    for rule in rules:
        covered_days.update(rule.days)
        if rule.end_minutes > rule.start_minutes:
            total_open_minutes += rule.end_minutes - rule.start_minutes
        else:
            total_open_minutes += (24 * 60 - rule.start_minutes) + rule.end_minutes

    if not covered_days:
        return 6.0

    avg_daily_minutes = total_open_minutes / len(covered_days)

    if avg_daily_minutes >= 16 * 60:
        return 24.0
    if avg_daily_minutes >= 12 * 60:
        return 18.0
    if avg_daily_minutes >= 8 * 60:
        return 12.0
    if avg_daily_minutes >= 4 * 60:
        return 6.0
    return 2.0
