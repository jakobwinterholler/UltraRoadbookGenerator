import { useState } from "react";
import type { RoadbookResult } from "../api";
import AccountSection from "../components/account/AccountSection";
import DeveloperDiagnostics from "../components/settings/DeveloperDiagnostics";
import SettingsPlanningSection from "../components/settings/SettingsPlanningSection";
import { sensitivityForClimbConfig } from "../planning/climbSensitivity";
import { useRace } from "../races/RaceContext";
import { analyzeRaceStream, recalculateRaceClimbs } from "../races/api";
import { useSettings } from "../settings/SettingsContext";
import { SETTINGS_SECTIONS, type SettingsSectionId } from "../settings/types";

interface SettingsPageProps {
  roadbook: RoadbookResult | null;
  onBack: () => void;
  onReanalysed?: (roadbook: RoadbookResult) => void;
}

function SettingsPanel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-line bg-card p-6 shadow-card">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <p className="mt-1 text-sm text-muted">{description}</p>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export default function SettingsPage({ roadbook, onBack, onReanalysed }: SettingsPageProps) {
  const { activeRaceId, activeRace } = useRace();
  const {
    settings,
    loading,
    error,
    resetRaceToAppDefaults,
    updatePlanning,
    updateAnalysis,
  } = useSettings();
  const [section, setSection] = useState<SettingsSectionId>("account");
  const [recalculating, setRecalculating] = useState(false);
  const [reanalysing, setReanalysing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleRecalculateClimbs() {
    if (!activeRaceId || !settings) {
      return;
    }
    setRecalculating(true);
    setActionError(null);
    try {
      const response = await recalculateRaceClimbs(activeRaceId, settings.planning.climb_config);
      onReanalysed?.({
        ...(roadbook as RoadbookResult),
        climbs: response.climbs,
        climb_candidates: response.climb_candidates,
        summary: {
          ...(roadbook?.summary as RoadbookResult["summary"]),
          climb_count: response.summary.climb_count,
        },
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Recalculation failed.");
    } finally {
      setRecalculating(false);
    }
  }

  async function handleReanalyse() {
    if (!activeRaceId) {
      return;
    }
    setReanalysing(true);
    setActionError(null);
    try {
      const result = await analyzeRaceStream(activeRaceId, () => undefined);
      onReanalysed?.(result);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Re-analysis failed.");
    } finally {
      setReanalysing(false);
    }
  }

  if (loading && !settings) {
    return <p className="px-6 py-12 text-sm text-muted">Loading settings…</p>;
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-3 text-sm font-medium text-accent hover:text-accent/80"
          >
            ← Back
          </button>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">Settings</h1>
          <p className="mt-2 text-sm text-muted">
            {activeRace
              ? `Configuration for ${activeRace.name}`
              : "Defaults for all new races"}
          </p>
        </div>
        {activeRaceId && settings && !settings.use_app_defaults && (
          <button
            type="button"
            onClick={() => void resetRaceToAppDefaults()}
            className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink"
          >
            Reset to app defaults
          </button>
        )}
      </header>

      {(error || actionError) && (
        <p className="mb-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error ?? actionError}
        </p>
      )}

      <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="space-y-1">
          {SETTINGS_SECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSection(item.id)}
              className={`block w-full rounded-xl px-4 py-3 text-left transition ${
                section === item.id ? "bg-accent text-white" : "text-ink hover:bg-card"
              }`}
            >
              <span className="block text-sm font-medium">{item.label}</span>
              <span
                className={`mt-0.5 block text-xs ${
                  section === item.id ? "text-white/80" : "text-muted"
                }`}
              >
                {item.description}
              </span>
            </button>
          ))}
        </nav>

        <div>
          {section === "account" && settings && <AccountSection account={settings.account} />}

          {section === "planning" && (
            <SettingsPanel
              title="Planning"
              description="Assumptions that influence resupply gaps and stop availability."
            >
              <SettingsPlanningSection />
            </SettingsPanel>
          )}

          {section === "analysis" && settings && (
            <SettingsPanel
              title="Analysis"
              description="Refresh route data and re-run the analysis engine."
            >
              <div className="space-y-4">
                <label className="flex items-center justify-between gap-3 rounded-xl bg-canvas px-4 py-3 text-sm">
                  <span className="text-ink">Refresh OpenStreetMap data on re-analyse</span>
                  <input
                    type="checkbox"
                    checked={settings.analysis.refresh_osm_on_analyse}
                    onChange={(event) =>
                      void updateAnalysis({ refresh_osm_on_analyse: event.target.checked })
                    }
                    className="h-4 w-4 rounded border-line text-accent"
                  />
                </label>
                {activeRaceId && (
                  <button
                    type="button"
                    onClick={() => void handleReanalyse()}
                    disabled={reanalysing}
                    className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    {reanalysing ? "Re-analysing route…" : "Re-analyse route"}
                  </button>
                )}
              </div>
            </SettingsPanel>
          )}

          {section === "developer" && settings && (
            <SettingsPanel
              title="Developer"
              description="Diagnostics, performance, and experimental parameters."
            >
              <DeveloperDiagnostics
                roadbook={roadbook}
                raceName={activeRace?.name}
                climbConfig={settings.planning.climb_config}
                onClimbConfigChange={(config) => {
                  void updatePlanning({
                    climb_config: config,
                    climb_sensitivity: sensitivityForClimbConfig(config),
                  });
                }}
                onRecalculateClimbs={activeRaceId ? handleRecalculateClimbs : undefined}
                recalculating={recalculating}
              />
            </SettingsPanel>
          )}
        </div>
      </div>
    </div>
  );
}
