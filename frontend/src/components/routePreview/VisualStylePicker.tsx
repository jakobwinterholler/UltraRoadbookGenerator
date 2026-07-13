import type { RoutePreviewVisualStyle } from "../../routePreview/engine/visualStyles";
import {
  DEFAULT_VISUAL_STYLE,
  PROTOTYPE_EVAL_QUESTIONS,
  VISUAL_STYLE_OPTIONS,
} from "../../routePreview/engine/visualStyles";

interface VisualStylePickerProps {
  value: RoutePreviewVisualStyle;
  onChange: (style: RoutePreviewVisualStyle) => void;
  disabled?: boolean;
}

export default function VisualStylePicker({ value, onChange, disabled }: VisualStylePickerProps) {
  return (
    <div className="rounded-2xl border border-line bg-card p-4 shadow-card">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-ink">Visual experiments (not final)</h3>
        <p className="mt-1 text-xs leading-relaxed text-muted">
          Same route and playback — switch A/B/C and ask whether each one{" "}
          <span className="font-medium text-ink/80">teaches the race</span>, not which looks
          coolest. No winner yet.
        </p>
        <ul className="mt-3 space-y-1 text-xs text-muted">
          {PROTOTYPE_EVAL_QUESTIONS.map((question) => (
            <li key={question} className="flex gap-2">
              <span className="text-ink/40">·</span>
              <span>{question}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {VISUAL_STYLE_OPTIONS.map((option) => {
          const active = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              onClick={() => onChange(option.id)}
              className={`rounded-xl border px-3 py-3 text-left transition ${
                active
                  ? "border-violet-400 bg-violet-50 ring-1 ring-violet-300"
                  : "border-line bg-canvas/50 hover:border-line/80 hover:bg-canvas"
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold ${
                    active ? "bg-violet-600 text-white" : "bg-white text-ink ring-1 ring-line"
                  }`}
                >
                  {option.label}
                </span>
                <span className="text-sm font-semibold text-ink">{option.title}</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted">{option.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { DEFAULT_VISUAL_STYLE };
