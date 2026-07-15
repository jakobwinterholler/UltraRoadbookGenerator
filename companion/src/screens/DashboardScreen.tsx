import { useMemo, useState } from "react";
import { verificationStatsLine } from "@shared/race/applyVerificationToBundle";
import { ReadinessReasonsList, ReadinessScoreBadge } from "@shared/ui/RaceReadinessDisplay";
import { formatRidingTime } from "@shared/race/riderAssumptions";
import { useCompanion } from "../context/CompanionContext";
import {
  estimatedRidingToStop,
  formatEstimatedArrival,
  nextResupplyStop,
  remainingStops,
  remainingUnsupportedKm,
  serviceLabels,
  unsupportedAfterKm,
} from "../lib/raceExecution";
import { buildResupplyTimeline, formatKm } from "../lib/utils";
import StopSheet from "../components/StopSheet";
import UnsupportedSectionSheet from "../components/UnsupportedSectionSheet";
import MapScreen from "./MapScreen";

export default function DashboardScreen() {
  const {
    bundle,
    currentKm,
    selectedStop,
    selectStop,
    showUnverified,
    setShowUnverified,
  } = useCompanion();
  const [selectedSection, setSelectedSection] = useState<
    import("../types").CompanionUnsupportedSection | null
  >(null);

  const nextStop = useMemo(
    () => nextResupplyStop(bundle, currentKm, showUnverified),
    [bundle, currentKm, showUnverified],
  );
  const nextUnsupported = useMemo(
    () => (nextStop ? unsupportedAfterKm(bundle, nextStop.km) : unsupportedAfterKm(bundle, currentKm)),
    [bundle, currentKm, nextStop],
  );
  const stats = bundle.dashboardStats;
  const verificationLine = useMemo(() => verificationStatsLine(bundle), [bundle]);
  const timeline = useMemo(
    () => buildResupplyTimeline(bundle, showUnverified).slice(0, 8),
    [bundle, showUnverified],
  );

  const ridingToNext = nextStop
    ? estimatedRidingToStop(bundle, currentKm, nextStop.km)
    : null;
  const arrivalTime = formatEstimatedArrival(ridingToNext);

  const distanceRemaining = Math.max(0, bundle.race.distanceKm - currentKm);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <section className="border-b border-white/10 px-4 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-300/80">
              Right now
            </p>
            {stats ? (
              <div className="mt-2">
                <ReadinessScoreBadge score={stats.readinessScore} dark />
              </div>
            ) : null}
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 rounded-2xl border border-sky-400/20 bg-sky-500/10 p-4">
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-white/40">Current km</dt>
            <dd className="text-2xl font-semibold tabular-nums text-white">{formatKm(currentKm)}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-white/40">Remaining</dt>
            <dd className="text-2xl font-semibold tabular-nums text-white">
              {formatKm(distanceRemaining)}
            </dd>
          </div>
        </dl>
      </section>

      <section className="border-b border-white/10 px-4 py-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-300/80">
          Next resupply
        </p>
        {nextStop ? (
          <button
            type="button"
            onClick={() => selectStop(nextStop)}
            className="mt-3 w-full rounded-2xl border border-sky-400/25 bg-sky-500/10 p-4 text-left shadow-sm transition hover:bg-sky-500/15"
          >
            <p className="text-lg font-semibold text-white">
              {nextStop.icon} {nextStop.name}
            </p>
            <p className="mt-1 text-sm text-white/55">
              {formatKm(nextStop.km)} · {nextStop.openingHours ?? "Hours unknown"}
            </p>
            <p className="mt-2 text-sm text-white/70">{serviceLabels(nextStop)}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/50">
              <span>
                Confidence {nextStop.confidenceScore != null ? Math.round(nextStop.confidenceScore) : "—"}
              </span>
              <span>
                Ride ~{ridingToNext != null ? formatRidingTime(ridingToNext) : "—"}
              </span>
              {arrivalTime ? (
                <span className="col-span-2 text-white/65">
                  Est. arrival {arrivalTime}
                </span>
              ) : null}
              {nextUnsupported ? (
                <span className="col-span-2 text-amber-200/90">
                  Then {formatKm(nextUnsupported.distanceKm)} unsupported ({nextUnsupported.riskBand ?? nextUnsupported.riskLevel} risk)
                </span>
              ) : null}
            </div>
          </button>
        ) : (
          <p className="mt-3 text-sm text-white/50">No more resupply stops ahead.</p>
        )}
      </section>

      {stats ? (
        <section className="border-b border-white/10 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">
            Verification progress
          </p>
          <p className="mt-2 text-sm font-medium tabular-nums text-white/80">{verificationLine}</p>
          <dl className="mt-3 grid grid-cols-3 gap-3">
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-white/40">Verified</dt>
              <dd className="text-lg font-semibold tabular-nums text-white">{stats.verifiedStops}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-white/40">Remaining</dt>
              <dd className="text-lg font-semibold tabular-nums text-white">
                {remainingStops(bundle, currentKm, showUnverified)}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-wide text-white/40">Unsupported</dt>
              <dd className="text-lg font-semibold tabular-nums text-white">
                {Math.round(remainingUnsupportedKm(bundle, currentKm))} km
              </dd>
            </div>
          </dl>
          <ReadinessReasonsList
            reasons={stats.readinessReasons}
            compact
            dark
            className="mt-3"
          />
        </section>
      ) : null}

      <section className="border-b border-white/10 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">
            Resupply list
          </p>
          <label className="inline-flex items-center gap-2 text-xs text-white/55">
            <input
              type="checkbox"
              checked={showUnverified}
              onChange={(event) => setShowUnverified(event.target.checked)}
              className="accent-sky-500"
            />
            Unverified
          </label>
        </div>
        <ul className="mt-3 space-y-1">
          {timeline.map((entry) =>
            entry.kind === "stop" ? (
              <li key={`stop-${entry.stop.zoneId}`}>
                <button
                  type="button"
                  onClick={() => selectStop(entry.stop)}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-white/5"
                >
                  <span className="w-12 shrink-0 text-xs tabular-nums text-white/45">
                    {formatKm(entry.stop.km)}
                  </span>
                  <span className="truncate text-sm text-white">
                    {entry.stop.icon} {entry.stop.name}
                  </span>
                </button>
              </li>
            ) : (
              <li key={`gap-${entry.section.id}`}>
                <button
                  type="button"
                  onClick={() => setSelectedSection(entry.section)}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-white/5"
                >
                  <span className="w-12 shrink-0 text-xs tabular-nums text-white/45">
                    {formatKm(entry.km)}
                  </span>
                  <span className="truncate text-sm text-amber-200">⚠ {entry.section.displayLabel}</span>
                </button>
              </li>
            ),
          )}
        </ul>
      </section>

      <section className="px-4 py-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-white/40">Map</p>
        <div className="h-56 overflow-hidden rounded-2xl border border-white/10">
          <MapScreen embedded />
        </div>
      </section>

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
