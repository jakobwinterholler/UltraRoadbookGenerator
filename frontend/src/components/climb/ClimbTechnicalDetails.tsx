import type { ClimbRow } from "../../api";
import { formatGradientMetric, GRADIENT_METRICS } from "../../planning/useClimbDetail";

interface ClimbTechnicalDetailsProps {
  climb: ClimbRow;
}

export default function ClimbTechnicalDetails({ climb }: ClimbTechnicalDetailsProps) {
  return (
    <section>
      <h3 className="text-sm font-medium text-ink">Technical details</h3>

      <dl className="mt-4 space-y-2 text-sm">
        {GRADIENT_METRICS.map(({ label, key }) => (
          <div key={key} className="flex justify-between gap-6 border-b border-line/40 py-2">
            <dt className="text-muted">{label}</dt>
            <dd className="shrink-0 font-medium tabular-nums text-ink">
              {formatGradientMetric(climb[key])}
            </dd>
          </div>
        ))}
      </dl>

      <dl className="mt-4 grid grid-cols-3 gap-4 border-t border-line/60 pt-4 text-sm">
        <div>
          <dt className="text-xs text-muted">Average</dt>
          <dd className="mt-0.5 font-medium tabular-nums text-ink">
            {climb.avg_gradient_pct.toFixed(1)}%
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Gain</dt>
          <dd className="mt-0.5 font-medium tabular-nums text-ink">+{climb.elevation_gain_m} m</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Length</dt>
          <dd className="mt-0.5 font-medium tabular-nums text-ink">{climb.length_km.toFixed(1)} km</dd>
        </div>
      </dl>

      <p className="mt-3 text-xs tabular-nums text-muted">
        km {Math.round(climb.start_km)}–{Math.round(climb.end_km)} on route
      </p>
    </section>
  );
}
