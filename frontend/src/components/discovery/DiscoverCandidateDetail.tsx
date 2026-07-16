import type { DiscoverCandidate } from "@shared/race/discoverStops";
import { formatPoiName, formatOffRouteDistance } from "../poiUi";
import { formatKm } from "../routeInsights";

interface DiscoverCandidateDetailProps {
  candidate: DiscoverCandidate;
  onPromote: () => void;
  onDismiss: () => void;
  promoting?: boolean;
}

export default function DiscoverCandidateDetail({
  candidate,
  onPromote,
  onDismiss,
  promoting = false,
}: DiscoverCandidateDetailProps) {
  const title = formatPoiName(candidate.name, candidate.brand ?? null, {
    poiCategory: candidate.category,
  });

  return (
    <div className="pointer-events-auto absolute bottom-20 left-4 right-4 z-[1000] max-w-md animate-fade-in rounded-2xl border border-line/70 bg-card p-4 shadow-card">
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none" aria-hidden="true">
          {candidate.icon}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-ink">{title}</h3>
          <p className="mt-0.5 text-xs text-muted">{candidate.services.join(" · ")}</p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted">Detour</dt>
          <dd className="font-medium tabular-nums text-ink">
            {formatOffRouteDistance(candidate.distanceOffRouteM)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">To next stop</dt>
          <dd className="font-medium tabular-nums text-ink">
            {candidate.distanceToNextStopKm != null
              ? formatKm(candidate.distanceToNextStopKm, 1)
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Elevation to next</dt>
          <dd className="font-medium tabular-nums text-ink">
            {candidate.elevationToNextStopM != null
              ? `${candidate.elevationToNextStopM >= 0 ? "+" : ""}${candidate.elevationToNextStopM} m`
              : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Opening hours</dt>
          <dd className="font-medium text-ink">{candidate.openingHours?.trim() || "Unknown"}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-xs text-muted">Confidence</dt>
          <dd className="font-medium text-ink">{candidate.confidenceLabel}</dd>
        </div>
      </dl>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onPromote}
          disabled={promoting}
          className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:opacity-60"
        >
          Promote
        </button>
        <button
          type="button"
          onClick={onDismiss}
          disabled={promoting}
          className="rounded-xl border border-line px-4 py-2.5 text-sm font-medium text-muted transition hover:text-ink"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
