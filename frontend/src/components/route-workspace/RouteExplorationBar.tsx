import type { OverlayMode, ZoneDensityMode } from "../../planning/types";
import { usePlanning } from "../../planning/PlanningContext";

const OVERLAY_OPTIONS: { id: OverlayMode; label: string }[] = [
  { id: "normal", label: "Climbs" },
  { id: "surface", label: "Surface" },
  { id: "resupply", label: "Resupply" },
];

interface ToolbarChipProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function ToolbarChip({ active, onClick, children }: ToolbarChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
        active ? "bg-accent text-white" : "text-muted hover:bg-canvas hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

/** View controls you change frequently while exploring the route. */
export default function RouteExplorationBar() {
  const { overlay, setOverlay, zoneDensity, setZoneDensity } = usePlanning();

  const densityOptions: { id: ZoneDensityMode; label: string }[] = [
    { id: "planning", label: "Planning" },
    { id: "balanced", label: "Balanced" },
    { id: "detailed", label: "Detailed" },
    { id: "minimal", label: "Minimal" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex flex-wrap items-center gap-1">
        {OVERLAY_OPTIONS.map((option) => (
          <ToolbarChip
            key={option.id}
            active={overlay === option.id}
            onClick={() => setOverlay(option.id)}
          >
            {option.label}
          </ToolbarChip>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {densityOptions.map((option) => (
          <ToolbarChip
            key={option.id}
            active={zoneDensity === option.id}
            onClick={() => setZoneDensity(option.id)}
          >
            {option.label}
          </ToolbarChip>
        ))}
      </div>
    </div>
  );
}
