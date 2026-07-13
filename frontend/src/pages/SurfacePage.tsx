import { useMemo } from "react";
import type { AppTab, RoadbookResult } from "../api";
import { buildSurfaceCategoryBreakdown } from "../planning/surfaceBreakdown";
import { buildSurfaceEquipmentRecommendations } from "../planning/surfaceEquipmentRecommendations";
import { surfaceExploreIntent } from "../planning/planningIntent";
import { usePlanning } from "../planning/PlanningContext";
import SurfaceInsightCards from "../components/SurfaceInsightCards";
import SurfaceDistributionBar from "../components/surface/SurfaceDistributionBar";
import SurfaceEquipmentRecommendations from "../components/surface/SurfaceEquipmentRecommendations";

interface SurfacePageProps {
  result: RoadbookResult;
  onNavigate: (tab: AppTab) => void;
}

export default function SurfacePage({ result, onNavigate }: SurfacePageProps) {
  const { setPlanningIntent } = usePlanning();

  const categories = useMemo(
    () => buildSurfaceCategoryBreakdown(result.route, result.summary.distance_km),
    [result.route, result.summary.distance_km],
  );

  const insights = result.surface_insights ?? [];

  const recommendations = useMemo(
    () => buildSurfaceEquipmentRecommendations(categories, insights),
    [categories, insights],
  );

  function handleExploreOnRoute() {
    setPlanningIntent(surfaceExploreIntent({}));
    onNavigate("route");
  }

  function handleExploreInsight(insight: (typeof insights)[number]) {
    setPlanningIntent(
      surfaceExploreIntent({
        surfaceCategory: insight.category,
        startKm: insight.start_km,
        endKm: insight.end_km,
        label: insight.label,
      }),
    );
    onNavigate("route");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-10 px-6 py-10">
      <header>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">Surface</h2>
        <p className="mt-1 text-sm text-muted">
          What equipment should I prepare for this route?
        </p>
      </header>

      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-medium text-ink">Surface mix</h3>
          <p className="mt-1 text-sm text-muted">Percentage of each surface type on the route.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {categories.map((row) => (
            <div
              key={row.riderCategory}
              className="rounded-xl border border-line/40 bg-white p-4"
            >
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: row.color }} />
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                  {row.label}
                </p>
              </div>
              <p className="mt-2 text-3xl font-semibold tabular-nums text-ink">{row.percentage}%</p>
              <p className="mt-1 text-sm text-muted">{row.distanceKm.toFixed(0)} km</p>
            </div>
          ))}
        </div>
      </section>

      <SurfaceDistributionBar categories={categories} />

      <SurfaceInsightCards insights={insights} onExplore={handleExploreInsight} />

      <SurfaceEquipmentRecommendations recommendations={recommendations} />

      <section className="rounded-xl border border-line/40 bg-canvas/30 px-4 py-4">
        <p className="text-sm text-muted">
          Want to inspect gravel or trail sections on the map?
        </p>
        <button
          type="button"
          onClick={handleExploreOnRoute}
          className="mt-2 text-sm font-medium text-accent hover:text-accent/80"
        >
          Open route with surface overlay →
        </button>
      </section>
    </div>
  );
}
