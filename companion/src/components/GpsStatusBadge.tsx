import { useCompanion } from "../context/CompanionContext";

const GPS_LABELS: Record<string, string> = {
  acquiring: "Acquiring",
  active: "Active",
  degraded: "Degraded",
  lost: "Lost",
  unavailable: "Unavailable",
  denied: "Denied",
};

const GPS_DOT: Record<string, string> = {
  acquiring: "bg-sky-400/70",
  active: "bg-emerald-400",
  degraded: "bg-amber-400",
  lost: "bg-amber-500",
  unavailable: "bg-white/30",
  denied: "bg-red-400",
};

export function GpsStatusBadge({ compact = false }: { compact?: boolean }) {
  const { gps } = useCompanion();
  const label = GPS_LABELS[gps.status] ?? gps.status;
  const dot = GPS_DOT[gps.status] ?? "bg-white/30";

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-white/50">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} aria-hidden />
        GPS {label}
      </span>
    );
  }

  return (
    <p className="text-[11px] font-medium text-white/50">
      <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden />
      GPS {label}
      {gps.accuracyM != null ? ` · ±${Math.round(gps.accuracyM)} m` : ""}
    </p>
  );
}
