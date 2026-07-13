import type { EquipmentRecommendation } from "../../planning/surfaceEquipmentRecommendations";

interface SurfaceEquipmentRecommendationsProps {
  recommendations: EquipmentRecommendation[];
}

const CATEGORY_LABEL: Record<EquipmentRecommendation["category"], string> = {
  tyres: "Tyres",
  bike: "Bike",
  pacing: "Pacing",
  general: "General",
};

const PRIORITY_STYLE: Record<EquipmentRecommendation["priority"], string> = {
  essential: "border-amber-200 bg-amber-50/60",
  consider: "border-line/60 bg-canvas/40",
  info: "border-line/40 bg-white",
};

export default function SurfaceEquipmentRecommendations({
  recommendations,
}: SurfaceEquipmentRecommendationsProps) {
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-medium text-ink">Equipment recommendations</h3>
        <p className="mt-1 text-sm text-muted">
          What to prepare based on this route&apos;s surface mix.
        </p>
      </div>

      <div className="space-y-3">
        {recommendations.map((item) => (
          <div
            key={item.id}
            className={`rounded-xl border p-4 ${PRIORITY_STYLE[item.priority]}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium text-ink">{item.title}</p>
              <span className="rounded-full bg-white/80 px-2 py-0.5 text-xs text-muted">
                {CATEGORY_LABEL[item.category]}
              </span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
