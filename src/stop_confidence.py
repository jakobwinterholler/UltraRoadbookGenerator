"""Stop confidence scoring (mirrors shared/race/stopConfidence.ts)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

MS_PER_DAY = 86_400_000
VERIFICATION_FRESH_DAYS = 30
VERIFICATION_STALE_DAYS = 90


def _verification_age_factor(verified_at: str | None) -> float:
    if not verified_at:
        return 0.0
    try:
        parsed = datetime.fromisoformat(verified_at.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        age_ms = (datetime.now(timezone.utc) - parsed).total_seconds() * 1000
    except ValueError:
        return 0.5
    if age_ms < 0:
        return 0.5
    age_days = age_ms / MS_PER_DAY
    if age_days <= VERIFICATION_FRESH_DAYS:
        return 1.0
    if age_days >= VERIFICATION_STALE_DAYS:
        return 0.35
    span = VERIFICATION_STALE_DAYS - VERIFICATION_FRESH_DAYS
    progress = (age_days - VERIFICATION_FRESH_DAYS) / span
    return 1 - progress * 0.65


def _poi_data_score(
    *,
    poi_score: float | None,
    opening_hours: str | None,
    website: str | None,
    phone: str | None,
) -> float:
    score = 0.0
    if poi_score is not None:
        score += min(35.0, (float(poi_score) / 100.0) * 35.0)
    if opening_hours and opening_hours.strip():
        score += 12.0
    if website and website.strip():
        score += 8.0
    if phone and phone.strip():
        score += 5.0
    return score


def compute_stop_confidence(
    *,
    verification_status: str,
    verified_at: str | None = None,
    poi_score: float | None = None,
    opening_hours: str | None = None,
    website: str | None = None,
    phone: str | None = None,
) -> dict[str, Any]:
    score = _poi_data_score(
        poi_score=poi_score,
        opening_hours=opening_hours,
        website=website,
        phone=phone,
    )
    if verification_status == "verified":
        score += 30.0 * _verification_age_factor(verified_at)
    elif verification_status == "needs_review":
        score += 10.0
    elif verification_status == "pending":
        score += 8.0
    elif verification_status == "deferred":
        score += 5.0

    score = round(min(100.0, max(0.0, score)))
    if verification_status in ("needs_review", "rejected"):
        level = "needs_review"
    elif score >= 70:
        level = "high"
    elif score >= 40:
        level = "needs_review"
    else:
        level = "low"

    labels = {
        "high": "High confidence",
        "needs_review": "Needs review",
        "low": "Low confidence",
    }
    return {"score": int(score), "level": level, "label": labels[level]}


def is_high_confidence_stop(
    *,
    verification_status: str,
    verified_at: str | None = None,
    poi_score: float | None = None,
    opening_hours: str | None = None,
    website: str | None = None,
    phone: str | None = None,
) -> bool:
    result = compute_stop_confidence(
        verification_status=verification_status,
        verified_at=verified_at,
        poi_score=poi_score,
        opening_hours=opening_hours,
        website=website,
        phone=phone,
    )
    return result["level"] == "high"
