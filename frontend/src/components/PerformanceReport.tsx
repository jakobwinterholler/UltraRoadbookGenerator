import type { PerformanceStageRow, PerformanceSummaryRow } from "../api";

interface PerformanceReportProps {
  report: PerformanceStageRow[];
  summary?: PerformanceSummaryRow | null;
}

function cacheModeLabel(mode: PerformanceSummaryRow["cache_mode"]): string {
  if (mode === "hot") {
    return "Hot analysis (geometry cache)";
  }
  if (mode === "warm") {
    return "Warm analysis (OSM cache)";
  }
  return "Cold analysis (Overpass download)";
}

export default function PerformanceReport({ report, summary = null }: PerformanceReportProps) {
  if (!report.length) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-line bg-card p-4 shadow-card">
      <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">
        Pipeline performance
      </h3>
      <p className="mt-1 text-sm text-muted">
        Stage timings from the last analysis run.
      </p>
      {summary && (
        <div className="mt-3 rounded-xl border border-line/80 bg-canvas/60 px-3 py-2 text-sm">
          <p className="font-medium text-ink">{cacheModeLabel(summary.cache_mode)}</p>
          <p className="mt-1 text-muted">
            {summary.total_s.toFixed(1)}s total · {summary.memory_peak_mb.toFixed(0)} MB peak
          </p>
          <p className="mt-1 text-xs text-muted">
            Targets: cold ≤ {summary.target_cold_s}s · warm ≤ {summary.target_warm_s}s
            {summary.cache_mode === "cold" && (
              <span className={summary.meets_cold_target ? " text-green-700" : " text-red-700"}>
                {" "}
                · {summary.meets_cold_target ? "cold target met" : "cold target missed"}
              </span>
            )}
            {(summary.cache_mode === "warm" || summary.cache_mode === "hot") && (
              <span className={summary.meets_warm_target ? " text-green-700" : " text-red-700"}>
                {" "}
                · {summary.meets_warm_target ? "warm target met" : "warm target missed"}
              </span>
            )}
          </p>
        </div>
      )}
      <div className="mt-4 space-y-2">
        {report.map((row) => (
          <div key={row.stage_id} className="flex items-center justify-between gap-4 text-sm">
            <span className="text-ink">{row.label}</span>
            <span className="tabular-nums text-muted">
              {row.duration_s.toFixed(1)} s
              <span className="ml-2 text-xs">({row.percent.toFixed(1)}%)</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
