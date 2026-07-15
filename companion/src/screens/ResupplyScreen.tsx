import { useEffect, useMemo, useRef, useState } from "react";
import { useCompanion } from "../context/CompanionContext";
import { buildResupplyCards, formatKm } from "../lib/utils";
import { readResupplyFilter, writeResupplyFilter, type ResupplyFilter } from "../lib/resupplyFilter";
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
  const { bundle, currentKm, selectedStop, selectStop } = useCompanion();
  const [filter, setFilter] = useState<ResupplyFilter>(() => readResupplyFilter());
  const [selectedSection, setSelectedSection] = useState<CompanionUnsupportedSection | null>(null);

  const cards = useMemo(
    () => buildResupplyCards(bundle, filter === "verified"),
    [bundle, filter],
  );

  const nextIndex = useMemo(
    () => cards.findIndex((entry) => entry.stop.km >= currentKm - 0.5),
    [cards, currentKm],
  );

  useEffect(() => {
    writeResupplyFilter(filter);
  }, [filter]);

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

        <div className="mt-3 flex gap-2">
          {(["all", "verified"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`min-h-[44px] flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                filter === value
                  ? "bg-sky-500/20 text-sky-100 ring-1 ring-sky-400/35"
                  : "bg-white/5 text-white/55"
              }`}
            >
              {value === "all" ? "All stops" : "Verified only"}
            </button>
          ))}
        </div>

        {nextIndex >= 0 ? (
          <p className="mt-2 text-sm text-sky-200">
            Next: {cards[nextIndex].stop.icon} {cards[nextIndex].stop.name}
          </p>
        ) : null}
      </header>

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {cards.map((entry, index) => {
          const { stop, gapBefore } = entry;
          const isPast = stop.km < currentKm - 0.25;
          const isNext = index === nextIndex;

          return (
            <div key={`card-${stop.zoneId}`} data-index={index}>
              {gapBefore ? (
                <div className="mb-2 flex items-center gap-2 px-1 py-1 text-xs text-white/40">
                  <span className="tabular-nums">{formatKm(gapBefore.distanceKm)}</span>
                  <span aria-hidden>·</span>
                  <span className="tabular-nums">+{gapBefore.elevationGainM} m</span>
                  {gapBefore.unsupportedLabel ? (
                    <>
                      <span aria-hidden>·</span>
                      <button
                        type="button"
                        onClick={() => {
                          const section = bundle.unsupportedSections.find(
                            (item) => item.displayLabel === gapBefore.unsupportedLabel,
                          );
                          if (section) {
                            setSelectedSection(section);
                          }
                        }}
                        className="text-left text-amber-300/90 underline-offset-2 hover:underline"
                      >
                        Unsupported section
                      </button>
                    </>
                  ) : null}
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => selectStop(stop)}
                className={`mb-3 flex min-h-[72px] w-full flex-col rounded-2xl border px-4 py-4 text-left transition ${
                  isNext
                    ? "border-sky-400/35 bg-sky-500/12"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
                } ${isPast ? "opacity-60" : ""}`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl leading-none" aria-hidden>
                    {stop.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-base font-semibold text-white">
                      <VerificationBadge status={stop.verificationStatus} />
                      <span className="truncate">{stop.name}</span>
                    </p>
                    <p className="mt-0.5 truncate text-sm text-white/45">{stop.categoryLabel}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums text-white/70">{formatKm(stop.km)}</p>
                    {isNext ? (
                      <span className="mt-1 inline-block rounded-full bg-sky-500/20 px-2 py-0.5 text-[10px] font-semibold text-sky-200">
                        Next
                      </span>
                    ) : null}
                  </div>
                </div>
              </button>
            </div>
          );
        })}
      </div>

      <StopSheet
        stop={selectedStop}
        bundle={bundle}
        onClose={() => selectStop(null)}
        onSelectAlternative={selectStop}
      />
      <UnsupportedSectionSheet
        section={selectedSection}
        bundle={bundle}
        onClose={() => setSelectedSection(null)}
      />
    </div>
  );
}
