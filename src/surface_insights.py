"""Rider-facing surface section insights."""

from __future__ import annotations

from dataclasses import dataclass

from route_visualization import RouteVisualization, SurfaceSegmentRow


@dataclass(frozen=True)
class SurfaceSectionInsight:
    id: str
    label: str
    length_km: float
    start_km: float
    end_km: float
    category: str
    subcategory: str | None


def _merge_category_spans(
    segments: list[SurfaceSegmentRow],
    *,
    category_key,
) -> list[tuple[str, float, float, str | None]]:
    """Merge consecutive segments that share the same category key along the route."""
    if not segments:
        return []

    ordered = sorted(segments, key=lambda segment: segment.start_km)
    merged: list[tuple[str, float, float, str | None]] = []

    for segment in ordered:
        key = category_key(segment)
        if (
            merged
            and merged[-1][0] == key
            and segment.start_km <= merged[-1][2] + 0.05
        ):
            prev_key, start_km, end_km, subcategory = merged[-1]
            merged[-1] = (prev_key, start_km, max(end_km, segment.end_km), subcategory)
            continue
        merged.append((key, segment.start_km, segment.end_km, segment.rider_subcategory))

    return merged


def _longest_span(
    spans: list[tuple[str, float, float, str | None]],
    key: str,
) -> SurfaceSectionInsight | None:
    best: tuple[str, float, float, str | None] | None = None
    best_length = 0.0

    for span in spans:
        if span[0] != key:
            continue
        length = span[2] - span[1]
        if length <= best_length:
            continue
        best = span
        best_length = length

    if best is None:
        return None

    return SurfaceSectionInsight(
        id="",
        label="",
        length_km=round(best_length, 1),
        start_km=round(best[1], 1),
        end_km=round(best[2], 1),
        category=best[0] if best[0] in {"Road", "Gravel", "Trail", "Unknown"} else "Gravel",
        subcategory=best[3],
    )


def _min_insight_km(total_km: float, *, ratio: float, floor_km: float) -> float:
    """Scale insight thresholds with route length; keep short routes informative."""
    return max(floor_km, total_km * ratio)


def build_surface_insights(route: RouteVisualization) -> list[SurfaceSectionInsight]:
    """Return strategy-relevant surface sections ordered by importance."""
    segments = route.surface_segments
    total_km = max((segment.end_km for segment in segments), default=0.0)
    category_spans = _merge_category_spans(segments, category_key=lambda s: s.rider_category)
    gravel_min = _min_insight_km(total_km, ratio=0.003, floor_km=0.4)
    unknown_min = _min_insight_km(total_km, ratio=0.002, floor_km=0.3)
    rough_min = _min_insight_km(total_km, ratio=0.003, floor_km=0.4)
    trail_min = _min_insight_km(total_km, ratio=0.002, floor_km=0.3)
    rough_segments = [
        segment
        for segment in segments
        if segment.rider_subcategory in {"Rough asphalt", "Loose gravel", "Forest road"}
    ]
    rough_spans = _merge_category_spans(
        rough_segments,
        category_key=lambda segment: segment.rider_subcategory,
    )
    rough = None
    rough_length = 0.0
    for subcategory, start_km, end_km, _ in rough_spans:
        length = end_km - start_km
        if length > rough_length:
            rough_length = length
            rough = SurfaceSectionInsight(
                id="longest-rough",
                label="Longest rough section",
                length_km=round(length, 1),
                start_km=round(start_km, 1),
                end_km=round(end_km, 1),
                category="Road" if subcategory == "Rough asphalt" else "Gravel",
                subcategory=subcategory,
            )
    insights: list[SurfaceSectionInsight] = []

    gravel = _longest_span(category_spans, "Gravel")
    if gravel and gravel.length_km >= gravel_min:
        insights.append(
            SurfaceSectionInsight(
                id="longest-gravel",
                label="Longest gravel section",
                length_km=gravel.length_km,
                start_km=gravel.start_km,
                end_km=gravel.end_km,
                category="Gravel",
                subcategory=gravel.subcategory,
            )
        )

    unknown = _longest_span(category_spans, "Unknown")
    if unknown and unknown.length_km >= unknown_min:
        insights.append(
            SurfaceSectionInsight(
                id="longest-unknown",
                label="Longest unknown section",
                length_km=unknown.length_km,
                start_km=unknown.start_km,
                end_km=unknown.end_km,
                category="Unknown",
                subcategory=unknown.subcategory,
            )
        )

    if rough and rough.length_km >= rough_min:
        insights.append(rough)

    trail = _longest_span(category_spans, "Trail")
    if trail and trail.length_km >= trail_min:
        insights.append(
            SurfaceSectionInsight(
                id="longest-trail",
                label="Longest trail section",
                length_km=trail.length_km,
                start_km=trail.start_km,
                end_km=trail.end_km,
                category=trail.category,
                subcategory=trail.subcategory,
            )
        )

    return insights
