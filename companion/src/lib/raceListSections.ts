import type { CompanionBundle } from "@shared/types/sync";
import type { StoredRaceListItem } from "../db";

export type RaceListSectionId = "recent" | "downloaded" | "cloud";

export interface RaceListSection {
  id: RaceListSectionId;
  title: string;
  races: StoredRaceListItem[];
}

function verifiedPercentFromBundle(bundle: CompanionBundle | null): number | null {
  if (!bundle?.dashboardStats) {
    return null;
  }
  const verified = bundle.dashboardStats.verifiedStops ?? 0;
  const unverified = bundle.dashboardStats.unverifiedStops ?? 0;
  const total = verified + unverified;
  if (total <= 0) {
    return 0;
  }
  return Math.round((verified / total) * 100);
}

export function formatLastUpdated(value: string | null | undefined): string {
  if (!value) {
    return "Unknown";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown";
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function buildRaceListSections(races: StoredRaceListItem[]): RaceListSection[] {
  const downloaded = races.filter((race) => race.offlineReady);
  const cloudOnly = races.filter((race) => !race.offlineReady && race.has_bundle);
  const recent = [...races]
    .sort((left, right) => {
      const leftTime = left.lastOpenedAt ?? left.updated_at ?? "";
      const rightTime = right.lastOpenedAt ?? right.updated_at ?? "";
      return rightTime.localeCompare(leftTime);
    })
    .slice(0, 5);

  const sections: RaceListSection[] = [];
  if (recent.length > 0) {
    sections.push({ id: "recent", title: "Recent", races: recent });
  }
  if (downloaded.length > 0) {
    sections.push({ id: "downloaded", title: "Downloaded", races: downloaded });
  }
  if (cloudOnly.length > 0) {
    sections.push({ id: "cloud", title: "Cloud", races: cloudOnly });
  }
  return sections;
}

export { verifiedPercentFromBundle };
