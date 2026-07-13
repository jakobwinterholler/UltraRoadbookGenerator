import { useEffect, useRef, useState } from "react";
import type { RaceSummary } from "../races/api";
import { useRace } from "../races/RaceContext";
import { formatKm } from "./routeInsights";

interface HeaderProps {
  mode: "races" | "workspace" | "settings";
  onMyRaces: () => void;
  onOpenRace?: (raceId: string) => void;
  onOpenSettings: () => void;
}

export default function Header({ mode, onMyRaces, onOpenRace, onOpenSettings }: HeaderProps) {
  const { activeRace, races } = useRace();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <header className="border-b border-line bg-card">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
            Ultra Roadbook
          </p>
          {mode === "workspace" && activeRace ? (
            <div className="relative mt-0.5" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="flex max-w-full items-center gap-2 text-left"
              >
                <h1 className="truncate text-lg font-semibold tracking-tight text-ink">
                  {activeRace.name}
                </h1>
                <span className="text-sm text-muted">▾</span>
              </button>
              {menuOpen && (
                <div className="absolute left-0 top-full z-30 mt-2 min-w-[16rem] rounded-xl border border-line bg-card py-2 shadow-lg">
                  {activeRace.distance_km != null && (
                    <p className="px-4 pb-2 text-xs text-muted">
                      {formatKm(activeRace.distance_km)}
                      {activeRace.elevation_gain_m != null
                        ? ` · +${Math.round(activeRace.elevation_gain_m).toLocaleString()} m`
                        : ""}
                    </p>
                  )}
                  {races
                    .filter((race: RaceSummary) => race.id !== activeRace.id)
                    .slice(0, 6)
                    .map((race: RaceSummary) => (
                      <button
                        key={race.id}
                        type="button"
                        onClick={() => {
                          setMenuOpen(false);
                          onOpenRace?.(race.id);
                        }}
                        className="block w-full px-4 py-2 text-left text-sm text-ink hover:bg-canvas"
                      >
                        {race.name}
                      </button>
                    ))}
                  <div className="my-1 border-t border-line" />
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onMyRaces();
                    }}
                    className="block w-full px-4 py-2 text-left text-sm font-medium text-accent hover:bg-canvas"
                  >
                    My Races
                  </button>
                </div>
              )}
            </div>
          ) : (
            <h1 className="text-lg font-semibold tracking-tight text-ink">
              {mode === "settings" ? "Settings" : "My Races"}
            </h1>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {mode !== "settings" && (
            <button
              type="button"
              onClick={onOpenSettings}
              className="rounded-xl border border-line bg-canvas px-4 py-2 text-sm font-medium text-ink transition hover:border-accent/30 hover:bg-white"
            >
              Settings
            </button>
          )}
          {mode === "workspace" && (
            <button
              type="button"
              onClick={onMyRaces}
              className="rounded-xl border border-line bg-canvas px-4 py-2 text-sm font-medium text-ink transition hover:border-accent/30 hover:bg-white"
            >
              My Races
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
