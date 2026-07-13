import { useMemo } from "react";
import type { AnalyzedClimb, ClimbSortMode } from "../planning/climbAnalysis";
import DifficultyStars from "./DifficultyStars";

interface ClimbTableProps {
  climbs: AnalyzedClimb[];
  compact?: boolean;
  selectedClimbId?: string | null;
  onSelectClimb?: (climbId: string) => void;
  editableNicknames?: boolean;
  onNicknameChange?: (climbId: string, nickname: string) => void;
  onNicknameBlur?: (climbId: string, nickname: string) => void;
  sortMode?: ClimbSortMode;
  onSortModeChange?: (mode: ClimbSortMode) => void;
  searchQuery?: string;
  onSearchQueryChange?: (query: string) => void;
  showControls?: boolean;
}

const SORT_OPTIONS: Array<{ id: ClimbSortMode; label: string }> = [
  { id: "route_order", label: "Route order" },
  { id: "difficulty", label: "Difficulty" },
  { id: "length", label: "Length" },
  { id: "elevation_gain", label: "Elevation gain" },
  { id: "avg_gradient", label: "Average gradient" },
  { id: "hardest_1km", label: "Hardest 1 km" },
];

function formatGradient(value: number | null): string {
  return value === null ? "—" : value.toFixed(1);
}

export default function ClimbTable({
  climbs,
  compact = false,
  selectedClimbId = null,
  onSelectClimb,
  editableNicknames = false,
  onNicknameChange,
  onNicknameBlur,
  sortMode = "route_order",
  onSortModeChange,
  searchQuery = "",
  onSearchQueryChange,
  showControls = false,
}: ClimbTableProps) {
  const visibleCount = climbs.length;

  const summaryLabel = useMemo(() => {
    if (!showControls) {
      return null;
    }
    return `${visibleCount} climb${visibleCount === 1 ? "" : "s"}`;
  }, [showControls, visibleCount]);

  if (climbs.length === 0) {
    return (
      <div className="rounded-2xl bg-card p-8 text-center shadow-card">
        <p className="text-muted">
          {searchQuery.trim() ? "No climbs match your search." : "No climbs detected on this route."}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-card shadow-card">
      {showControls && (
        <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-ink">All climbs</h3>
            {summaryLabel && <p className="mt-1 text-xs text-muted">{summaryLabel}</p>}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => onSearchQueryChange?.(event.target.value)}
              placeholder="Search climbs…"
              className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink sm:w-52"
            />
            <select
              value={sortMode}
              onChange={(event) => onSortModeChange?.(event.target.value as ClimbSortMode)}
              className="rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  Sort: {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line bg-canvas/60 text-xs uppercase tracking-wide text-muted">
              <th className="px-5 py-4 font-semibold">Difficulty</th>
              <th className="px-5 py-4 font-semibold">Name</th>
              {!compact && <th className="px-5 py-4 font-semibold">Badges</th>}
              <th className="px-5 py-4 font-semibold">ID</th>
              <th className="px-5 py-4 font-semibold">Start (km)</th>
              <th className="px-5 py-4 font-semibold">End (km)</th>
              <th className="px-5 py-4 font-semibold">Length (km)</th>
              <th className="px-5 py-4 font-semibold">Gain (m)</th>
              <th className="px-5 py-4 font-semibold">Avg (%)</th>
              {!compact && (
                <>
                  <th className="px-5 py-4 font-semibold">Max 50m</th>
                  <th className="px-5 py-4 font-semibold">Max 100m</th>
                  <th className="px-5 py-4 font-semibold">Max 250m</th>
                  <th className="px-5 py-4 font-semibold">Max 500m</th>
                  <th className="px-5 py-4 font-semibold">Max 1000m</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {climbs.map((climb, index) => (
              <tr
                key={climb.id}
                onClick={() => onSelectClimb?.(climb.id)}
                className={`border-b border-line/70 transition hover:bg-canvas/40 ${
                  onSelectClimb ? "cursor-pointer" : ""
                } ${
                  selectedClimbId === climb.id
                    ? "bg-accent/[0.05] ring-1 ring-inset ring-accent/20"
                    : climb.tier.rowClass || (index % 2 === 0 ? "bg-white" : "bg-canvas/20")
                }`}
              >
                <td className="px-5 py-4">
                  <DifficultyStars stars={climb.tier.stars} starClassName={climb.tier.starClass} />
                  <p className="mt-1 text-xs font-medium tabular-nums text-muted">
                    {climb.difficultyScore}
                    <span className="ml-1 font-normal">/ 100</span>
                  </p>
                  <p className="text-[11px] text-muted">{climb.tier.label}</p>
                </td>
                <td className="px-5 py-4">
                  {editableNicknames ? (
                    <input
                      type="text"
                      value={climb.nickname ?? ""}
                      placeholder={climb.displayName}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => onNicknameChange?.(climb.id, event.target.value)}
                      onBlur={(event) => onNicknameBlur?.(climb.id, event.target.value)}
                      className="w-full min-w-[140px] rounded-lg border border-line bg-white px-2 py-1 text-sm text-ink"
                    />
                  ) : (
                    <span className="font-medium text-ink">{climb.displayName}</span>
                  )}
                </td>
                {!compact && (
                  <td className="px-5 py-4">
                    {climb.whyBadges.length > 0 ? (
                      <div className="flex max-w-[220px] flex-col gap-0.5">
                        {climb.whyBadges.slice(0, 2).map((badge) => (
                          <span
                            key={badge.id}
                            className="text-[11px] font-medium text-ink"
                            title={badge.label}
                          >
                            {badge.emoji} {badge.shortLabel}
                          </span>
                        ))}
                        {climb.whyBadges.length > 2 && (
                          <span className="text-[10px] text-muted">
                            +{climb.whyBadges.length - 2} more
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                )}
                <td className="px-5 py-4 font-semibold text-muted">{climb.id}</td>
                <td className="px-5 py-4 tabular-nums">{climb.start_km.toFixed(2)}</td>
                <td className="px-5 py-4 tabular-nums">{climb.end_km.toFixed(2)}</td>
                <td className="px-5 py-4 tabular-nums">{climb.length_km.toFixed(2)}</td>
                <td className="px-5 py-4 tabular-nums">{climb.elevation_gain_m}</td>
                <td className="px-5 py-4 tabular-nums font-medium text-accent">
                  {climb.avg_gradient_pct.toFixed(1)}
                </td>
                {!compact && (
                  <>
                    <td className="px-5 py-4 tabular-nums text-muted">
                      {formatGradient(climb.max_50_m_pct)}
                    </td>
                    <td className="px-5 py-4 tabular-nums text-muted">
                      {formatGradient(climb.max_100_m_pct)}
                    </td>
                    <td className="px-5 py-4 tabular-nums text-muted">
                      {formatGradient(climb.max_250_m_pct)}
                    </td>
                    <td className="px-5 py-4 tabular-nums text-muted">
                      {formatGradient(climb.max_500_m_pct)}
                    </td>
                    <td className="px-5 py-4 tabular-nums font-medium text-ink">
                      {formatGradient(climb.max_1000_m_pct)}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
