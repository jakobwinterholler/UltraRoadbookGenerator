import { useAuth } from "@shared/auth/AuthProvider";
import type { CompanionVerificationUpdates } from "@shared/types/verification";
import type { CompanionBundle, CompanionStop } from "../types";
import { formatKm, googleMapsUrl, googleStreetViewUrl } from "../lib/utils";
import { stopStatusLabel } from "../lib/raceExecution";
import { normalizeWebsite } from "@shared/race/streetViewUrl";
import { buildStopAlternatives } from "../lib/nearbyStopAlternatives";
import { useVerificationActions } from "../lib/useVerificationActions";
import RouteMapView from "./RouteMapView";
import BottomSheet from "./BottomSheet";
import UndoToast from "./UndoToast";

interface StopSheetProps {
  stop: CompanionStop | null;
  bundle: CompanionBundle;
  onClose: () => void;
  onSelectAlternative?: (stop: CompanionStop) => void;
}

function statusBadgeClass(status: CompanionStop["verificationStatus"]): string {
  if (status === "verified") {
    return "bg-emerald-500/15 text-emerald-200 ring-emerald-400/30";
  }
  if (status === "pending" || status === "needs_review") {
    return "bg-amber-500/15 text-amber-200 ring-amber-400/30";
  }
  return "bg-white/8 text-white/60 ring-white/15";
}

function canVerifyStop(status: CompanionStop["verificationStatus"]): boolean {
  return status !== "verified";
}

function updatesForVerify(): CompanionVerificationUpdates {
  return { status: "verified" };
}

function updatesForSkip(): CompanionVerificationUpdates {
  return {
    status: "rejected",
    rejectReason: "could_not_verify",
  };
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Back to list"
      className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full text-white/80 transition active:bg-white/10"
    >
      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

export default function StopSheet({
  stop,
  bundle,
  onClose,
  onSelectAlternative,
}: StopSheetProps) {
  const { user } = useAuth();
  const { submitVerification, undo, performUndo } = useVerificationActions(user?.id ?? null);
  const totalKm = bundle.race.distanceKm;
  const streetViewOptions = {
    routeCoordinates: bundle.route.coordinates,
    totalDistanceKm: totalKm,
  };
  const alternatives = stop ? buildStopAlternatives(stop, bundle.stops) : [];
  const showVerifyActions = stop ? canVerifyStop(stop.verificationStatus) : false;

  async function handleVerify() {
    if (!stop) {
      return;
    }
    await submitVerification(stop, {
      ...updatesForVerify(),
      category: stop.category,
    });
    onClose();
  }

  async function handleSkip() {
    if (!stop) {
      return;
    }
    await submitVerification(stop, {
      ...updatesForSkip(),
      category: stop.category,
    });
    onClose();
  }

  return (
    <>
      <BottomSheet open={stop !== null} onClose={onClose}>
        {stop ? (
          <div className="space-y-5 pb-1">
            <div className="-mx-5 flex items-center gap-1 border-b border-white/8 px-3 pb-3">
              <BackButton onClick={onClose} />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white/75">
                Back to list
              </span>
            </div>

            <div>
              <div className="flex items-start gap-3">
                <span className="text-4xl leading-none" aria-hidden>
                  {stop.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-semibold leading-snug text-white">{stop.name}</h2>
                  <p className="mt-0.5 text-sm text-white/55">{stop.categoryLabel}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusBadgeClass(stop.verificationStatus)}`}
                >
                  {stopStatusLabel(stop.verificationStatus)}
                </span>
                <span className="text-sm tabular-nums text-white/50">
                  {formatKm(stop.km)} · {formatKm(Math.max(0, totalKm - stop.km))} left
                </span>
              </div>
            </div>

            <div className="relative h-44 overflow-hidden rounded-2xl border border-white/10">
              <RouteMapView embedded />
            </div>

            {alternatives.length > 0 ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">
                  Nearby alternatives
                </p>
                <ul className="mt-2 space-y-2">
                  {alternatives.map((alternative) => (
                    <li key={alternative.key}>
                      <button
                        type="button"
                        onClick={() => {
                          if (alternative.stop) {
                            onSelectAlternative?.(alternative.stop);
                          } else if (alternative.alternative) {
                            onSelectAlternative?.({
                              ...stop,
                              zoneId: stop.zoneId,
                              osmId: alternative.alternative.osmId,
                              osmType: alternative.alternative.osmType,
                              name: alternative.alternative.name,
                              category: alternative.alternative.category,
                              categoryLabel: alternative.alternative.categoryLabel,
                              icon: alternative.alternative.icon,
                              lat: alternative.alternative.lat,
                              lon: alternative.alternative.lon,
                              distanceOffRouteM: alternative.alternative.distanceOffRouteM,
                              confidenceScore: alternative.alternative.score,
                              verificationStatus: alternative.alternative.verificationStatus,
                              openingHours: alternative.alternative.openingHours,
                              phone: alternative.alternative.phone,
                              website: alternative.alternative.website,
                              placeId: alternative.alternative.placeId,
                              alternatives: stop.alternatives,
                            });
                          }
                        }}
                        className="flex min-h-[48px] w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left transition active:bg-white/8"
                      >
                        <span className="text-xl" aria-hidden>
                          {alternative.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-white">
                            {alternative.name}
                          </p>
                          <p className="truncate text-xs text-white/45">
                            {alternative.categoryLabel} · {alternative.distanceLabel}
                            {alternative.score != null ? ` · score ${Math.round(alternative.score)}` : ""}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            alternative.verificationStatus === "verified"
                              ? "bg-emerald-500/20 text-emerald-200"
                              : "bg-white/10 text-white/50"
                          }`}
                        >
                          {alternative.verificationStatus === "verified" ? "✓" : "?"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <a
              href={googleStreetViewUrl(stop, streetViewOptions)}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-sky-500 px-4 py-3.5 text-base font-bold text-white shadow-lg shadow-sky-500/25 transition active:scale-[0.98]"
            >
              <span aria-hidden>👁</span>
              Open Street View
            </a>

            {showVerifyActions ? (
              <div className="verification-primary-actions">
                <button
                  type="button"
                  className="verification-primary-btn verification-primary-btn--verify"
                  onClick={() => void handleVerify()}
                >
                  ✓ Verify
                </button>
                <button
                  type="button"
                  className="verification-primary-btn verification-primary-btn--skip"
                  onClick={() => void handleSkip()}
                >
                  Skip
                </button>
              </div>
            ) : (
              <p className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-center text-sm font-medium text-emerald-200">
                This stop is already verified
              </p>
            )}

            <div className="grid grid-cols-3 gap-2">
              <a
                href={googleMapsUrl(stop.lat, stop.lon, stop.placeId)}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-[44px] items-center justify-center rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm font-semibold text-white/90 transition active:bg-white/10"
              >
                Maps
              </a>
              {stop.website ? (
                <a
                  href={normalizeWebsite(stop.website)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-[44px] items-center justify-center rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm font-semibold text-white/90 transition active:bg-white/10"
                >
                  Website
                </a>
              ) : (
                <span className="flex min-h-[44px] items-center justify-center rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5 text-sm text-white/25">
                  Website
                </span>
              )}
              {stop.phone ? (
                <a
                  href={`tel:${stop.phone}`}
                  className="flex min-h-[44px] items-center justify-center rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-sm font-semibold text-white/90 transition active:bg-white/10"
                >
                  Call
                </a>
              ) : (
                <span className="flex min-h-[44px] items-center justify-center rounded-xl border border-white/8 bg-white/[0.02] px-3 py-2.5 text-sm text-white/25">
                  Call
                </span>
              )}
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm">
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-white/40">Hours</dt>
                <dd className="mt-0.5 text-white/85">{stop.openingHours ?? "Unknown"}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-white/40">Confidence</dt>
                <dd className="mt-0.5 tabular-nums text-white/85">
                  {stop.confidenceScore != null ? `${Math.round(stop.confidenceScore)}` : "—"}
                </dd>
              </div>
              {stop.notes ? (
                <div className="col-span-2">
                  <dt className="text-[11px] font-medium uppercase tracking-wide text-white/40">Notes</dt>
                  <dd className="mt-0.5 text-white/85">{stop.notes}</dd>
                </div>
              ) : null}
            </dl>
          </div>
        ) : null}
      </BottomSheet>

      {undo ? (
        <UndoToast
          stopName={undo.stopName}
          message="Pending desktop review"
          onUndo={() => void performUndo()}
        />
      ) : null}
    </>
  );
}
