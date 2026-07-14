import type { CompanionStop } from "../types";
import { formatKm, googleMapsUrl, googleStreetViewUrl } from "../lib/utils";
import { stopStatusLabel } from "../lib/raceExecution";
import { normalizeWebsite } from "@shared/race/streetViewUrl";
import BottomSheet from "./BottomSheet";

interface StopSheetProps {
  stop: CompanionStop | null;
  totalKm: number;
  routeCoordinates?: [number, number][];
  onClose: () => void;
}

function statusTone(status: CompanionStop["verificationStatus"]): string {
  if (status === "verified") {
    return "text-emerald-300";
  }
  if (status === "pending" || status === "needs_review") {
    return "text-amber-200";
  }
  return "text-white/60";
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

export default function StopSheet({ stop, totalKm, routeCoordinates, onClose }: StopSheetProps) {
  const streetViewOptions = routeCoordinates
    ? { routeCoordinates, totalDistanceKm: totalKm }
    : undefined;

  return (
    <BottomSheet open={stop !== null} onClose={onClose}>
      {stop ? (
        <div className="space-y-5 pb-1">
          <div>
            <div className="flex items-start gap-3">
              <span className="text-3xl leading-none" aria-hidden>
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

          <a
            href={googleStreetViewUrl(stop, streetViewOptions)}
            target="_blank"
            rel="noreferrer"
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-sky-500 px-4 py-3.5 text-base font-bold text-white shadow-lg shadow-sky-500/25 transition active:scale-[0.98]"
          >
            <span aria-hidden>👁</span>
            Open Street View
          </a>

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
            {stop.hasCoffee ? (
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-white/40">Coffee</dt>
                <dd className="mt-0.5 text-white/85">Available</dd>
              </div>
            ) : null}
            {stop.verificationDate ? (
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-white/40">Verified</dt>
                <dd className={`mt-0.5 font-medium ${statusTone(stop.verificationStatus)}`}>
                  {new Date(stop.verificationDate).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </dd>
              </div>
            ) : null}
          </dl>

          {stop.notes ? (
            <div className="rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-white/40">Notes</p>
              <p className="mt-1 text-sm leading-relaxed text-white/80">{stop.notes}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </BottomSheet>
  );
}
