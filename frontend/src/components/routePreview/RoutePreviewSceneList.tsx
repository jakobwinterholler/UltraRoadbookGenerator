import {
  routePreviewTypeEmoji,
  routePreviewTypeLabel,
} from "../../planning/routePreview/presentation";
import { formatPlaybackTime } from "../../routePreview/core/math";
import type { RoutePreviewRuntime, RoutePreviewTimelineEntry } from "../../routePreview/core/types";
import { learningGoalForScene } from "../../routePreview/core/sceneBeats";

interface RoutePreviewSceneListProps {
  runtime: RoutePreviewRuntime;
  timeline: RoutePreviewTimelineEntry[];
  activeSceneIndex: number;
  onSelectScene: (sceneId: string) => void;
}

export default function RoutePreviewSceneList({
  runtime,
  timeline,
  activeSceneIndex,
  onSelectScene,
}: RoutePreviewSceneListProps) {
  return (
    <section className="rounded-2xl border border-line bg-card shadow-card">
      <div className="border-b border-line px-5 py-4">
        <h2 className="text-lg font-semibold text-ink">Along the route</h2>
        <p className="mt-1 text-sm text-muted">
          Key moments as you ride through — jump to any section.
        </p>
      </div>
      <ul className="divide-y divide-line">
        {timeline.map((entry, index) => {
          const active = index === activeSceneIndex;
          return (
            <li key={entry.sceneId}>
              <button
                type="button"
                onClick={() => onSelectScene(entry.sceneId)}
                className={`flex w-full items-start gap-4 px-5 py-4 text-left transition hover:bg-canvas/70 ${
                  active ? "bg-canvas/80" : ""
                }`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-canvas text-lg">
                  {routePreviewTypeEmoji(entry.sceneType)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">
                      Scene {entry.sceneOrder}
                    </span>
                    <span className="rounded-full bg-canvas px-2.5 py-0.5 text-xs font-medium text-ink">
                      {routePreviewTypeLabel(entry.sceneType)}
                    </span>
                    {active ? (
                      <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-medium text-white">
                        Now playing
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-base font-semibold text-ink">{entry.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">
                    {learningGoalForScene(runtime, entry.sceneId) ?? entry.title}
                  </p>
                  <p className="mt-1 text-xs text-muted/80">
                    {formatPlaybackTime(entry.startS)} · {Math.round(entry.endS - entry.startS)}s
                  </p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
