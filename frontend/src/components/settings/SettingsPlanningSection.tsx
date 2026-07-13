import PoiProfileSettings from "../PoiProfileSettings";
import { TIME_WINDOWS } from "../../planning/timeWindows";
import { useSettings } from "../../settings/SettingsContext";
import type { TimeWindowId } from "../../planning/timeWindows";

export default function SettingsPlanningSection() {
  const { settings, updatePlanning } = useSettings();
  if (!settings) {
    return null;
  }

  const planning = settings.planning;

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">Resupply preferences</h3>
          <p className="mt-1 text-sm text-muted">
            Which stop types the planner considers. Changes apply after re-analysis in the
            Analysis section.
          </p>
        </div>
        <PoiProfileSettings
          profile={planning.poi_profile}
          onChange={(profile) => void updatePlanning({ poi_profile: profile })}
        />
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">Gap thresholds</h3>
          <p className="mt-1 text-sm text-muted">
            When to highlight long unsupported sections on maps and profiles. Defaults work for
            most ultra routes — adjust only if your race has unusual resupply rules.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-muted">
            Preferred stage length
            <select
              value={planning.preferred_stage_length_km}
              onChange={(event) =>
                void updatePlanning({ preferred_stage_length_km: Number(event.target.value) })
              }
              className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
            >
              {[25, 50, 75, 100].map((value) => (
                <option key={value} value={value}>
                  {value} km
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-muted">
            Max distance without reliable resupply
            <select
              value={planning.max_gap_without_resupply_km}
              onChange={(event) =>
                void updatePlanning({ max_gap_without_resupply_km: Number(event.target.value) })
              }
              className="mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink"
            >
              {[30, 50, 70, 100].map((value) => (
                <option key={value} value={value}>
                  {value} km
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">Expected arrival</h3>
          <p className="mt-1 text-sm text-muted">
            Default time window for stop availability. You can still change this while exploring
            on the Route page.
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => void updatePlanning({ default_arrival_time_window: null })}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              planning.default_arrival_time_window === null
                ? "bg-accent text-white"
                : "bg-canvas text-ink"
            }`}
          >
            Any time
          </button>
          {TIME_WINDOWS.map((window) => (
            <button
              key={window.id}
              type="button"
              onClick={() =>
                void updatePlanning({
                  default_arrival_time_window: window.id as TimeWindowId,
                })
              }
              className={`rounded-lg px-3 py-1.5 text-sm ${
                planning.default_arrival_time_window === window.id
                  ? "bg-accent text-white"
                  : "bg-canvas text-ink"
              }`}
            >
              {window.label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
