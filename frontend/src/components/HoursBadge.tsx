import type { HoursVisual } from "../planning/stopPresentation";

interface HoursBadgeProps {
  hours: HoursVisual;
}

const TONE_CLASS: Record<HoursVisual["tone"], string> = {
  open: "bg-emerald-50 text-emerald-900 ring-emerald-200",
  limited: "bg-amber-50 text-amber-900 ring-amber-200",
  closed: "bg-red-50 text-red-900 ring-red-200",
  unknown: "bg-canvas text-muted ring-line",
};

export default function HoursBadge({ hours }: HoursBadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${TONE_CLASS[hours.tone]}`}>
      <span aria-hidden>{hours.emoji}</span>
      <span>{hours.label}</span>
    </span>
  );
}
