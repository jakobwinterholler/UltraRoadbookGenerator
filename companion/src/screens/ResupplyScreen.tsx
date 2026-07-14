import { useEffect, useMemo, useRef, useState } from "react";
import { useCompanion } from "../context/CompanionContext";
import { buildResupplyTimeline, formatKm } from "../lib/utils";
import StopSheet from "../components/StopSheet";
import UnsupportedSectionSheet from "../components/UnsupportedSectionSheet";
import { GpsStatusBadge } from "../components/GpsStatusBadge";
import type { CompanionUnsupportedSection } from "../types";

function VerificationBadge({ status }: { status: string }) {
  if (status === "verified") {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">
        ✓
      </span>
    );
  }
  if (status === "needs_review" || status === "pending") {
    return (
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
        !
      </span>
    );
  }
  return null;
}

export default function ResupplyScreen() {
  const listRef = useRef<HTMLDivElement | null>(null);
  const {
    bundle,
    currentKm,
    selectedStop,
    selectStop,
    showUnverified,
  } = useCompanion();
  const [selectedSection, setSelectedSection] = useState<CompanionUnsupportedSection | null>(null);

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
      <header className="shrink-0 border-b border-white/8 px-4 pb-3 pt-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">Resupply</p>
            <p className="mt-0.5 text-2xl font-semibold tabular-nums text-white">{formatKm(currentKm)}</p>
          </div>
          <GpsStatusBadge />
        </div>
        {nextIndex >= 0 && timeline[nextIndex]?.kind === "stop" ? (
          <p className="mt-2 text-sm text-sky-200">
            Next: {timeline[nextIndex].stop.icon} {timeline[nextIndex].stop.name}
          </p>
        ) : null}
      </header>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
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
                className={`mb-2 flex min-h-[56px] w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition ${
                  isNext
                    ? "bg-sky-500/15 ring-1 ring-sky-400/35"
                    : "hover:bg-white/5"
                } ${isPast ? "opacity-60" : ""}`}
              >
                <p className="w-16 shrink-0 text-sm font-medium tabular-nums text-white/50">
                  {formatKm(stop.km)}
                </p>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-base font-medium text-white">
                    <VerificationBadge status={stop.verificationStatus} />
                    <span className="truncate">
                      {stop.icon} {stop.name}
                    </span>
                  </p>
                  <p className="mt-0.5 truncate text-sm text-white/45">{stop.categoryLabel}</p>
                </div>
                {isNext ? (
                  <span className="shrink-0 rounded-full bg-sky-500/20 px-2.5 py-1 text-[11px] font-semibold text-sky-200">
                    Next
                  </span>
                ) : null}
              </button>
            );
          }

          return (
            <button
              key={`section-${entry.section.id}`}
              type="button"
              data-index={index}
              onClick={() => setSelectedSection(entry.section)}
              className={`mb-2 flex min-h-[56px] w-full items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition hover:bg-white/5 ${
                isNext ? "bg-amber-500/10 ring-1 ring-amber-400/30" : ""
              } ${isPast ? "opacity-45" : ""}`}
            >
              <p className="w-16 shrink-0 text-sm font-medium tabular-nums text-white/50">
                {formatKm(entry.km)}
              </p>
              <div className="min-w-0 flex-1">
                <p className="text-base font-medium text-amber-200">
                  ⚠ {entry.section.displayLabel}
                </p>
                <p className="mt-0.5 text-sm text-white/45">
                  {formatKm(entry.section.distanceKm)} unsupported
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <StopSheet
        stop={selectedStop}
        totalKm={bundle.race.distanceKm}
        routeCoordinates={bundle.route.coordinates}
        onClose={() => selectStop(null)}
      />
      <UnsupportedSectionSheet
        section={selectedSection}
        bundle={bundle}
        onClose={() => setSelectedSection(null)}
      />
    </div>
  );
}
