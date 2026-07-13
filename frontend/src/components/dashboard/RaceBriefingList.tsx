import type { RouteHighlight } from "../../planning/routeHighlights";

interface RaceBriefingListProps {
  highlights: RouteHighlight[];
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

export default function RaceBriefingList({ highlights, onSelectHighlight }: RaceBriefingListProps) {
  if (highlights.length === 0) {
    return (
      <p className="text-sm text-muted">No major challenges detected on this route yet.</p>
    );
  }

  return (
    <ul className="divide-y divide-line/50">
      {highlights.map((highlight) => (
        <li key={highlight.id}>
          <button
            type="button"
            onClick={() => onSelectHighlight(highlight)}
            className="group flex w-full items-start justify-between gap-6 py-4 text-left transition hover:bg-canvas/50"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted">{highlight.label}</p>
              <p className={`mt-1 text-lg font-medium tracking-tight ${valueClass(highlight.severity)}`}>
                {highlight.value}
              </p>
              <p className="mt-1 text-sm text-muted">{highlight.detail}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1 pt-1">
              {highlight.kmHint && (
                <span className="text-xs tabular-nums text-muted">{highlight.kmHint}</span>
              )}
              <span className="text-sm text-accent opacity-0 transition group-hover:opacity-100">
                Open on map →
              </span>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
