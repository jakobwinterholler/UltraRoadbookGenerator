import { useCompanion } from "../context/CompanionContext";
import { formatKm } from "../lib/utils";
import { GpsStatusBadge } from "./GpsStatusBadge";

interface ExecutionHeaderProps {
  /** Semi-transparent overlay for map screen */
  overlay?: boolean;
  trailing?: React.ReactNode;
}

export default function ExecutionHeader({ overlay = false, trailing }: ExecutionHeaderProps) {
  const { bundle, currentKm } = useCompanion();

  return (
    <header
      className={`shrink-0 px-4 pb-2 pt-[max(8px,env(safe-area-inset-top))] ${
        overlay
          ? "bg-gradient-to-b from-black/75 via-black/45 to-transparent"
          : "border-b border-white/8 bg-[#0a0a0a]"
      }`}
    >
      <div className="flex min-h-[40px] items-center gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[15px] font-semibold leading-tight tracking-tight text-white">
            {bundle.race.name}
          </h1>
          <div className="mt-0.5 flex items-center gap-2">
            <span className="text-[13px] font-medium tabular-nums text-white/65">
              {formatKm(currentKm)}
            </span>
            <GpsStatusBadge compact />
          </div>
        </div>
        {trailing ? <div className="shrink-0">{trailing}</div> : null}
      </div>
    </header>
  );
}
