import type { ResupplySegmentSummary as ResupplySegmentSummaryData } from "../../planning/resupplySegments";
import {
  gapAvailabilityClass,
  gapAvailabilityLabel,
} from "../../planning/resupplySegments";
import VerificationStatusIcon from "../verification/VerificationStatusIcon";

interface ResupplySegmentSummaryProps {
  summary: ResupplySegmentSummaryData;
  compact?: boolean;
  onClear?: () => void;
  onFocusOnMap?: () => void;
}

function Metric({
  label,
  value,
  valueClass = "text-ink",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-0.5 text-sm font-semibold tabular-nums ${valueClass}`}>{value}</p>
    </div>
  );
}

export default function ResupplySegmentSummary({
  summary,
  compact = false,
  onClear,
  onFocusOnMap,
}: ResupplySegmentSummaryProps) {
  const surfaceLabel =
    summary.surfaceMix.length > 0
      ? summary.surfaceMix.map((row) => `${row.category} ${row.percentage}%`).join(" · ")
      : "—";

  return (
    <section
      className={`rounded-xl border border-accent/20 bg-accent/[0.03] ${
        compact ? "px-4 py-3" : "px-4 py-4"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
            Resupply section
          </p>
          <h3 className="mt-1 truncate text-sm font-semibold text-ink">{summary.range.label}</h3>
          <p className="mt-0.5 text-xs tabular-nums text-muted">
            km {Math.round(summary.range.startKm)} → {Math.round(summary.range.endKm)}
          </p>
        </div>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="shrink-0 text-xs font-medium text-accent hover:text-accent/80"
          >
            Clear
          </button>
        )}
      </div>

      {onFocusOnMap && (
        <button
          type="button"
          onClick={onFocusOnMap}
          className="mt-3 text-xs font-medium text-accent hover:text-accent/80"
        >
          Focus on map →
        </button>
      )}

      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
        <Metric label="Distance" value={`${summary.distanceKm} km`} />
        <Metric label="Elevation gain" value={`+${summary.elevationGainM.toLocaleString()} m`} />
        <Metric label="Elevation loss" value={`−${summary.elevationLossM.toLocaleString()} m`} />
        <Metric label="Gravel" value={`${summary.gravelPct}%`} />
        <Metric
          label="Food"
          value={gapAvailabilityLabel(summary.foodAvailability)}
          valueClass={gapAvailabilityClass(summary.foodAvailability)}
        />
        <Metric
          label="Water"
          value={gapAvailabilityLabel(summary.waterAvailability)}
          valueClass={gapAvailabilityClass(summary.waterAvailability)}
        />
      </div>

      <div className="mt-3">
        <p className="text-xs text-muted">Surface mix</p>
        <p className="mt-0.5 text-sm text-ink">{surfaceLabel}</p>
      </div>

      {summary.verifiedStopsInside.length > 0 && (
        <div className="mt-3">
          <p className="text-xs text-muted">Verified stops inside</p>
          <ul className="mt-1.5 space-y-1">
            {summary.verifiedStopsInside.map((stop) => (
              <li key={stop.zoneId} className="flex items-center gap-2 text-sm text-ink">
                <VerificationStatusIcon status="verified" size="sm" />
                <span>
                  {stop.name}
                  <span className="ml-1.5 text-xs tabular-nums text-muted">km {stop.km}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
