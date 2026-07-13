import type { AppTab } from "../api";

interface TabBarProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
}

const tabs: { id: AppTab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "route", label: "Route" },
  { id: "verify", label: "Verify" },
  { id: "unsupported", label: "Unsupported" },
  { id: "climbs", label: "Climbs" },
  { id: "surface", label: "Surface" },
  { id: "resupply", label: "Resupply" },
];

export default function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <nav className="sticky top-0 z-20 bg-canvas/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl gap-1 px-6 pt-2">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`relative px-4 py-3 text-sm font-medium transition ${
                isActive ? "text-ink" : "text-muted hover:text-ink"
              }`}
            >
              {tab.label}
              {isActive && (
                <span className="absolute inset-x-3 bottom-1 h-0.5 rounded-full bg-accent" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
