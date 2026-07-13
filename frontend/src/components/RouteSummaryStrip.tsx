import type { OverlayMode } from "../planning/types";
import type { RouteInsights } from "./routeInsights";
import { formatKm, percentOfRoute } from "./routeInsights";

interface RouteSummaryStripProps {
  distanceKm: number;
  elevationGainM: number;
  climbCount: number;
  zoneCount: number;
  asphaltPct: number;
  insights: RouteInsights;
  overlay: OverlayMode;
  maxGapThresholdKm: number;
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-[88px]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight text-ink">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export default function RouteSummaryStrip({
  distanceKm,
  elevationGainM,
  climbCount,
  zoneCount,
  asphaltPct,
  insights,
  overlay,
  maxGapThresholdKm: _maxGapThresholdKm,
}: RouteSummaryStripProps) {
  const poorKm = insights.resupplyMix.poor ?? 0;
  const poorPct = percentOfRoute(poorKm, distanceKm);
  const unknownKm = insights.surfaceMix.Unknown ?? 0;
  const unknownPct = percentOfRoute(unknownKm, distanceKm);

  return (
    <section className="rounded-2xl border border-line bg-card px-5 py-4 shadow-card">
      <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
        <Metric label="Distance" value={formatKm(distanceKm, 0)} />
        <Metric label="Elevation" value={`+${Math.round(elevationGainM)} m`} />
        <Metric label="Climbs" value={String(climbCount)} />
        <Metric
          label="Stops shown"
          value={String(zoneCount)}
          hint={zoneCount > 0 ? `~${formatKm(distanceKm / zoneCount, 0)} apart` : undefined}
        />
        <Metric
          label="Longest gap"
          value={insights.longestGapKm > 0 ? formatKm(insights.longestGapKm, 0) : "—"}
          hint={
            insights.longestGap
              ? `${formatKm(insights.longestGap.startKm, 0)} → ${formatKm(insights.longestGap.endKm, 0)}`
              : undefined
          }
        />
        {overlay === "surface" || overlay === "normal" ? (
          <Metric label="Asphalt" value={`${asphaltPct}%`} hint={unknownPct > 0 ? `${unknownPct}% unknown` : undefined} />
        ) : (
          <Metric
            label="Poor resupply"
            value={poorPct > 0 ? `${poorPct}%` : "—"}
            hint="of route distance"
          />
        )}
      </div>
    </section>
  );
}
