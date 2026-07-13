import type { PoiPlanningProfile } from "../api";

interface PoiProfileSettingsProps {
  profile: PoiPlanningProfile;
  onChange: (profile: PoiPlanningProfile) => void;
}

const PRIORITY_1: Array<{ key: keyof PoiPlanningProfile; label: string }> = [
  { key: "mini_supermarkets", label: "Mini supermarkets" },
  { key: "convenience_stores", label: "Convenience stores" },
  { key: "small_supermarkets", label: "Small supermarkets" },
  { key: "gas_stations", label: "Gas stations" },
  { key: "drinking_water", label: "Public drinking water" },
];

const PRIORITY_2: Array<{ key: keyof PoiPlanningProfile; label: string }> = [
  { key: "bakeries", label: "Bakeries" },
];

const OPTIONAL: Array<{ key: keyof PoiPlanningProfile; label: string }> = [
  { key: "restaurants", label: "Restaurants" },
  { key: "cafes", label: "Cafés" },
  { key: "fast_food", label: "Fast food" },
  { key: "atms", label: "ATMs" },
  { key: "pharmacies", label: "Pharmacies" },
  { key: "bike_shops", label: "Bike shops" },
];

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg bg-canvas px-3 py-2 text-sm">
      <span className="text-ink">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 rounded border-line text-accent focus:ring-accent"
      />
    </label>
  );
}

export default function PoiProfileSettings({ profile, onChange }: PoiProfileSettingsProps) {
  function updateField<Key extends keyof PoiPlanningProfile>(key: Key, value: PoiPlanningProfile[Key]) {
    onChange({ ...profile, [key]: value });
  }

  return (
    <div className="space-y-4 rounded-2xl border border-line bg-card p-3 shadow-card">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">POI profile</p>
        <p className="mt-1 text-sm text-muted">
          Tuned for unsupported ultra cycling. Changes apply on the next analysis.
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Priority 1</p>
        {PRIORITY_1.map((item) => (
          <ToggleRow
            key={item.key}
            label={item.label}
            checked={Boolean(profile[item.key])}
            onChange={(checked) => updateField(item.key, checked)}
          />
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Priority 2</p>
        {PRIORITY_2.map((item) => (
          <ToggleRow
            key={item.key}
            label={item.label}
            checked={Boolean(profile[item.key])}
            onChange={(checked) => updateField(item.key, checked)}
          />
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Optional</p>
        {OPTIONAL.map((item) => (
          <ToggleRow
            key={item.key}
            label={item.label}
            checked={Boolean(profile[item.key])}
            onChange={(checked) => updateField(item.key, checked)}
          />
        ))}
      </div>

      <div className="space-y-2 border-t border-line pt-3">
        <ToggleRow
          label="Dining fallback in food deserts"
          checked={profile.dining_fallback_enabled}
          onChange={(checked) => updateField("dining_fallback_enabled", checked)}
        />
        <label className="flex items-center justify-between gap-3 rounded-lg bg-canvas px-3 py-2 text-sm">
          <span className="text-ink">Food desert gap (km)</span>
          <input
            type="number"
            min={5}
            max={120}
            step={5}
            value={profile.dining_fallback_km}
            onChange={(event) => updateField("dining_fallback_km", Number(event.target.value))}
            className="w-20 rounded-md border border-line bg-white px-2 py-1 text-right tabular-nums"
          />
        </label>
      </div>
    </div>
  );
}
