import type { PrepareStep } from "./routePreviewPrepare";
import { statusIcon } from "./routePreviewPrepare";

interface RoutePreviewGeneratePanelProps {
  raceName: string;
  onGenerate: () => void;
  disabled?: boolean;
}

export default function RoutePreviewGeneratePanel({
  raceName,
  onGenerate,
  disabled,
}: RoutePreviewGeneratePanelProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-card shadow-card">
      <div className="flex aspect-video flex-col items-center justify-center bg-gradient-to-b from-[#0a0f14] to-[#121820] px-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
          Route Preview
        </p>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-white md:text-3xl">
          {raceName}
        </h2>
        <button
          type="button"
          onClick={onGenerate}
          disabled={disabled}
          className="mt-8 rounded-2xl bg-violet-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-violet-900/30 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          ▶ Generate Route Preview
        </button>
        <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/55">
          We&apos;ll analyze your race and build a flythrough you can watch anytime.
        </p>
      </div>
    </section>
  );
}

function friendlyProgressMessage(steps: PrepareStep[]): string {
  const running = steps.find((step) => step.status === "running");
  if (!running) {
    const complete = steps.every((step) => step.status === "complete");
    if (complete) {
      return "Your preview is ready.";
    }
    return "Starting…";
  }
  switch (running.id) {
    case "story":
      return "Analyzing your race…";
    case "scenes":
      return "Mapping the route…";
    case "terrain":
      return "Building the preview…";
    default:
      return "Generating your preview…";
  }
}

interface RoutePreviewProgressPanelProps {
  steps: PrepareStep[];
  etaLabel: string | null;
  error: string | null;
  onRetry?: () => void;
}

export function RoutePreviewProgressPanel({
  steps,
  etaLabel,
  error,
  onRetry,
}: RoutePreviewProgressPanelProps) {
  const running = steps.find((step) => step.status === "running");
  const completeCount = steps.filter((step) => step.status === "complete").length;
  const progressPct = running
    ? Math.min(95, Math.round((completeCount / Math.max(steps.length, 1)) * 100) + 8)
    : Math.round((completeCount / Math.max(steps.length, 1)) * 100);

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-card shadow-card">
      <div className="flex aspect-video flex-col items-center justify-center bg-gradient-to-b from-[#0a0f14] to-[#121820] px-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
          Generating preview
        </p>
        <h2 className="mt-3 text-xl font-semibold text-white md:text-2xl">
          {error ? "Something went wrong" : friendlyProgressMessage(steps)}
        </h2>

        {!error ? (
          <>
            <div className="mt-8 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-violet-500 transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            {etaLabel ? <p className="mt-4 text-sm text-white/50">{etaLabel}</p> : null}
          </>
        ) : null}

        {error ? (
          <div className="mt-6 max-w-md space-y-4">
            <p className="text-sm text-red-300">{error}</p>
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black"
              >
                Try again
              </button>
            ) : null}
          </div>
        ) : (
          <ul className="mt-10 hidden space-y-2" aria-hidden>
            {steps.map((step) => (
              <li key={step.id} className="flex items-center gap-3 text-sm text-white/80">
                <span className="w-6 text-center text-base">{statusIcon(step.status)}</span>
                <span>{step.label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

interface RoutePreviewPlayerChromeProps {
  isStale: boolean;
  onRegenerate: () => void;
  regenerating?: boolean;
}

export function RoutePreviewPlayerChrome({
  isStale,
  onRegenerate,
  regenerating,
}: RoutePreviewPlayerChromeProps) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-3 md:p-4">
      {isStale ? (
        <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-amber-300/60 bg-amber-950/80 px-3 py-1.5 text-xs font-medium text-amber-100 backdrop-blur-sm">
          <span>Preview out of date</span>
          <button
            type="button"
            onClick={onRegenerate}
            disabled={regenerating}
            className="rounded-full bg-amber-100 px-2.5 py-0.5 font-semibold text-amber-950 transition hover:bg-white disabled:opacity-50"
          >
            {regenerating ? "…" : "Regenerate"}
          </button>
        </div>
      ) : (
        <span />
      )}
      <button
        type="button"
        onClick={onRegenerate}
        disabled={regenerating}
        className="pointer-events-auto rounded-full border border-white/15 bg-black/50 px-3 py-1.5 text-xs font-medium text-white/80 backdrop-blur-sm transition hover:bg-black/70 disabled:opacity-50"
      >
        {regenerating ? "Regenerating…" : "🔄 Regenerate Preview"}
      </button>
    </div>
  );
}
