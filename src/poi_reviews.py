"""Placeholder for third-party review data (not sourced from OSM)."""

from dataclasses import dataclass


@dataclass(frozen=True)
class PoiReviews:
    """
    Reserved for licensed review providers (e.g. Google Places API).

    Do not scrape Google. Populate via an official API integration later.
    """

    source: str | None
    rating: float | None
    review_count: int | None


def empty_reviews() -> PoiReviews:
    return PoiReviews(source=None, rating=None, review_count=None)
