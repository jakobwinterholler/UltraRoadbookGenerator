import type { ClimbDetectionConfig } from "../planning/types";
import {
  CLIMB_SENSITIVITY_OPTIONS,
  type ClimbSensitivity,
} from "../planning/climbSensitivity";

interface ClimbSensitivityControlProps {
  sensitivity: ClimbSensitivity;
  onSensitivityChange: (sensitivity: ClimbSensitivity) => void;
  climbConfig: ClimbDetectionConfig;
  onClimbConfigChange: (config: ClimbDetectionConfig) => void;
  onRecalculate: () => void;
  recalculating: boolean;
  showAdvanced: boolean;
  onToggleAdvanced: () => void;
}

export default function ClimbSensitivityControl({
  sensitivity,
  onSensitivityChange,
  climbConfig,
  onClimbConfigChange,
  onRecalculate,
  recalculating,
  showAdvanced,
  onToggleAdvanced,
}: ClimbSensitivityControlProps) {
  function updateField(field: keyof ClimbDetectionConfig, value: number) {
    onClimbConfigChange({ ...climbConfig, [field]: value });
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-ink">Climb sensitivity</p>
        <p className="mt-1 text-xs text-muted">
          How many climbs are detected. Normal matches the current default behaviour.
        </p>
      </div>

      <div className="flex flex-wrap gap-1">
        {CLIMB_SENSITIVITY_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onSensitivityChange(option.id)}
            className={`rounded-lg px-3 py-2 text-sm transition ${
              sensitivity === option.id ? "bg-accent text-white" : "bg-canvas text-ink hover:bg-line/40"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={recalculating}
          onClick={onRecalculate}
          className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-ink/90 disabled:opacity-60"
        >
          {recalculating ? "Recalculating..." : "Recalculate Climbs"}
        </button>
        <button
          type="button"
          onClick={onToggleAdvanced}
          className="text-sm font-medium text-muted hover:text-ink"
        >
          {showAdvanced ? "Hide advanced settings" : "Advanced settings"}
        </button>
      </div>

      {showAdvanced && (
        <div className="rounded-xl border border-dashed border-line bg-canvas/50 p-3">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted">
            Debug parameters
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["min_elevation_gain_m", "Minimum elevation gain (m)", 10, 500, 10],
                ["min_average_gradient_pct", "Minimum average gradient (%)", 0.5, 15, 0.5],
                ["meaningful_descent_threshold_m", "Meaningful descent threshold (m)", 10, 300, 5],
                ["smoothing_window_m", "Smoothing window (m)", 10, 500, 10],
                ["gradient_threshold_pct", "Gradient threshold (%)", 0.1, 10, 0.1],
                ["rolling_gradient_window_m", "Rolling gradient window (m)", 20, 1000, 10],
              ] as const
            ).map(([field, label, min, max, step]) => (
              <label key={field} className="block text-xs text-muted">
                {label}
                <input
                  type="number"
                  min={min}
                  max={max}
                  step={step}
                  value={climbConfig[field]}
                  onChange={(event) => updateField(field, Number(event.target.value))}
                  className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
                />
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
