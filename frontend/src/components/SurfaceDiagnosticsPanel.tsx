import type { SurfaceDiagnostics } from "../api";

interface SurfaceDiagnosticsPanelProps {
  diagnostics: SurfaceDiagnostics;
}

function formatSeconds(value: number): string {
  return `${value.toFixed(2)}s`;
}

export default function SurfaceDiagnosticsPanel({ diagnostics }: SurfaceDiagnosticsPanelProps) {
  const runtime = diagnostics.runtime;

  return (
    <section className="space-y-4 rounded-2xl border border-line bg-card p-6 shadow-card">
      <div>
        <h2 className="text-h2 font-semibold text-ink">Surface analysis diagnostics</h2>
        <p className="mt-1 text-sm text-muted">
          Pipeline timing, Unknown causes, and inference sources — for trust verification.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["OSM load", runtime.osm_load_s],
          ["JSON parse", runtime.json_parse_s],
          ["Segment simplify", runtime.simplify_s],
          ["Index build", runtime.index_build_s],
          ["Matching", runtime.matching_s],
          ["Inference", runtime.inference_s],
          ["Merge", runtime.merge_s],
          ["Total", runtime.total_s],
        ].map(([label, seconds]) => (
          <div key={label} className="rounded-xl border border-line/70 bg-canvas/40 px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-ink">
              {formatSeconds(seconds as number)}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Unknown causes (points)</p>
          <ul className="space-y-1 text-sm text-ink">
            {Object.entries(diagnostics.unknown_by_cause).map(([cause, count]) => (
              <li key={cause} className="flex justify-between gap-3">
                <span>{cause.replace(/_/g, " ")}</span>
                <span className="tabular-nums text-muted">{count}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Surface sources (points)</p>
          <ul className="space-y-1 text-sm text-ink">
            {Object.entries(diagnostics.source_counts).map(([source, count]) => (
              <li key={source} className="flex justify-between gap-3">
                <span>{source.replace(/_/g, " ")}</span>
                <span className="tabular-nums text-muted">{count}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-4 text-sm lg:grid-cols-3">
        <p className="text-muted">
          OSM segments: {diagnostics.osm_segment_count_raw.toLocaleString()} raw →{" "}
          {diagnostics.osm_segment_count_indexed.toLocaleString()} indexed
        </p>
        <p className="text-muted">
          Avg candidates/point: {diagnostics.avg_candidates_per_point.toFixed(1)}
        </p>
        <p className="text-muted">Match decimation: every {diagnostics.decimation_factor} point(s)</p>
      </div>

      {diagnostics.top_unmapped_tags.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Unmapped OSM tags</p>
          <ul className="space-y-1 text-sm text-ink">
            {diagnostics.top_unmapped_tags.map((entry) => (
              <li key={entry.tag} className="flex justify-between gap-3">
                <span>{entry.tag}</span>
                <span className="tabular-nums text-muted">{entry.point_count}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
