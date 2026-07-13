import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@shared/auth/AuthProvider";
import { getAvatarUrl, getDisplayName } from "@shared/auth/profile";
import type { CompanionBundle, CompanionStop } from "@shared/types/sync";
import { Avatar, SessionRestoreScreen, SigningInScreen } from "@shared/ui/AuthScreens";
import { updateDeviceLastActive } from "@shared/sync/deviceProfile";
import { CompanionContext } from "./context/CompanionContext";
import BottomNav, { type CompanionTab } from "./components/BottomNav";
import AccountScreen from "./screens/AccountScreen";
import HomeScreen from "./screens/HomeScreen";
import MapScreen from "./screens/MapScreen";
import ResupplyScreen from "./screens/ResupplyScreen";
import WelcomeScreen from "./screens/WelcomeScreen";

type AppView = "welcome" | "home" | "race";
type HomeTab = "races" | "account";

export default function App() {
  const { isRestoring, signingIn, session, user, configured } = useAuth();
  const [view, setView] = useState<AppView>("welcome");
  const [homeTab, setHomeTab] = useState<HomeTab>("races");
  const [bundle, setBundle] = useState<CompanionBundle | null>(null);
  const [bootLoading, setBootLoading] = useState(true);
  const [tab, setTab] = useState<CompanionTab>("resupply");
  const [currentKm, setCurrentKm] = useState(0);
  const [selectedStop, setSelectedStop] = useState<CompanionStop | null>(null);
  const [showUnverified, setShowUnverified] = useState(false);
  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    if (user) {
      void updateDeviceLastActive("companion");
    }
  }, [user]);

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
    if (isRestoring) {
      return;
    }
    if (session) {
      setView((current) => (current === "welcome" ? "home" : current));
    } else {
      setView("welcome");
      setBundle(null);
    }
    setBootLoading(false);
  }, [isRestoring, session]);

  const clearRace = useCallback(async () => {
    setBundle(null);
    setSelectedStop(null);
    setCurrentKm(0);
    setTab("resupply");
    setView(session ? "home" : "welcome");
  }, [session]);

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

  if (isRestoring || bootLoading) {
    return <SessionRestoreScreen variant="dark" />;
  }

  if (signingIn) {
    return <SigningInScreen variant="dark" message="Signing you in…" />;
  }

  if (!configured) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-red-300">
        Cloud sync is not configured for this build.
      </div>
    );
  }

  if (view === "welcome" || !session) {
    return <WelcomeScreen />;
  }

  if (view === "home") {
    if (homeTab === "account") {
      const displayName = getDisplayName(user);
      const avatarUrl = getAvatarUrl(user);
      return (
        <div className="flex h-full min-h-0 flex-col bg-[#0a0a0a]">
          <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
            <button
              type="button"
              onClick={() => setHomeTab("races")}
              className="text-sm text-white/50 hover:text-white"
            >
              ← Races
            </button>
            <div className="ml-auto flex items-center gap-2">
              <Avatar name={displayName} imageUrl={avatarUrl} size="md" variant="dark" />
            </div>
          </header>
          <AccountScreen />
        </div>
      );
    }

    return (
      <HomeScreen
        onOpenAccount={() => setHomeTab("account")}
        onOpenRace={(next) => {
          setBundle(next);
          setCurrentKm(0);
          setSelectedStop(null);
          setTab("resupply");
          setView("race");
        }}
      />
    );
  }

  if (!bundle || !contextValue) {
    return (
      <HomeScreen
        onOpenAccount={() => setHomeTab("account")}
        onOpenRace={(next) => {
          setBundle(next);
          setCurrentKm(0);
          setSelectedStop(null);
          setTab("resupply");
          setView("race");
        }}
      />
    );
  }

  return (
    <CompanionContext.Provider value={contextValue}>
      <div className="flex h-full min-h-0 flex-col bg-[#0a0a0a]">
        {tab !== "account" ? (
          <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{bundle.race.name}</p>
              <p className="text-xs tabular-nums text-white/45">
                {Math.round(bundle.race.distanceKm)} km
                {!online ? " · offline" : " · ready"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void clearRace()}
              className="shrink-0 text-xs text-white/45 hover:text-white"
            >
              All races
            </button>
          </header>
        ) : null}

        <main className="min-h-0 flex-1">
          {tab === "map" ? <MapScreen /> : tab === "resupply" ? <ResupplyScreen /> : <AccountScreen />}
        </main>

        <BottomNav active={tab} onChange={setTab} />
      </div>
    </CompanionContext.Provider>
  );
}
