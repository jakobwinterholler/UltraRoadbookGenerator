import type { RouteHighlight } from "../../planning/routeHighlights";
import { topBriefingHighlights } from "../../planning/routeHighlights";

interface RouteBriefingProps {
  highlights: RouteHighlight[];
  onSelectHighlight: (highlight: RouteHighlight) => void;
  onViewFullBriefing: () => void;
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

export default function RouteBriefing({
  highlights,
  onSelectHighlight,
  onViewFullBriefing,
}: RouteBriefingProps) {
  const items = topBriefingHighlights(highlights, 3);

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="shrink-0 space-y-2 pb-4">
      <div>
        <h3 className="text-sm font-semibold text-ink">Biggest challenges</h3>
      </div>

      <ul className="space-y-0.5">
        {items.map((highlight) => (
          <li key={highlight.id}>
            <button
              type="button"
              onClick={() => onSelectHighlight(highlight)}
              className="w-full rounded-lg px-1 py-1.5 text-left transition hover:bg-canvas/80"
            >
              <p className="text-xs text-muted">{highlight.label}</p>
              <p className={`text-sm font-medium ${valueClass(highlight.severity)}`}>
                {highlight.value}
              </p>
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onViewFullBriefing}
        className="text-xs font-medium text-accent hover:text-accent/80"
      >
        View full race briefing → Dashboard
      </button>
    </section>
  );
}
