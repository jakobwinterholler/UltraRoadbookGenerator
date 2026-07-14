import type { RaceSummary } from "../../races/api";
import { formatRaceDate } from "../../races/api";
import type { SyncIndicator } from "@shared/ui/SyncStatusBadge";
import { SyncStatusBadge } from "@shared/ui/SyncStatusBadge";
import {
  formatLastVerification,
  RaceStatsGrid,
  ReadinessReasonsList,
  ReadinessScoreBadge,
} from "@shared/ui/RaceReadinessDisplay";
import { formatKm } from "../routeInsights";
import { RaceManageMenu, type RaceManageAction } from "./RaceManageMenu";

interface PreparationProgressProps {
  race: RaceSummary;
  compact?: boolean;
  onNavigateToVerify?: () => void;
}

export function PreparationProgress({
  race,
  compact = false,
  onNavigateToVerify,
}: PreparationProgressProps) {
  const fraction = race.preparation_total
    ? race.preparation_completed / race.preparation_total
    : 0;

  if (!race.has_analysis) {
    return <p className="text-sm text-muted">Not analyzed yet</p>;
  }

  if (compact) {
    return (
      <div>
        <div className="flex items-center justify-between gap-2 text-xs text-muted">
          <span>Preparation milestones</span>
          <span>
            {race.preparation_completed}/{race.preparation_total}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line/60">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${Math.round(fraction * 100)}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink">Preparation</p>
        <p className="text-sm text-muted">
          {race.preparation_completed} of {race.preparation_total}
        </p>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-line/60">
        <div
          className="h-full rounded-full bg-accent transition-all"
          style={{ width: `${Math.round(fraction * 100)}%` }}
        />
      </div>
      <ul className="mt-3 space-y-1.5">
        {race.preparation_items.map((item) => {
          const isVerify = item.id === "stops_verified";
          const clickable = isVerify && onNavigateToVerify && !item.complete;
          return (
            <li key={item.id}>
              {clickable ? (
                <button
                  type="button"
                  onClick={onNavigateToVerify}
                  className="flex w-full items-center gap-2 rounded-lg px-1 py-0.5 text-left text-sm transition hover:bg-accent/[0.05]"
                >
                  <span
                    className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-line text-transparent"
                    aria-hidden
                  >
                    ✓
                  </span>
                  <span className="text-accent">{item.label} →</span>
                </button>
              ) : (
                <div className="flex items-center gap-2 text-sm">
                  <span
                    className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] ${
                      item.complete ? "bg-accent text-white" : "border border-line text-transparent"
                    }`}
                    aria-hidden
                  >
                    ✓
                  </span>
                  <span className={item.complete ? "text-ink" : "text-muted"}>{item.label}</span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface RaceCardProps {
  race: RaceSummary;
  onOpen: (raceId: string) => void;
  onManage: (raceId: string, action: RaceManageAction) => void;
  syncStatus?: SyncIndicator | null;
}

export function RaceCard({ race, onOpen, onManage, syncStatus }: RaceCardProps) {
  const archived = Boolean(race.archived_at);
  const stats = race.dashboard_stats;

  return (
    <article
      className={`group flex h-full w-full flex-col rounded-2xl border bg-card p-5 shadow-card transition hover:shadow-md ${
        archived ? "border-line/60 opacity-75" : "border-line hover:border-accent/30"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => onOpen(race.id)}
          className="min-w-0 flex-1 text-left"
        >
          <h3 className="text-lg font-semibold tracking-tight text-ink group-hover:text-accent">
            {race.name}
          </h3>
          {race.has_analysis && race.distance_km != null ? (
            <p className="mt-1 text-sm text-muted">
              {formatKm(race.distance_km)}
              {race.elevation_gain_m != null
                ? ` · +${Math.round(race.elevation_gain_m).toLocaleString()} m`
                : ""}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted">{race.gpx_original_name}</p>
          )}
        </button>
        <div className="flex shrink-0 items-start gap-2">
          {stats ? <ReadinessScoreBadge score={stats.readiness_score} /> : null}
          {syncStatus ? <SyncStatusBadge status={syncStatus} className="shrink-0" /> : null}
          <RaceManageMenu
            archived={archived}
            hasAnalysis={race.has_analysis}
            onAction={(action) => {
              if (action === "open") {
                onOpen(race.id);
                return;
              }
              onManage(race.id, action);
            }}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => onOpen(race.id)}
        className="mt-5 flex-1 space-y-4 border-t border-line/70 pt-4 text-left"
      >
        {stats ? (
          <>
            <RaceStatsGrid stats={stats} />
            <ReadinessReasonsList reasons={stats.readiness_reasons} compact />
            <p className="text-[11px] text-muted">
              Last verified {formatLastVerification(stats.last_verification_at)}
            </p>
          </>
        ) : (
          <PreparationProgress race={race} compact />
        )}
        <p className="text-xs text-muted">
          {archived ? "Archived · " : ""}
          Modified {formatRaceDate(race.updated_at)}
        </p>
      </button>
    </article>
  );
}
