import { useRace } from "../../races/RaceContext";
import type {
  DisplayVerificationStatus,
  VerificationStatusIconSize,
} from "../../planning/stopVerification/verificationStatusPresentation";
import {
  verificationStatusPresentation,
  zoneVerificationStatus,
} from "../../planning/stopVerification/verificationStatusPresentation";
import VerificationStatusIcon from "./VerificationStatusIcon";

interface VerificationStatusBadgeProps {
  zoneId?: number;
  status?: DisplayVerificationStatus;
  size?: VerificationStatusIconSize;
  /** Show muted label beside the icon. Default true. */
  showLabel?: boolean;
  className?: string;
}

export function useVerificationStatus(
  zoneId?: number,
  status?: DisplayVerificationStatus,
): DisplayVerificationStatus {
  const { verifiedStops } = useRace();
  if (status !== undefined) {
    return status;
  }
  if (zoneId !== undefined) {
    return zoneVerificationStatus(zoneId, verifiedStops);
  }
  return "not_reviewed";
}

/** Text-only status label — pair with VerificationStatusIcon for custom layouts. */
export function VerificationStatusLabel({
  zoneId,
  status: statusProp,
  className = "",
}: {
  zoneId?: number;
  status?: DisplayVerificationStatus;
  className?: string;
}) {
  const status = useVerificationStatus(zoneId, statusProp);
  const presentation = verificationStatusPresentation(status);

  return (
    <span className={`text-xs font-medium ${presentation.labelClass} ${className}`}>
      {presentation.label}
    </span>
  );
}

export default function VerificationStatusBadge({
  zoneId,
  status: statusProp,
  size = "md",
  showLabel = true,
  className = "",
}: VerificationStatusBadgeProps) {
  const status = useVerificationStatus(zoneId, statusProp);
  const presentation = verificationStatusPresentation(status);

  if (!showLabel) {
    return (
      <span className={`inline-flex shrink-0 ${className}`} title={presentation.label} aria-label={presentation.label}>
        <VerificationStatusIcon status={status} size={size} />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 ${className}`}
      title={presentation.label}
    >
      <VerificationStatusIcon status={status} size={size} />
      <span className={`text-xs font-medium ${presentation.labelClass}`}>
        {presentation.label}
      </span>
    </span>
  );
}

/** Compact legend row for maps and progress panels. */
export function VerificationStatusLegendItem({
  status,
  size = "sm",
}: {
  status: DisplayVerificationStatus;
  size?: VerificationStatusIconSize;
}) {
  const presentation = verificationStatusPresentation(status);

  return (
    <span className="inline-flex items-center gap-1.5">
      <VerificationStatusIcon status={status} size={size} />
      <span className="text-[11px] text-muted">{presentation.label}</span>
    </span>
  );
}
