import type { ReliabilityPresentation } from "../planning/stopPresentation";

interface ReliabilityBadgeProps {
  reliability: ReliabilityPresentation;
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASS = {
  sm: "text-xs px-2 py-1",
  md: "text-sm px-2.5 py-1",
  lg: "text-base px-3 py-1.5",
};

export default function ReliabilityBadge({ reliability, size = "md" }: ReliabilityBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full bg-canvas font-semibold text-ink ring-1 ring-line ${SIZE_CLASS[size]}`}
      title={reliability.label}
    >
      <span className="tracking-tight text-accent">{reliability.shortLabel}</span>
      <span>{reliability.label}</span>
    </span>
  );
}
