import type { CompanionStop } from "../types";
import { formatKm, googleMapsUrl, googleStreetViewUrl } from "../lib/utils";
import BottomSheet from "./BottomSheet";

interface StopSheetProps {
  stop: CompanionStop | null;
  totalKm: number;
  onClose: () => void;
}

export default function StopSheet({ stop, totalKm, onClose }: StopSheetProps) {
  return (
    <BottomSheet open={stop !== null} onClose={onClose}>
      {stop ? (
        <div className="space-y-4 pb-2">
          <div>
            <p className="text-lg font-semibold leading-snug text-white">{stop.name}</p>
            <p className="mt-1 text-sm text-white/55">{stop.categoryLabel}</p>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-white/40">Opening hours</dt>
              <dd className="text-white/85">{stop.openingHours ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/40">From start</dt>
              <dd className="tabular-nums text-white/85">{formatKm(stop.km)}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/40">From finish</dt>
              <dd className="tabular-nums text-white/85">{formatKm(Math.max(0, totalKm - stop.km))}</dd>
            </div>
            <div>
              <dt className="text-xs text-white/40">Status</dt>
              <dd className="text-white/85">
                {stop.verificationStatus === "verified" ? (
                  <span className="inline-flex items-center gap-1 text-emerald-300">
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white">
                      ✓
                    </span>
                    Verified
                  </span>
                ) : (
                  <span className="text-white/60">Not verified</span>
                )}
              </dd>
            </div>
          </dl>

          {stop.notes ? (
            <div>
              <p className="text-xs text-white/40">Notes</p>
              <p className="mt-1 text-sm text-white/80">{stop.notes}</p>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-1">
            <a
              href={googleMapsUrl(stop.lat, stop.lon)}
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black"
            >
              Google Maps
            </a>
            <a
              href={googleStreetViewUrl(stop.lat, stop.lon)}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white"
            >
              Street View
            </a>
          </div>
        </div>
      ) : null}
    </BottomSheet>
  );
}
