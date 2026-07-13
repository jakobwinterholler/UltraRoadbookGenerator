import { useEffect, useMemo, useRef } from "react";
import { useCompanion } from "../context/CompanionContext";
import { buildResupplyTimeline, formatKm } from "../lib/utils";
import StopSheet from "../components/StopSheet";

export default function ResupplyScreen() {
  const listRef = useRef<HTMLDivElement | null>(null);
  const {
    bundle,
    currentKm,
    setCurrentKm,
    selectedStop,
    selectStop,
    showUnverified,
    setShowUnverified,
  } = useCompanion();

  const timeline = useMemo(
    () => buildResupplyTimeline(bundle, showUnverified),
    [bundle, showUnverified],
  );

  const nextIndex = useMemo(
    () => timeline.findIndex((entry) => entry.km >= currentKm - 0.5),
    [timeline, currentKm],
  );

  useEffect(() => {
    if (nextIndex < 0 || !listRef.current) {
      return;
    }
    const row = listRef.current.querySelector(`[data-index="${nextIndex}"]`);
    row?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [currentKm, nextIndex]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-white/10 px-4 py-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <label className="block text-xs text-white/45">Current km</label>
          <label className="inline-flex items-center gap-2 text-xs text-white/55">
            <input
              type="checkbox"
              checked={showUnverified}
              onChange={(event) => setShowUnverified(event.target.checked)}
              className="accent-emerald-500"
            />
            Unverified
          </label>
        </div>
        <input
          type="number"
          min={0}
          max={Math.ceil(bundle.race.distanceKm)}
          step={1}
          value={Math.round(currentKm)}
          onChange={(event) => setCurrentKm(Number(event.target.value))}
          className="mt-1 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-lg tabular-nums text-white outline-none focus:border-emerald-400/50"
        />
      </div>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {timeline.map((entry, index) => {
          const isPast = entry.km < currentKm - 0.25;
          const isNext = index === nextIndex;

          if (entry.kind === "stop") {
            const { stop } = entry;
            return (
              <button
                key={`stop-${stop.zoneId}`}
                type="button"
                data-index={index}
                onClick={() => selectStop(stop)}
                className={`mb-1 flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition ${
                  isNext
                    ? "bg-emerald-500/15 ring-1 ring-emerald-400/35"
                    : "hover:bg-white/5"
                } ${isPast ? "opacity-45" : ""}`}
              >
                <p className="w-14 shrink-0 pt-0.5 text-sm tabular-nums text-white/50">
                  {formatKm(stop.km)}
                </p>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm font-medium text-white">
                    {stop.verificationStatus === "verified" ? (
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white">
                        ✓
                      </span>
                    ) : (
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-white/30 text-[10px] text-white/70">
                        ○
                      </span>
                    )}
                    <span className="truncate">{stop.icon} {stop.name}</span>
                  </p>
                  <p className="mt-0.5 truncate text-xs text-white/45">{stop.categoryLabel}</p>
                </div>
              </button>
            );
          }

          return (
            <div
              key={`unsupported-${entry.section.id}`}
              data-index={index}
              className={`mb-1 flex items-start gap-3 rounded-xl px-3 py-3 ${
                isNext ? "bg-amber-500/10 ring-1 ring-amber-400/30" : ""
              } ${isPast ? "opacity-45" : ""}`}
            >
              <p className="w-14 shrink-0 pt-0.5 text-sm tabular-nums text-white/50">
                {formatKm(entry.km)}
              </p>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-amber-200">
                  ⚠ {entry.section.displayLabel}
                </p>
                <p className="mt-0.5 text-xs text-white/45">
                  {formatKm(entry.section.distanceKm)} unsupported
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <StopSheet
        stop={selectedStop}
        totalKm={bundle.race.distanceKm}
        onClose={() => selectStop(null)}
      />
    </div>
  );
}
