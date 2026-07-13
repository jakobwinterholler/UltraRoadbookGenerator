import type { RoutePreviewScene } from "../../planning/routePreview/types";
import {
  formatKmRange,
  routePreviewTypeEmoji,
  routePreviewTypeLabel,
} from "../../planning/routePreview/presentation";

interface RoutePreviewSceneRowProps {
  scene: RoutePreviewScene;
}

export default function RoutePreviewSceneRow({ scene }: RoutePreviewSceneRowProps) {
  return (
    <article className="rounded-2xl border border-line bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-canvas text-lg">
          {routePreviewTypeEmoji(scene.type)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              Scene {scene.order}
            </span>
            <span className="rounded-full bg-canvas px-2.5 py-0.5 text-xs font-medium text-ink">
              {routePreviewTypeLabel(scene.type)}
            </span>
            <span className="text-xs text-muted">
              {formatKmRange(scene.kmRange.startKm, scene.kmRange.endKm)}
            </span>
          </div>
          <h3 className="mt-2 text-lg font-semibold tracking-tight text-ink">{scene.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted">{scene.description}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Screen time</p>
          <p className="mt-1 text-sm font-semibold tabular-nums text-ink">{scene.screenTimeS}s</p>
        </div>
      </div>
      <div className="mt-4 rounded-xl bg-canvas/70 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted">Why chosen</p>
        <p className="mt-1 text-sm leading-relaxed text-ink">{scene.whyChosen}</p>
      </div>
    </article>
  );
}
