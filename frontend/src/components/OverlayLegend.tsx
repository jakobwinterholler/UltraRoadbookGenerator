import type { LegendItem } from "../planning/types";

interface OverlayLegendProps {
  items: LegendItem[];
  className?: string;
}

export default function OverlayLegend({ items, className = "" }: OverlayLegendProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div
      className={`rounded-lg border border-line/80 bg-card/95 px-3 py-2 shadow-sm backdrop-blur ${className}`}
    >
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {items.map((item) => (
          <span key={item.label} className="inline-flex items-center gap-1.5 text-xs text-ink">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
