import { useEffect, useState } from "react";
import type { AnalysisState } from "../../analysis/analysisState";
import { estimateRemainingSeconds } from "../../analysis/analysisState";
import AnalysisLiveMap from "../AnalysisLiveMap";
import PerformanceReport from "../PerformanceReport";
import { formatElapsed } from "../../progress";

interface AnalysisDetailsPanelProps {
  state: AnalysisState;
  startedAt: number;
}

function StatusIcon({ status }: { status: "waiting" | "running" | "ready" }) {
  if (status === "ready") {
    return <span className="text-success">✓</span>;
  }
  if (status === "running") {
    return <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent" />;
  }
  return <span className="text-muted/40">○</span>;
}

function StatRow({
  label,
  value,
  ready,
}: {
  label: string;
  value: string;
  ready?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-sm font-medium tabular-nums text-ink">
        {value}
        {ready && <span className="ml-2 text-success">✓</span>}
      </span>
    </div>
  );
}

function OsmStatusSection({ state }: { state: AnalysisState }) {
  const surface = state.pipelineSteps.osm_surface_data;
  const poi = state.pipelineSteps.osm_poi_data;

  if (!surface && !poi) {
    return (
      <p className="text-xs text-muted">OpenStreetMap status will appear once downloads begin.</p>
    );
  }

  return (
    <div className="space-y-2 text-sm">
      {surface && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted">Surface data</span>
          <span className="text-ink">{surface.label}</span>
        </div>
      )}
      {poi && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted">Resupply data</span>
          <span className="text-ink">{poi.label}</span>
        </div>
      )}
      {state.logs
        .filter((entry) => /cache|osm|download/i.test(entry.message))
        .slice(-4)
        .map((entry) => (
          <p key={entry.id} className="text-xs text-muted">
            {entry.message}
          </p>
        ))}
    </div>
  );
}

export default function AnalysisDetailsPanel({ state, startedAt }: AnalysisDetailsPanelProps) {
  const [, tick] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => tick((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const remainingSeconds = estimateRemainingSeconds(state.percent, elapsedSeconds);
  const { stats, readiness } = state;

  return (
    <div className="mt-6 space-y-6 border-t border-line pt-6">
      <section>
        <h3 className="text-sm font-semibold text-ink">Route preview</h3>
        <div className="mt-3 overflow-hidden rounded-xl border border-line">
          <AnalysisLiveMap preview={state.livePreview} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-line/80 bg-canvas/40 p-4">
          <h3 className="text-sm font-semibold text-ink">Live stats</h3>
          <div className="mt-2 divide-y divide-line/50">
            <StatRow
              label="Distance"
              value={stats.distance_km !== null ? `${stats.distance_km.toFixed(0)} km` : "—"}
              ready={readiness.distance === "ready"}
            />
            <StatRow
              label="Elevation"
              value={
                stats.elevation_gain_m !== null
                  ? `+${stats.elevation_gain_m.toLocaleString()} m`
                  : "—"
              }
              ready={readiness.elevation === "ready"}
            />
            <StatRow
              label="Climbs"
              value={
                stats.climb_count !== null
                  ? `${stats.climb_count} found`
                  : readiness.climbs === "running"
                    ? "Detecting…"
                    : "—"
              }
              ready={readiness.climbs === "ready"}
            />
            <StatRow
              label="Surface"
              value={
                stats.surface_pct !== null
                  ? `${stats.surface_pct}% processed`
                  : readiness.surface === "running"
                    ? "Processing…"
                    : "—"
              }
              ready={readiness.surface === "ready"}
            />
            <StatRow
              label="POIs"
              value={
                stats.poi_count !== null
                  ? `${stats.poi_count.toLocaleString()} found`
                  : readiness.pois === "running"
                    ? "Matching…"
                    : "—"
              }
              ready={readiness.pois === "ready"}
            />
          </div>
          <div className="mt-4 flex gap-6 text-xs text-muted">
            <div>
              <p className="uppercase tracking-[0.12em]">Elapsed</p>
              <p className="mt-1 font-semibold tabular-nums text-ink">
                {formatElapsed(elapsedSeconds)}
              </p>
            </div>
            <div>
              <p className="uppercase tracking-[0.12em]">Est. remaining</p>
              <p className="mt-1 font-semibold tabular-nums text-ink">
                {remainingSeconds === null ? "—" : formatElapsed(remainingSeconds)}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-line/80 bg-canvas/40 p-4">
          <h3 className="text-sm font-semibold text-ink">OpenStreetMap & cache</h3>
          <div className="mt-3">
            <OsmStatusSection state={state} />
          </div>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h3 className="text-sm font-semibold text-ink">Pipeline</h3>
          <ul className="mt-3 space-y-1.5">
            {state.checklist.map((item) => (
              <li key={item.id} className="flex items-center gap-3 py-0.5">
                <StatusIcon status={item.status} />
                <span className="text-sm text-ink">{item.label}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-ink">Activity</h3>
          <div className="mt-3 max-h-40 overflow-y-auto rounded-xl border border-line/80 bg-canvas/40 p-3">
            {state.logs.length === 0 ? (
              <p className="text-xs text-muted">Waiting for milestones…</p>
            ) : (
              <ul className="space-y-1.5">
                {state.logs.map((entry) => (
                  <li key={entry.id} className="text-xs text-ink">
                    {entry.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      {state.performanceReport.length > 0 && (
        <PerformanceReport
          report={state.performanceReport}
          summary={state.performanceSummary}
        />
      )}
    </div>
  );
}
