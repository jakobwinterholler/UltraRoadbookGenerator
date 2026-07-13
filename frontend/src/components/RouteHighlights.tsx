import type { RouteHighlight } from "../planning/routeHighlights";

interface RouteHighlightsProps {
  highlights: RouteHighlight[];
}

const severityStyles: Record<RouteHighlight["severity"], string> = {
  info: "border-line bg-card",
  warning: "border-amber-200 bg-amber-50/70",
  danger: "border-red-200 bg-red-50/80",
};

export default function RouteHighlights({ highlights }: RouteHighlightsProps) {
  if (highlights.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-ink">What matters on this route</h3>
        <p className="mt-1 text-sm text-muted">
          The biggest factors that will shape your ride — read in 10 seconds.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {highlights.map((highlight) => (
          <div
            key={highlight.id}
            className={`rounded-2xl border p-4 shadow-card ${severityStyles[highlight.severity]}`}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              <span className="mr-1.5" aria-hidden>
                {highlight.emoji}
              </span>
              {highlight.label}
            </p>
            <p className="mt-2 text-xl font-semibold tracking-tight text-ink">{highlight.value}</p>
            <p className="mt-1 text-sm text-muted">{highlight.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
