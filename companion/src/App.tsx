import { useCallback, useEffect, useMemo, useState } from "react";
import { CompanionContext } from "./context/CompanionContext";
import type { CompanionBundle, CompanionStop } from "./types";
import { clearCompanionData, loadActiveCompanionBundle } from "./db";
import ImportScreen from "./screens/ImportScreen";
import MapScreen from "./screens/MapScreen";
import ResupplyScreen from "./screens/ResupplyScreen";

type Tab = "map" | "resupply";

export default function App() {
  const [bundle, setBundle] = useState<CompanionBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("resupply");
  const [currentKm, setCurrentKm] = useState(0);
  const [selectedStop, setSelectedStop] = useState<CompanionStop | null>(null);
  const [showUnverified, setShowUnverified] = useState(false);
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    void loadActiveCompanionBundle().then((saved) => {
      setBundle(saved);
      setLoading(false);
    });
  }, []);

  const clearRace = useCallback(async () => {
    await clearCompanionData();
    setBundle(null);
    setSelectedStop(null);
    setCurrentKm(0);
  }, []);

  const contextValue = useMemo(
    () =>
      bundle
        ? {
            bundle,
            currentKm,
            setCurrentKm,
            selectedStop,
            selectStop: setSelectedStop,
            showUnverified,
            setShowUnverified,
            clearRace,
          }
        : null,
    [bundle, clearRace, currentKm, selectedStop, showUnverified],
  );

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-white/50">
        Loading…
      </div>
    );
  }

  if (!bundle || !contextValue) {
    return (
      <ImportScreen
        onImported={(next) => {
          setBundle(next);
          setCurrentKm(0);
        }}
      />
    );
  }

  return (
    <CompanionContext.Provider value={contextValue}>
      <div className="flex h-full min-h-0 flex-col bg-[#0a0a0a]">
        <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{bundle.race.name}</p>
            <p className="text-xs tabular-nums text-white/45">
              {Math.round(bundle.race.distanceKm)} km
              {!online ? " · offline" : " · offline ready"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void clearRace()}
            className="shrink-0 text-xs text-white/45 hover:text-white"
          >
            Change race
          </button>
        </header>

        <main className="min-h-0 flex-1">
          {tab === "map" ? <MapScreen /> : <ResupplyScreen />}
        </main>

        <nav className="grid shrink-0 grid-cols-2 border-t border-white/10 bg-[#0a0a0a] pb-[env(safe-area-inset-bottom)]">
          <button
            type="button"
            onClick={() => setTab("map")}
            className={`py-3 text-sm font-medium ${
              tab === "map" ? "text-white" : "text-white/45"
            }`}
          >
            Map
          </button>
          <button
            type="button"
            onClick={() => setTab("resupply")}
            className={`py-3 text-sm font-medium ${
              tab === "resupply" ? "text-white" : "text-white/45"
            }`}
          >
            Resupply
          </button>
        </nav>
      </div>
    </CompanionContext.Provider>
  );
}
