import { useMemo, useState } from "react";
import type { ClimbCandidateRow, ClimbRow, RoadbookResult } from "../api";
import { saveRaceClimbNicknames } from "../races/api";
import ClimbDetailView from "../components/climb/ClimbDetailView";
import ClimbTable from "../components/ClimbTable";
import KeyClimbsSection from "../components/KeyClimbsSection";
import {
  analyzeClimbs,
  filterAnalyzedClimbs,
  selectKeyClimbs,
  sortAnalyzedClimbs,
  type ClimbSortMode,
} from "../planning/climbAnalysis";

interface ClimbsPageProps {
  raceId: string;
  climbs: ClimbRow[];
  climbCandidates: ClimbCandidateRow[];
  route: RoadbookResult["route"];
  pois: RoadbookResult["pois"];
  resupplyZones: RoadbookResult["resupply_zones"];
  totalKm: number;
  onClimbsUpdated: (
    climbs: ClimbRow[],
    climbCandidates: ClimbCandidateRow[],
    climbCount: number,
  ) => void;
}

export default function ClimbsPage({
  raceId,
  climbs,
  climbCandidates,
  route,
  pois,
  resupplyZones,
  totalKm,
  onClimbsUpdated,
}: ClimbsPageProps) {
  const [savingNicknames, setSavingNicknames] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedClimbId, setSelectedClimbId] = useState<string | null>(null);
  const [nicknameDraft, setNicknameDraft] = useState<Record<string, string>>({});
  const [sortMode, setSortMode] = useState<ClimbSortMode>("route_order");
  const [searchQuery, setSearchQuery] = useState("");

  const mergedClimbs = useMemo(
    () =>
      climbs.map((climb) => ({
        ...climb,
        nickname: nicknameDraft[climb.id] ?? climb.nickname,
      })),
    [climbs, nicknameDraft],
  );

  const analyzedClimbs = useMemo(() => analyzeClimbs(mergedClimbs), [mergedClimbs]);
  const keyClimbs = useMemo(() => selectKeyClimbs(analyzedClimbs), [analyzedClimbs]);
  const tableClimbs = useMemo(() => {
    const filtered = filterAnalyzedClimbs(analyzedClimbs, searchQuery);
    return sortAnalyzedClimbs(filtered, sortMode);
  }, [analyzedClimbs, searchQuery, sortMode]);

  const selectedClimb = useMemo(
    () => mergedClimbs.find((climb) => climb.id === selectedClimbId) ?? null,
    [mergedClimbs, selectedClimbId],
  );

  function handleSelectClimb(climbId: string) {
    setSelectedClimbId((current) => (current === climbId ? null : climbId));
  }

  async function persistNicknames(nextDraft: Record<string, string>, raceId: string) {
    setSavingNicknames(true);
    setError(null);
    try {
      const payload = Object.fromEntries(
        Object.entries(nextDraft).filter(([, value]) => value.trim().length > 0),
      );
      const response = await saveRaceClimbNicknames(raceId, payload);
      onClimbsUpdated(response.climbs, climbCandidates, response.climbs.length);
      setNicknameDraft({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save nicknames.");
    } finally {
      setSavingNicknames(false);
    }
  }

  function handleNicknameChange(climbId: string, nickname: string) {
    setNicknameDraft((current) => ({ ...current, [climbId]: nickname }));
  }

  function handleNicknameBlur(climbId: string) {
    const draft = nicknameDraft[climbId];
    if (draft === undefined) {
      return;
    }
    void persistNicknames(nicknameDraft, raceId);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-10">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-ink">Climbs</h2>
        <p className="mt-1 text-sm text-muted">
          {climbs.length} climbs detected · which ones deserve your preparation?
        </p>
      </div>

      {selectedClimb && (
        <ClimbDetailView
          climb={selectedClimb}
          route={route}
          pois={pois}
          zones={resupplyZones}
          totalKm={totalKm}
          onClose={() => setSelectedClimbId(null)}
        />
      )}

      <KeyClimbsSection
        climbs={keyClimbs}
        selectedClimbId={selectedClimbId}
        onSelectClimb={handleSelectClimb}
      />

      <ClimbTable
        climbs={tableClimbs}
        selectedClimbId={selectedClimbId}
        onSelectClimb={handleSelectClimb}
        editableNicknames
        onNicknameChange={handleNicknameChange}
        onNicknameBlur={handleNicknameBlur}
        sortMode={sortMode}
        onSortModeChange={setSortMode}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        showControls
      />

      {error && <p className="text-sm text-red-700">{error}</p>}
      {savingNicknames && <p className="text-xs text-muted">Saving nicknames…</p>}
    </div>
  );
}
