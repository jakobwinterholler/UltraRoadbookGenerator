import type { AnalyzedClimb } from "../../planning/climbAnalysis";
import type { RouteHighlight } from "../../planning/routeHighlights";
import DifficultyStars from "../DifficultyStars";

interface DashboardBriefingCardsProps {
  highlights: RouteHighlight[];
  hardestClimb: AnalyzedClimb | null;
  hoveredHighlightId: string | null;
  onHighlightHover: (highlightId: string | null) => void;
  onSelectHighlight: (highlight: RouteHighlight) => void;
}

function valueClass(severity: RouteHighlight["severity"]): string {
  if (severity === "danger") {
    return "text-red-700";
  }
  if (severity === "warning") {
    return "text-amber-800";
  }
  return "text-ink";
}

function BriefingCard({
  highlight,
  hardestClimb,
  active,
  onHover,
  onSelect,
}: {
  highlight: RouteHighlight;
  hardestClimb: AnalyzedClimb | null;
  active: boolean;
  onHover: (highlightId: string | null) => void;
  onSelect: () => void;
}) {
  const isHardestClimb = highlight.id === "hardest-climb" && hardestClimb;

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => onHover(highlight.id)}
      onMouseLeave={() => onHover(null)}
      className={`group flex h-full w-full flex-col rounded-xl border p-4 text-left transition md:p-5 ${
        active
          ? "border-accent/50 bg-accent/[0.04] ring-1 ring-accent/25"
          : "border-line/40 bg-white hover:border-line/80 hover:bg-canvas/40"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="text-lg leading-none" aria-hidden="true">
          {highlight.emoji}
        </span>
        <p className="text-sm font-medium text-ink">{highlight.label}</p>
      </div>

      {isHardestClimb ? (
        <>
          <div className="mt-3">
            <DifficultyStars stars={hardestClimb.tier.stars} starClassName="text-amber-500" />
          </div>
          <p className="mt-2 text-lg font-semibold leading-snug tracking-tight text-ink">
            {highlight.value}
          </p>
          {highlight.insightHint && (
            <p className="mt-1 text-sm text-muted">{highlight.insightHint}</p>
          )}
        </>
      ) : (
        <>
          <p
            className={`mt-3 text-2xl font-semibold tabular-nums tracking-tight ${valueClass(highlight.severity)}`}
          >
            {highlight.value}
          </p>
          {(highlight.insightHint ?? highlight.detail) && (
            <p className="mt-1 text-sm text-muted">
              {highlight.insightHint ?? highlight.detail}
            </p>
          )}
        </>
      )}

      <div className="mt-auto flex items-end justify-between gap-3 pt-4">
        {highlight.kmHint && (
          <span className="text-xs tabular-nums text-muted">{highlight.kmHint}</span>
        )}
        <span className={`ml-auto text-sm text-accent transition ${active ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
          Open on map →
        </span>
      </div>
    </button>
  );
}

export default function DashboardBriefingCards({
  highlights,
  hardestClimb,
  hoveredHighlightId,
  onHighlightHover,
  onSelectHighlight,
}: DashboardBriefingCardsProps) {
  if (highlights.length === 0) {
    return (
      <p className="text-sm text-muted">No major challenges detected on this route yet.</p>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {highlights.map((highlight) => (
        <BriefingCard
          key={highlight.id}
          highlight={highlight}
          hardestClimb={hardestClimb}
          active={hoveredHighlightId === highlight.id}
          onHover={onHighlightHover}
          onSelect={() => onSelectHighlight(highlight)}
        />
      ))}
    </div>
  );
}
