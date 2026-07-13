import { usePlanning } from "../planning/PlanningContext";
import { TIMELINE_LAYER_OPTIONS } from "../planning/timelineLayers";

export default function TimelineLayerControls() {
  const { timelineLayers, setTimelineLayers } = usePlanning();

  return (
    <div className="rounded-2xl border border-line bg-card p-3 shadow-card">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
        Timeline layers
      </p>
      <div className="flex flex-wrap gap-1">
        {TIMELINE_LAYER_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() =>
              setTimelineLayers({ ...timelineLayers, [option.key]: !timelineLayers[option.key] })
            }
            className={`rounded-lg px-3 py-1.5 text-sm transition ${
              timelineLayers[option.key] ? "bg-accent text-white" : "bg-canvas text-ink"
            }`}
          >
            {timelineLayers[option.key] ? "✓ " : ""}
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
