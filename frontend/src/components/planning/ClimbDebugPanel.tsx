import type { ClimbDebugContext } from "../../planning/climbDebug";

interface ClimbDebugPanelProps {
  context: ClimbDebugContext | null;
  onClose: () => void;
}

function formatKm(value: number): string {
  return value.toFixed(2);
}

function MiniElevationProfile({
  samples,
}: {
  samples: Array<{ km: number; eleM: number | null }>;
}) {
  if (samples.length < 2) {
    return <p className="text-sm text-muted">Not enough elevation samples near this point.</p>;
  }

  const valid = samples.filter((sample) => sample.eleM != null) as Array<{ km: number; eleM: number }>;
  if (valid.length < 2) {
    return <p className="text-sm text-muted">Elevation missing near this point.</p>;
  }

  const minKm = valid[0].km;
  const maxKm = valid[valid.length - 1].km;
  const minEle = Math.min(...valid.map((sample) => sample.eleM));
  const maxEle = Math.max(...valid.map((sample) => sample.eleM));
  const eleRange = Math.max(1, maxEle - minEle);
  const width = 300;
  const height = 72;

  const points = valid
    .map((sample) => {
      const x = ((sample.km - minKm) / Math.max(0.01, maxKm - minKm)) * width;
      const y = height - ((sample.eleM - minEle) / eleRange) * (height - 8) - 4;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div>
      <p className="mb-1 text-xs text-muted">
        Raw elevation · km {formatKm(minKm)} → {formatKm(maxKm)}
      </p>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-20 w-full rounded-lg bg-canvas">
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-accent"
          points={points}
        />
      </svg>
    </div>
  );
}

function CandidateList({
  title,
  items,
  emptyLabel,
}: {
  title: string;
  items: ClimbDebugContext["candidates"];
  emptyLabel: string;
}) {
  if (items.length === 0) {
    return (
      <div>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">{title}</p>
        <p className="text-sm text-muted">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">{title}</p>
      <ul className="space-y-1 text-sm">
        {items.map((candidate) => (
          <li
            key={candidate.candidate_id}
            className="rounded-lg border border-line/70 bg-canvas/60 px-2 py-1.5"
          >
            <p className="font-medium">
              {candidate.candidate_id} · {candidate.status}
            </p>
            <p className="text-xs text-muted">
              km {formatKm(candidate.start_km)} → {formatKm(candidate.end_km)} · +
              {Math.round(candidate.elevation_gain_m)} m · {candidate.avg_gradient_pct.toFixed(1)}%
            </p>
            {candidate.rejection_label ? (
              <p className="text-xs text-amber-700">{candidate.rejection_label}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ClimbDebugPanel({ context, onClose }: ClimbDebugPanelProps) {
  if (!context) {
    return (
      <div className="absolute left-3 top-3 z-[500] w-[min(92vw,360px)] rounded-xl border border-line bg-card/95 p-4 shadow-card backdrop-blur">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-sm font-medium">Climb debug</p>
          <button type="button" className="text-xs text-muted hover:text-foreground" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="text-sm text-muted">Click the map to inspect climb detection near that point.</p>
      </div>
    );
  }

  return (
    <div className="absolute left-3 top-3 z-[500] flex max-h-[min(78vh,720px)] w-[min(92vw,380px)] flex-col rounded-xl border border-line bg-card/95 shadow-card backdrop-blur">
      <div className="flex items-start justify-between gap-2 border-b border-line/70 px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted">Climb debug</p>
          <p className="text-base font-medium">km {formatKm(context.clickKm)}</p>
        </div>
        <button type="button" className="text-xs text-muted hover:text-foreground" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="space-y-3 overflow-y-auto px-4 py-3 text-sm">
        <MiniElevationProfile samples={context.elevationSamples} />

        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">At this point</p>
          <p>
            {context.activeClimb
              ? `${context.activeClimb.id} · +${Math.round(context.activeClimb.elevation_gain_m)} m`
              : "Not inside an accepted climb"}
          </p>
          {context.nearestCandidate ? (
            <p className="text-xs text-muted">
              Nearest candidate: {context.nearestCandidate.candidate_id} ({context.nearestCandidate.status})
            </p>
          ) : null}
        </div>

        <CandidateList
          title={`Significant climbs (${context.significantClimbs.length})`}
          items={context.significantClimbs.map((climb) => ({
            candidate_id: climb.id,
            climb_id: climb.id,
            start_km: climb.start_km,
            end_km: climb.end_km,
            length_km: climb.length_km,
            elevation_gain_m: climb.elevation_gain_m,
            net_elevation_gain_m: climb.elevation_gain_m,
            avg_gradient_pct: climb.avg_gradient_pct,
            max_gradient_pct: climb.max_1000_m_pct,
            status: "accepted",
            rejection_reason: null,
            rejection_label: null,
          }))}
          emptyLabel="No significant climbs on this route."
        />

        <CandidateList
          title={`All accepted (${context.acceptedClimbs.length})`}
          items={context.acceptedClimbs.map((climb) => ({
            candidate_id: climb.id,
            climb_id: climb.id,
            start_km: climb.start_km,
            end_km: climb.end_km,
            length_km: climb.length_km,
            elevation_gain_m: climb.elevation_gain_m,
            net_elevation_gain_m: climb.elevation_gain_m,
            avg_gradient_pct: climb.avg_gradient_pct,
            max_gradient_pct: climb.max_1000_m_pct,
            status: "accepted",
            rejection_reason: null,
            rejection_label: null,
          }))}
          emptyLabel="No accepted climbs."
        />

        <CandidateList
          title={`Rejected (${context.rejectedCandidates.length})`}
          items={context.rejectedCandidates}
          emptyLabel="No rejected candidates."
        />
      </div>
    </div>
  );
}
