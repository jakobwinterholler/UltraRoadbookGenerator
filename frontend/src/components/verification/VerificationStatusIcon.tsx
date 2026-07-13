import type {
  DisplayVerificationStatus,
  VerificationStatusIconSize,
} from "../../planning/stopVerification/verificationStatusPresentation";
import { verificationStatusPresentation } from "../../planning/stopVerification/verificationStatusPresentation";

const SIZE_CLASS: Record<VerificationStatusIconSize, string> = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
};

const SVG_CLASS: Record<VerificationStatusIconSize, string> = {
  sm: "h-2 w-2",
  md: "h-2.5 w-2.5",
  lg: "h-3 w-3",
};

interface VerificationStatusIconProps {
  status: DisplayVerificationStatus;
  size?: VerificationStatusIconSize;
  className?: string;
}

function VerifiedMark({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 12 12" className={className} fill="none" aria-hidden="true">
      <path
        d="M2.5 6.25 5 8.75 9.5 3.75"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RejectedMark({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 12 12" className={className} fill="none" aria-hidden="true">
      <path
        d="M3.5 3.5 8.5 8.5M8.5 3.5 3.5 8.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DeferredMark({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 12 12" className={className} fill="none" aria-hidden="true">
      <circle cx="6" cy="6" r="4.25" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M6 3.75V6l1.75 1.75"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NotReviewedMark({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 12 12" className={className} fill="none" aria-hidden="true">
      <circle cx="6" cy="6" r="3.25" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export default function VerificationStatusIcon({
  status,
  size = "md",
  className = "",
}: VerificationStatusIconProps) {
  const presentation = verificationStatusPresentation(status);
  const sizeClass = SIZE_CLASS[size];
  const svgClass = SVG_CLASS[size];

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full ring-1 ring-inset ${sizeClass} ${presentation.iconBgClass} ${presentation.iconRingClass} ${presentation.iconContentClass} ${className}`}
      aria-hidden="true"
    >
      {status === "verified" && <VerifiedMark className={svgClass} />}
      {status === "rejected" && <RejectedMark className={svgClass} />}
      {status === "deferred" && <DeferredMark className={svgClass} />}
      {status === "not_reviewed" && <NotReviewedMark className={svgClass} />}
    </span>
  );
}
