import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRace } from "../races/RaceContext";
import {
  fetchAppSettings,
  fetchRaceSettings,
  patchAppSettings,
  patchRaceSettings,
} from "./api";
import type { SettingsSnapshot } from "./types";

interface SettingsContextValue {
  settings: SettingsSnapshot | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  updatePlanning: (partial: Partial<SettingsSnapshot["planning"]>) => Promise<void>;
  updateAnalysis: (partial: Partial<SettingsSnapshot["analysis"]>) => Promise<void>;
  updateAppearance: (partial: Partial<SettingsSnapshot["appearance"]>) => Promise<void>;
  resetRaceToAppDefaults: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within SettingsProvider");
  }
  return context;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { activeRaceId } = useRace();
  const [settings, setSettings] = useState<SettingsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const snapshot = activeRaceId
        ? await fetchRaceSettings(activeRaceId)
        : await fetchAppSettings();
      setSettings(snapshot);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings.");
    } finally {
      setLoading(false);
    }
  }, [activeRaceId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const updatePlanning = useCallback(
    async (partial: Partial<SettingsSnapshot["planning"]>) => {
      if (!settings) {
        return;
      }
      const merged = { ...settings.planning, ...partial };
      const next = activeRaceId
        ? await patchRaceSettings(activeRaceId, { planning: merged })
        : await patchAppSettings({ planning: merged });
      setSettings(next);
    },
    [activeRaceId, settings],
  );

  const updateAnalysis = useCallback(
    async (partial: Partial<SettingsSnapshot["analysis"]>) => {
      if (!settings) {
        return;
      }
      const next = await patchAppSettings({ analysis: { ...settings.analysis, ...partial } });
      setSettings(next);
    },
    [settings],
  );

  const updateAppearance = useCallback(
    async (partial: Partial<SettingsSnapshot["appearance"]>) => {
      if (!settings) {
        return;
      }
      const next = await patchAppSettings({ appearance: { ...settings.appearance, ...partial } });
      setSettings(next);
    },
    [settings],
  );

  const resetRaceToAppDefaults = useCallback(async () => {
    if (!activeRaceId) {
      return;
    }
    const next = await patchRaceSettings(activeRaceId, { use_app_defaults: true });
    setSettings(next);
  }, [activeRaceId]);

  const value = useMemo(
    () => ({
      settings,
      loading,
      error,
      refresh,
      updatePlanning,
      updateAnalysis,
      updateAppearance,
      resetRaceToAppDefaults,
    }),
    [
      settings,
      loading,
      error,
      refresh,
      updatePlanning,
      updateAnalysis,
      updateAppearance,
      resetRaceToAppDefaults,
    ],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
