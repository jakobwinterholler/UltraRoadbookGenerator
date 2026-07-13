import { useEffect, useState } from "react";
import type { AnalysisState } from "../analysis/analysisState";
import { estimateRemainingSeconds } from "../analysis/analysisState";
import AnalysisLiveMap from "../components/AnalysisLiveMap";
import { formatElapsed } from "../progress";

interface AnalyzingViewProps {
  fileName: string;
  startedAt: number;
  state: AnalysisState;
  onCancel?: () => void;
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
    <div className="flex items-center justify-between gap-4 py-2">
      <span className="text-caption text-muted">{label}</span>
      <span className="text-body font-semibold tabular-nums text-ink">
        {value}
        {ready && <span className="ml-2 text-success">✓</span>}
      </span>
    </div>
  );
}

export default function AnalyzingView({ fileName, startedAt, state, onCancel }: AnalyzingViewProps) {
  const [, tick] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => tick((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const remainingSeconds = estimateRemainingSeconds(state.percent, elapsedSeconds);
  const { stats, readiness } = state;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 lg:py-14">
      <div className="mb-10 flex items-start justify-between gap-4">
        <div>
          <p className="text-caption font-semibold uppercase tracking-[0.18em] text-accent">
            Analysing route
          </p>
          <h1 className="mt-2 text-display font-semibold tracking-tight text-ink">{fileName}</h1>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-button border border-line/60 px-4 py-2 text-sm font-medium text-muted transition hover:text-ink"
          >
            {state.error ? "Back to upload" : "Cancel"}
          </button>
        )}
      </div>

      {state.error && (
        <div className="mb-8 rounded-panel border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          <p className="font-semibold">Analysis failed</p>
          <p className="mt-1">{state.error}</p>
        </div>
      )}

      {!state.error && (
        <>
      <section className="mb-10">
        <h2 className="mb-3 text-h2 font-semibold text-ink">Route coming to life</h2>
        <AnalysisLiveMap preview={state.livePreview} />
      </section>

      <div className="mb-10">
        <div className="h-3 overflow-hidden rounded-full bg-surface-muted">
          <div
            className="h-full rounded-full bg-accent transition-all duration-500 ease-out"
            style={{ width: `${Math.min(100, Math.max(0, state.percent))}%` }}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-stat tabular-nums text-ink">{Math.round(state.percent)}%</p>
            <p className="mt-1 text-body text-muted">{state.currentLabel}</p>
            {state.subprogress && (
              <p className="mt-1 text-caption tabular-nums text-muted">
                {state.subprogress.label} · {state.subprogress.current.toLocaleString()} /{" "}
                {state.subprogress.total.toLocaleString()}
              </p>
            )}
          </div>
          <div className="flex gap-8 text-caption text-muted">
            <div>
              <p className="uppercase tracking-[0.12em]">Elapsed</p>
              <p className="mt-1 text-body font-semibold tabular-nums text-ink">
                {formatElapsed(elapsedSeconds)}
              </p>
            </div>
            <div>
              <p className="uppercase tracking-[0.12em]">Est. remaining</p>
              <p className="mt-1 text-body font-semibold tabular-nums text-ink">
                {remainingSeconds === null ? "—" : formatElapsed(remainingSeconds)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-8">
          <section>
            <h2 className="text-h2 font-semibold text-ink">Pipeline</h2>
            <ul className="mt-4 space-y-2">
              {state.checklist.map((item) => (
                <li key={item.id} className="flex items-center gap-3 py-1.5">
                  <StatusIcon status={item.status} />
                  <span
                    className={`text-body ${
                      item.status === "running"
                        ? "font-medium text-ink"
                        : item.status === "ready"
                          ? "text-muted"
                          : "text-muted/70"
                    }`}
                  >
                    {item.label}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-h2 font-semibold text-ink">Activity</h2>
            <div className="mt-4 max-h-48 overflow-y-auto rounded-panel bg-surface p-4 shadow-soft">
              {state.logs.length === 0 ? (
                <p className="text-caption text-muted">Waiting for milestones…</p>
              ) : (
                <ul className="space-y-2">
                  {state.logs.map((entry) => (
                    <li key={entry.id} className="text-caption text-ink">
                      {entry.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-8">
          <section className="rounded-panel bg-surface p-5 shadow-soft">
            <h2 className="text-h2 font-semibold text-ink">Live stats</h2>
            <div className="mt-2 divide-y divide-line/50">
              <StatRow
                label="Distance"
                value={stats.distance_km !== null ? `${stats.distance_km.toFixed(0)} km` : "—"}
                ready={readiness.distance === "ready"}
              />
              <StatRow
                label="Elevation"
                value={stats.elevation_gain_m !== null ? `+${stats.elevation_gain_m.toLocaleString()} m` : "—"}
                ready={readiness.elevation === "ready"}
              />
              <StatRow
                label="GPX points"
                value={stats.gpx_points !== null ? stats.gpx_points.toLocaleString() : "—"}
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
                      ? stats.asphalt_pct !== null
                        ? `${stats.asphalt_pct}% asphalt so far`
                        : "Processing…"
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
              <StatRow
                label="Resupply zones"
                value={
                  stats.zone_count !== null
                    ? `${stats.zone_count} created`
                    : readiness.resupply === "running"
                      ? "Clustering…"
                      : "—"
                }
                ready={readiness.resupply === "ready"}
              />
            </div>
          </section>
        </div>
      </div>
        </>
      )}
    </div>
  );
}
