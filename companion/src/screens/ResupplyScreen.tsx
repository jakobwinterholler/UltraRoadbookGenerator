import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatRidingTime } from "@shared/race/riderAssumptions";
import { useCompanion } from "../context/CompanionContext";
import { buildResupplyCards, formatKm } from "../lib/utils";
import { readResupplyFilter, writeResupplyFilter, type ResupplyFilter } from "../lib/resupplyFilter";
import StopSheet from "../components/StopSheet";
import UnsupportedSectionSheet from "../components/UnsupportedSectionSheet";
import ResupplyElevationProfile from "../components/ResupplyElevationProfile";
import { GpsStatusBadge } from "../components/GpsStatusBadge";
import type { CompanionStop, CompanionUnsupportedSection } from "../types";

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


function ResupplyGapRow({
  gap,
  onUnsupportedClick,
}: {
  gap: NonNullable<ReturnType<typeof buildResupplyCards>[number]["gapBefore"]>;
  onUnsupportedClick: () => void;
}) {
  return (
    <div className="my-2 flex flex-col items-center gap-0.5 py-1 text-center text-xs text-white/35">
      <div className="h-px w-full max-w-[12rem] bg-white/10" aria-hidden />
      <p className="tabular-nums">{formatKm(gap.distanceKm)}</p>
      <p className="tabular-nums">+{gap.elevationGainM} m</p>
      <p className="tabular-nums">-{gap.elevationLossM} m</p>
      <p className="tabular-nums">{formatRidingTime(gap.ridingTimeHours)}</p>
      {gap.unsupportedLabel ? (
        <button
          type="button"
          onClick={onUnsupportedClick}
          className="mt-0.5 text-amber-300/80 underline-offset-2 hover:underline"
        >
          Unsupported section
        </button>
      ) : null}
      <div className="h-px w-full max-w-[12rem] bg-white/10" aria-hidden />
    </div>
  );
}

export default function ResupplyScreen() {
  const listRef = useRef<HTMLDivElement | null>(null);
  const userScrollingRef = useRef(false);
  const scrollIdleTimerRef = useRef<number | null>(null);
  const { bundle, currentKm, gps, selectedStop, selectStop } = useCompanion();
  const [filter, setFilter] = useState<ResupplyFilter>(() => readResupplyFilter());
  const [selectedSection, setSelectedSection] = useState<CompanionUnsupportedSection | null>(null);
  const [focusedStop, setFocusedStop] = useState<CompanionStop | null>(null);

  const cards = useMemo(
    () => buildResupplyCards(bundle, filter === "verified"),
    [bundle, filter],
  );

  const nextIndex = useMemo(
    () => cards.findIndex((entry) => entry.stop.km >= currentKm - 0.5),
    [cards, currentKm],
  );

  const riderKm = useMemo(() => {
    const gpsActive =
      gps.status === "active" ||
      (gps.status === "degraded" && Number.isFinite(gps.currentKm));
    if (gpsActive) {
      return currentKm;
    }
    if (selectedStop) {
      return selectedStop.km;
    }
    return currentKm;
  }, [currentKm, gps.currentKm, gps.status, selectedStop]);

  const focusKm = focusedStop?.km ?? null;

  useEffect(() => {
    writeResupplyFilter(filter);
  }, [filter]);

  useEffect(() => {
    if (cards.length === 0) {
      setFocusedStop(null);
      return;
    }
    if (nextIndex >= 0) {
      setFocusedStop(cards[nextIndex].stop);
    }
  }, [cards, nextIndex]);

  useEffect(() => {
    const list = listRef.current;
    if (!list || cards.length === 0) {
      return;
    }

    const rows = Array.from(list.querySelectorAll<HTMLElement>("[data-stop-index]"));
    if (rows.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio);
        if (visible.length === 0) {
          return;
        }
        const index = Number(visible[0].target.getAttribute("data-stop-index"));
        const stop = cards[index]?.stop;
        if (stop) {
          setFocusedStop(stop);
        }
      },
      {
        root: list,
        threshold: [0.35, 0.5, 0.65],
        rootMargin: "-20% 0px -45% 0px",
      },
    );

    for (const row of rows) {
      observer.observe(row);
    }

    return () => observer.disconnect();
  }, [cards]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) {
      return;
    }

    const markUserScroll = () => {
      userScrollingRef.current = true;
      if (scrollIdleTimerRef.current != null) {
        window.clearTimeout(scrollIdleTimerRef.current);
      }
      scrollIdleTimerRef.current = window.setTimeout(() => {
        userScrollingRef.current = false;
      }, 4000);
    };

    list.addEventListener("scroll", markUserScroll, { passive: true });
    list.addEventListener("touchstart", markUserScroll, { passive: true });

    return () => {
      list.removeEventListener("scroll", markUserScroll);
      list.removeEventListener("touchstart", markUserScroll);
      if (scrollIdleTimerRef.current != null) {
        window.clearTimeout(scrollIdleTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (nextIndex < 0 || !listRef.current || userScrollingRef.current) {
      return;
    }
    const row = listRef.current.querySelector(`[data-stop-index="${nextIndex}"]`);
    row?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [currentKm, nextIndex]);

  const handleStopTap = useCallback(
    (stop: CompanionStop) => {
      setFocusedStop(stop);
      selectStop(stop);
    },
    [selectStop],
  );

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

      <ResupplyElevationProfile bundle={bundle} riderKm={riderKm} focusKm={focusKm} />

      <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {cards.map((entry, index) => {
          const { stop, gapBefore } = entry;
          const isPast = stop.km < currentKm - 0.25;
          const isNext = index === nextIndex;
          const isFocused = focusedStop?.zoneId === stop.zoneId;

          return (
            <div key={`card-${stop.zoneId}`} data-stop-index={index}>
              {gapBefore ? (
                <ResupplyGapRow
                  gap={gapBefore}
                  onUnsupportedClick={() => {
                    const section = bundle.unsupportedSections.find(
                      (item) => item.displayLabel === gapBefore.unsupportedLabel,
                    );
                    if (section) {
                      setSelectedSection(section);
                    }
                  }}
                />
              ) : null}

              <button
                type="button"
                onClick={() => handleStopTap(stop)}
                className={`mb-3 flex min-h-[72px] w-full flex-col rounded-2xl border px-4 py-4 text-left transition ${
                  isNext || isFocused
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
