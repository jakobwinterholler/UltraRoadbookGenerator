import type { SurfaceInsight } from "../api";
import { surfaceInsightDetail } from "../planning/surfaceBreakdown";

interface SurfaceInsightCardsProps {
  insights: SurfaceInsight[];
  onExplore?: (insight: SurfaceInsight) => void;
}

export default function SurfaceInsightCards({ insights, onExplore }: SurfaceInsightCardsProps) {
  if (insights.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-medium text-ink">Key insights</h3>
        <p className="mt-1 text-sm text-muted">
          Longest sections that affect pacing and equipment choices.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {insights.map((insight) => (
          <div
            key={insight.id}
            className="rounded-xl border border-line/40 bg-white p-4"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              {insight.label}
            </p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-ink">
              {insight.length_km.toFixed(1)} km
            </p>
            <p className="mt-1 text-sm text-muted">{surfaceInsightDetail(insight)}</p>
            {onExplore && (
              <button
                type="button"
                onClick={() => onExplore(insight)}
                className="mt-3 text-sm font-medium text-accent hover:text-accent/80"
              >
                Explore on route map →
              </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
