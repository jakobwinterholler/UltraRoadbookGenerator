import type { CompanionClimb } from "@shared/types/sync";
import {
  analyzeClimbDifficulty,
  maxGradientPct,
  steepestSectionLabel,
} from "@shared/race/climbDifficulty";
import { formatKm } from "../lib/utils";
import BottomSheet from "./BottomSheet";

interface ClimbSheetProps {
  climb: CompanionClimb | null;
  totalKm: number;
  currentKm: number;
  onClose: () => void;
}

export default function ClimbSheet({ climb, totalKm, currentKm, onClose }: ClimbSheetProps) {
  if (!climb) {
    return null;
  }

  const tier = analyzeClimbDifficulty(climb);
  const maxGradient = maxGradientPct(climb);
  const steepest = steepestSectionLabel(climb);
  const remainingKm = Math.max(0, climb.startKm - currentKm);

  return (
    <BottomSheet open onClose={onClose}>
      <div className="space-y-5 pb-1">
        <div>
          <div
            className="inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide text-white"
            style={{ backgroundColor: tier.color }}
          >
            {tier.label}
          </div>
          <h2 className="mt-3 text-xl font-semibold leading-snug text-white">{climb.name}</h2>
          <p className="mt-1 text-sm tabular-nums text-white/55">
            {formatKm(climb.startKm)} – {formatKm(climb.endKm)}
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm">
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-white/40">Length</dt>
            <dd className="mt-0.5 tabular-nums text-white/90">{climb.lengthKm.toFixed(1)} km</dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-white/40">Elevation</dt>
            <dd className="mt-0.5 tabular-nums text-white/90">+{climb.elevationGainM} m</dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-white/40">Avg gradient</dt>
            <dd className="mt-0.5 tabular-nums text-white/90">{climb.avgGradientPct.toFixed(1)}%</dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-white/40">Max gradient</dt>
            <dd className="mt-0.5 tabular-nums text-white/90">
              {maxGradient != null ? `${maxGradient.toFixed(1)}%` : "—"}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-white/40">Steepest section</dt>
            <dd className="mt-0.5 text-white/90">{steepest ?? "—"}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-white/40">Remaining to climb</dt>
            <dd className="mt-0.5 tabular-nums text-white/90">
              {remainingKm > 0 ? formatKm(remainingKm) : "On climb or past"}
            </dd>
          </div>
        </dl>

        <p className="text-center text-xs text-white/35">
          {formatKm(Math.max(0, totalKm - climb.endKm))} left to finish after this climb
        </p>
      </div>
    </BottomSheet>
  );
}
