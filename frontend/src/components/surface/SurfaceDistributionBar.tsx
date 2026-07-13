import type { SurfaceCategoryStat } from "../../planning/surfaceBreakdown";

interface SurfaceDistributionBarProps {
  categories: SurfaceCategoryStat[];
}

export default function SurfaceDistributionBar({ categories }: SurfaceDistributionBarProps) {
  const visible = categories.filter((row) => row.percentage > 0);
  if (visible.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-medium text-ink">Surface distribution</h3>
        <p className="mt-1 text-sm text-muted">How the route splits across surface types.</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-line/40 bg-white">
        <div className="flex h-4 w-full">
          {visible.map((row) => (
            <div
              key={row.riderCategory}
              className="h-full"
              style={{
                width: `${row.percentage}%`,
                backgroundColor: row.color,
                minWidth: row.percentage > 0 ? "2px" : undefined,
              }}
              title={`${row.label}: ${row.percentage}%`}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 px-4 py-3">
          {visible.map((row) => (
            <div key={row.riderCategory} className="flex items-center gap-2 text-sm">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: row.color }}
              />
              <span className="text-ink">{row.label}</span>
              <span className="tabular-nums text-muted">
                {row.percentage}% · {row.distanceKm.toFixed(0)} km
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
