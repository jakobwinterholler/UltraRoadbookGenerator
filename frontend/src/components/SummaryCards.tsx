import type { RouteSummary } from "../api";

interface SummaryCardsProps {
  summary: RouteSummary;
}

const cards = [
  { key: "distance_km", label: "Distance", suffix: " km", decimals: 2 },
  { key: "elevation_gain_m", label: "Elevation Gain", suffix: " m", decimals: 0 },
  { key: "climb_count", label: "Number of Climbs", suffix: "", decimals: 0 },
  { key: "asphalt_pct", label: "Asphalt", suffix: "%", decimals: 0 },
  { key: "gravel_pct", label: "Gravel", suffix: "%", decimals: 0 },
  { key: "unknown_pct", label: "Unknown", suffix: "%", decimals: 0 },
] as const;

export default function SummaryCards({ summary }: SummaryCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => {
        const raw = summary[card.key];
        const value =
          card.decimals > 0 ? raw.toFixed(card.decimals) : String(raw);

        return (
          <div
            key={card.key}
            className="rounded-2xl bg-card p-6 shadow-card transition hover:shadow-lg"
          >
            <p className="text-sm font-medium text-muted">{card.label}</p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-ink">
              {value}
              <span className="text-lg font-medium text-muted">{card.suffix}</span>
            </p>
          </div>
        );
      })}
    </div>
  );
}
