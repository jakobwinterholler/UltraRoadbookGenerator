import { useCallback, useEffect, useRef, useState } from "react";
import { computeStopConfidence, stopConfidenceBadgeClass } from "@shared/race/stopConfidence";
import { formatStopDistanceM } from "@shared/race/sortVerificationQueue";
import { haversineM } from "@shared/race/mapMatching";
import type { CompanionStop } from "../types";
import { formatKm, googleMapsUrl, googleStreetViewUrl } from "../lib/utils";
import { serviceLabels, stopStatusLabel } from "../lib/raceExecution";
import { normalizeWebsite } from "@shared/race/streetViewUrl";

export type VerificationQuickAction = "verified" | "closed" | "wrong_location" | "needs_review";

type ExitDirection = "left" | "right" | "up";

interface VerificationSwipeStackProps {
  stops: CompanionStop[];
  totalKm: number;
  gpsLat: number | null;
  gpsLon: number | null;
  routeCoordinates?: [number, number][];
  onAction: (stop: CompanionStop, action: VerificationQuickAction) => void;
}

const SWIPE_THRESHOLD = 90;
const MAX_ROTATION = 10;
const EXIT_MS = 280;

const QUICK_ACTIONS: {
  action: VerificationQuickAction;
  label: string;
  exit: ExitDirection;
  className: string;
}[] = [
  { action: "verified", label: "✓ Verified", exit: "right", className: "verification-chip--verified" },
  { action: "closed", label: "✗ Closed", exit: "left", className: "verification-chip--closed" },
  {
    action: "wrong_location",
    label: "📍 Wrong location",
    exit: "left",
    className: "verification-chip--wrong",
  },
  {
    action: "needs_review",
    label: "❓ Needs review",
    exit: "left",
    className: "verification-chip--review",
  },
];

function stopDistanceLabel(
  stop: CompanionStop,
  gpsLat: number | null,
  gpsLon: number | null,
): string | null {
  if (gpsLat == null || gpsLon == null) {
    return null;
  }
  return formatStopDistanceM(haversineM(gpsLat, gpsLon, stop.lat, stop.lon));
}

function formatVerifiedDate(value: string | null | undefined): string {
  if (!value) {
    return "Never verified";
  }
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function exitTransform(direction: ExitDirection): string {
  if (direction === "right") {
    return `translate3d(${window.innerWidth * 1.2}px, -24px, 0) rotate(12deg)`;
  }
  if (direction === "up") {
    return "translate3d(0, -120%, 0) rotate(-4deg)";
  }
  return `translate3d(${-window.innerWidth * 1.2}px, -24px, 0) rotate(-12deg)`;
}

function SwipeCard({
  stop,
  totalKm,
  gpsLat,
  gpsLon,
  routeCoordinates,
  style,
  isTop,
  onAction,
}: {
  stop: CompanionStop;
  totalKm: number;
  gpsLat: number | null;
  gpsLon: number | null;
  routeCoordinates?: [number, number][];
  style: React.CSSProperties;
  isTop: boolean;
  onAction: (action: VerificationQuickAction) => void;
}) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const startRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const offsetRef = useRef(0);
  const [offset, setOffset] = useState(0);
  const [exiting, setExiting] = useState<ExitDirection | null>(null);

  const streetViewOptions = {
    routeCoordinates,
    totalDistanceKm: totalKm,
  };

  const applyOffset = useCallback((value: number) => {
    offsetRef.current = value;
    setOffset(value);
  }, []);

  const finishExit = useCallback(
    (direction: ExitDirection, action: VerificationQuickAction) => {
      setExiting(direction);
      window.setTimeout(() => onAction(action), EXIT_MS);
    },
    [onAction],
  );

  const finishSwipe = useCallback(
    (direction: "left" | "right") => {
      const action = direction === "right" ? "verified" : "needs_review";
      setExiting(direction);
      const exitX = direction === "right" ? window.innerWidth * 1.2 : -window.innerWidth * 1.2;
      applyOffset(exitX);
      window.setTimeout(() => onAction(action), EXIT_MS);
    },
    [applyOffset, onAction],
  );

  function onPointerDown(event: React.PointerEvent) {
    if (!isTop || exiting) {
      return;
    }
    const target = event.target as HTMLElement;
    if (target.closest("a, button, summary, details")) {
      return;
    }
    startRef.current = { x: event.clientX, y: event.clientY, time: Date.now() };
    cardRef.current?.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent) {
    if (!isTop || !startRef.current || exiting) {
      return;
    }
    applyOffset(event.clientX - startRef.current.x);
  }

  function onPointerUp(event: React.PointerEvent) {
    if (!isTop || !startRef.current || exiting) {
      return;
    }
    const delta = event.clientX - startRef.current.x;
    const elapsed = Date.now() - startRef.current.time;
    startRef.current = null;

    if (Math.abs(delta) >= SWIPE_THRESHOLD) {
      finishSwipe(delta > 0 ? "right" : "left");
    } else {
      applyOffset(0);
    }

    try {
      cardRef.current?.releasePointerCapture(event.pointerId);
    } catch {
      // ignore
    }

    void elapsed;
  }

  const rotation = Math.max(-MAX_ROTATION, Math.min(MAX_ROTATION, offset / 24));
  const verifyOpacity = Math.min(1, Math.max(0, offset / SWIPE_THRESHOLD));
  const rejectOpacity = Math.min(1, Math.max(0, -offset / SWIPE_THRESHOLD));
  const confidence = computeStopConfidence({
    verificationStatus: stop.verificationStatus,
    verifiedAt: stop.verificationDate,
    poiScore: stop.confidenceScore,
    openingHours: stop.openingHours,
    website: stop.website,
    phone: stop.phone,
  });
  const distanceLabel = stopDistanceLabel(stop, gpsLat, gpsLon);
  const streetViewHref = googleStreetViewUrl(stop, streetViewOptions);
  const mapsHref = googleMapsUrl(stop.lat, stop.lon, stop.placeId);

  const transform = exiting
    ? exitTransform(exiting)
    : `translate3d(${offset}px, 0, 0) rotate(${rotation}deg)`;

  return (
    <div
      ref={cardRef}
      className={`verification-swipe-card ${isTop ? "verification-swipe-card--top" : "verification-swipe-card--behind"}`}
      style={{
        zIndex: style.zIndex,
        transform,
        opacity: exiting ? 0 : 1,
        transition:
          exiting || offset === 0
            ? `transform ${EXIT_MS}ms cubic-bezier(0.22, 1, 0.36, 1), opacity ${EXIT_MS}ms ease`
            : "none",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="verification-swipe-card__stamp verification-swipe-card__stamp--verify"
        style={{ opacity: verifyOpacity }}
      >
        Verified
      </div>
      <div
        className="verification-swipe-card__stamp verification-swipe-card__stamp--reject"
        style={{ opacity: rejectOpacity }}
      >
        Needs review
      </div>

      <div className="verification-swipe-card__photo" aria-hidden>
        <span className="verification-swipe-card__photo-icon">{stop.icon}</span>
        <span className="verification-swipe-card__photo-label">Storefront photo</span>
      </div>

      <div className="verification-swipe-card__body">
        <div className="verification-swipe-card__title-block">
          <h3 className="verification-swipe-card__name">{stop.name}</h3>
          <p className="verification-swipe-card__category">{stop.categoryLabel}</p>
          {distanceLabel ? (
            <span className="verification-swipe-card__distance">{distanceLabel}</span>
          ) : null}
        </div>

        <a
          href={streetViewHref}
          target="_blank"
          rel="noreferrer"
          className="verification-street-view-btn"
          onClick={(event) => event.stopPropagation()}
        >
          👁 Open Street View
        </a>

        <div className="verification-action-chips">
          {QUICK_ACTIONS.map((chip) => (
            <button
              key={chip.action}
              type="button"
              className={`verification-chip ${chip.className}`}
              onClick={(event) => {
                event.stopPropagation();
                finishExit(chip.exit, chip.action);
              }}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="verification-secondary-links">
          <a
            href={mapsHref}
            target="_blank"
            rel="noreferrer"
            className="verification-secondary-link"
            onClick={(event) => event.stopPropagation()}
          >
            Google Maps
          </a>
          {stop.website ? (
            <a
              href={normalizeWebsite(stop.website)}
              target="_blank"
              rel="noreferrer"
              className="verification-secondary-link"
              onClick={(event) => event.stopPropagation()}
            >
              Website
            </a>
          ) : null}
          {stop.phone ? (
            <a
              href={`tel:${stop.phone}`}
              className="verification-secondary-link"
              onClick={(event) => event.stopPropagation()}
            >
              Call
            </a>
          ) : null}
        </div>

        <dl className="verification-card-stats">
          <div>
            <dt>Route km</dt>
            <dd>{formatKm(stop.km)}</dd>
          </div>
          <div>
            <dt>Remaining</dt>
            <dd>{formatKm(Math.max(0, totalKm - stop.km))}</dd>
          </div>
          <div>
            <dt>Confidence</dt>
            <dd>
              <span
                className={`verification-card-stats__badge ${stopConfidenceBadgeClass(confidence.level, true)}`}
              >
                {confidence.label}
              </span>
            </dd>
          </div>
          <div>
            <dt>Last verified</dt>
            <dd>{formatVerifiedDate(stop.verificationDate)}</dd>
          </div>
        </dl>

        <details className="verification-card-details">
          <summary>Details</summary>
          <dl className="verification-card-details__list">
            <div>
              <dt>Hours</dt>
              <dd>{stop.openingHours ?? "Unknown"}</dd>
            </div>
            <div>
              <dt>Services</dt>
              <dd>{serviceLabels(stop)}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{stopStatusLabel(stop.verificationStatus)}</dd>
            </div>
            {stop.notes ? (
              <div className="verification-card-details__full">
                <dt>Notes</dt>
                <dd>{stop.notes}</dd>
              </div>
            ) : null}
          </dl>
        </details>
      </div>
    </div>
  );
}

export default function VerificationSwipeStack({
  stops,
  totalKm,
  gpsLat,
  gpsLon,
  routeCoordinates,
  onAction,
}: VerificationSwipeStackProps) {
  const [index, setIndex] = useState(0);
  const current = stops[index] ?? null;
  const next = stops[index + 1] ?? null;

  useEffect(() => {
    setIndex(0);
  }, [stops]);

  const handleAction = useCallback(
    (action: VerificationQuickAction) => {
      if (!current) {
        return;
      }
      onAction(current, action);
      setIndex((value) => value + 1);
    },
    [current, onAction],
  );

  if (!current) {
    return (
      <div className="verification-swipe-stack verification-swipe-stack--empty">
        <p className="text-lg font-medium text-white">All caught up!</p>
        <p className="mt-1 max-w-xs text-sm text-white/50">
          No stops need verification right now. Check back as you ride or open Desktop to review
          pending submissions.
        </p>
      </div>
    );
  }

  return (
    <div className="verification-swipe-stack">
      <div className="verification-swipe-stack__header">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/45">
          {index + 1} of {stops.length}
        </p>
        <p className="text-xs text-white/35">Tap a chip · swipe optional</p>
      </div>

      <div className="verification-swipe-stack__deck">
        {next ? (
          <SwipeCard
            key={next.zoneId}
            stop={next}
            totalKm={totalKm}
            gpsLat={gpsLat}
            gpsLon={gpsLon}
            routeCoordinates={routeCoordinates}
            isTop={false}
            style={{ zIndex: 1 }}
            onAction={() => {}}
          />
        ) : null}
        <SwipeCard
          key={current.zoneId}
          stop={current}
          totalKm={totalKm}
          gpsLat={gpsLat}
          gpsLon={gpsLon}
          routeCoordinates={routeCoordinates}
          isTop
          style={{ zIndex: 2 }}
          onAction={handleAction}
        />
      </div>
    </div>
  );
}
