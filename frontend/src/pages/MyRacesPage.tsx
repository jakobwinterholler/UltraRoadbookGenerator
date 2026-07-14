import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DeleteRaceDialog } from "@shared/ui/DeleteRaceDialog";
import { getDesktopRaceSyncStatus } from "@shared/ui/SyncStatusBadge";
import { useAuth } from "@shared/auth/AuthProvider";
import { getPendingSyncRaces } from "@shared/sync/pendingSync";
import UploadZone from "../components/UploadZone";
import { RaceCard } from "../components/races/RaceCard";
import type { RaceManageAction } from "../components/races/RaceManageMenu";
import { RenameRaceDialog } from "../components/races/RenameRaceDialog";
import { useRace } from "../races/RaceContext";
import {
  archiveRace,
  createRace,
  deleteRace,
  duplicateRace,
  fetchRaces,
  raceExportEndpoint,
  renameRace,
  type RaceSummary,
} from "../races/api";
import { useAccountSync } from "../sync/useAccountSync";
import { useDesktopCloudRaces } from "../sync/useDesktopCloudRaces";

interface MyRacesPageProps {
  onRaceCreated: (raceId: string) => void;
  onOpenRace: (raceId: string) => void;
}

export default function MyRacesPage({ onRaceCreated, onOpenRace }: MyRacesPageProps) {
  const { races, loadingRaces, error, refreshRaces, activeRaceId, closeRace } = useRace();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const { syncing } = useAccountSync();
  const { cloudById } = useDesktopCloudRaces();
  const [showCreate, setShowCreate] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [raceName, setRaceName] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [archivedRaces, setArchivedRaces] = useState<RaceSummary[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [renameTarget, setRenameTarget] = useState<RaceSummary | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RaceSummary | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [pendingRevision, setPendingRevision] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const pendingSync = useMemo(
    () => getPendingSyncRaces(userId),
    [userId, pendingRevision, syncing],
  );

  useEffect(() => {
    void refreshRaces();
  }, [refreshRaces]);

  useEffect(() => {
    if (!showArchived) {
      return;
    }
    void fetchRaces(true)
      .then((all) => setArchivedRaces(all.filter((race) => race.archived_at)))
      .catch(() => setArchivedRaces([]));
  }, [showArchived, races]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (showCreate && !dialog.open) {
      dialog.showModal();
    }
    if (!showCreate && dialog.open) {
      dialog.close();
    }
  }, [showCreate]);

  function resetCreateForm() {
    setFile(null);
    setRaceName("");
    setCreateError(null);
    setIsDragging(false);
  }

  function openCreateDialog() {
    resetCreateForm();
    setShowCreate(true);
  }

  function closeCreateDialog() {
    setShowCreate(false);
    resetCreateForm();
  }

  async function handleCreateRace() {
    if (!file) {
      setCreateError("Choose a GPX file first.");
      return;
    }

    setCreating(true);
    setCreateError(null);
    try {
      const race = await createRace(file, raceName || undefined);
      closeCreateDialog();
      await refreshRaces();
      onRaceCreated(race.id);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create race.");
    } finally {
      setCreating(false);
    }
  }

  const handleManage = useCallback(
    async (raceId: string, action: RaceManageAction) => {
      const race = [...races, ...archivedRaces].find((entry) => entry.id === raceId);
      if (!race) {
        return;
      }
      setPageError(null);

      if (action === "rename") {
        setRenameTarget(race);
        return;
      }
      if (action === "delete") {
        setDeleteTarget(race);
        return;
      }
      if (action === "export-excel" || action === "export-gpx") {
        const type = action === "export-excel" ? "excel" : "validation-gpx";
        window.open(raceExportEndpoint(raceId, type), "_blank", "noopener,noreferrer");
        return;
      }

      setActionBusy(true);
      try {
        if (action === "duplicate") {
          const copy = await duplicateRace(raceId);
          await refreshRaces();
          onOpenRace(copy.id);
          return;
        }
        if (action === "archive") {
          await archiveRace(raceId, true);
          if (activeRaceId === raceId) {
            closeRace();
          }
          await refreshRaces();
          if (showArchived) {
            const all = await fetchRaces(true);
            setArchivedRaces(all.filter((entry) => entry.archived_at));
          }
          return;
        }
        if (action === "unarchive") {
          await archiveRace(raceId, false);
          await refreshRaces();
          if (showArchived) {
            const all = await fetchRaces(true);
            setArchivedRaces(all.filter((entry) => entry.archived_at));
          }
        }
      } catch (err) {
        setPageError(err instanceof Error ? err.message : "Action failed.");
      } finally {
        setActionBusy(false);
      }
    },
    [activeRaceId, archivedRaces, closeRace, onOpenRace, races, refreshRaces, showArchived],
  );

  async function confirmRename(name: string) {
    if (!renameTarget) {
      return;
    }
    setActionBusy(true);
    setPageError(null);
    try {
      await renameRace(renameTarget.id, name);
      setRenameTarget(null);
      await refreshRaces();
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Failed to rename race.");
    } finally {
      setActionBusy(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) {
      return;
    }
    setActionBusy(true);
    setPageError(null);
    try {
      await deleteRace(deleteTarget.id);
      if (activeRaceId === deleteTarget.id) {
        closeRace();
      }
      setDeleteTarget(null);
      await refreshRaces();
      setPendingRevision((value) => value + 1);
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Failed to delete race.");
    } finally {
      setActionBusy(false);
    }
  }

  const activeRaces = races.filter((race) => !race.archived_at);
  const hasArchived = archivedRaces.length > 0 || races.some((race) => race.archived_at);

  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink">My Races</h1>
          <p className="mt-2 text-base text-muted">
            Each race is your workspace — route, analysis, preparation, and exports together.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateDialog}
          className="rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent/90"
        >
          New race
        </button>
      </header>

      {(error || createError || pageError) && !showCreate && (
        <p className="mb-6 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error ?? createError ?? pageError}
        </p>
      )}

      {loadingRaces && activeRaces.length === 0 ? (
        <p className="text-sm text-muted">Loading your races…</p>
      ) : activeRaces.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-card/50 px-8 py-16 text-center">
          <h2 className="text-xl font-semibold text-ink">No races yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Upload a GPX to create your first race workspace. Analysis and preparation will live here.
          </p>
          <button
            type="button"
            onClick={openCreateDialog}
            className="mt-6 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-accent/90"
          >
            Create your first race
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activeRaces.map((race) => (
            <RaceCard
              key={race.id}
              race={race}
              onOpen={onOpenRace}
              onManage={(raceId, action) => void handleManage(raceId, action)}
              syncStatus={getDesktopRaceSyncStatus(
                race,
                cloudById,
                syncing,
                Boolean(user),
                pendingSync,
              )}
            />
          ))}
        </div>
      )}

      {hasArchived ? (
        <section className="mt-10">
          <button
            type="button"
            onClick={() => setShowArchived((current) => !current)}
            className="text-sm font-medium text-muted transition hover:text-ink"
          >
            {showArchived ? "Hide archived races" : "Show archived races"}
          </button>
          {showArchived && archivedRaces.length > 0 ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {archivedRaces.map((race) => (
                <RaceCard
                  key={race.id}
                  race={race}
                  onOpen={onOpenRace}
                  onManage={(raceId, action) => void handleManage(raceId, action)}
                  syncStatus={getDesktopRaceSyncStatus(
                    race,
                    cloudById,
                    syncing,
                    Boolean(user),
                    pendingSync,
                  )}
                />
              ))}
            </div>
          ) : showArchived ? (
            <p className="mt-3 text-sm text-muted">No archived races.</p>
          ) : null}
        </section>
      ) : null}

      <RenameRaceDialog
        open={Boolean(renameTarget)}
        currentName={renameTarget?.name ?? ""}
        busy={actionBusy}
        onClose={() => setRenameTarget(null)}
        onConfirm={(name) => void confirmRename(name)}
      />

      <DeleteRaceDialog
        open={Boolean(deleteTarget)}
        raceName={deleteTarget?.name ?? ""}
        busy={actionBusy}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
      />

      <dialog
        ref={dialogRef}
        className="w-full max-w-lg rounded-2xl border border-line bg-card p-0 shadow-xl backdrop:bg-ink/20"
        onClose={closeCreateDialog}
      >
        <form
          method="dialog"
          className="p-6"
          onSubmit={(event) => {
            event.preventDefault();
            void handleCreateRace();
          }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-ink">New race</h2>
              <p className="mt-1 text-sm text-muted">Upload a GPX to start a new race workspace.</p>
            </div>
            <button
              type="button"
              onClick={closeCreateDialog}
              className="rounded-lg px-2 py-1 text-sm text-muted hover:bg-canvas hover:text-ink"
            >
              Close
            </button>
          </div>

          <div className="mt-6">
            <UploadZone
              file={file}
              isDragging={isDragging}
              onDragEnter={() => setIsDragging(true)}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(selected) => {
                setFile(selected);
                setIsDragging(false);
                if (!raceName) {
                  setRaceName(selected.name.replace(/\.gpx$/i, "").replace(/[_-]+/g, " "));
                }
              }}
              onSelectFile={(selected) => {
                setFile(selected);
                if (!raceName) {
                  setRaceName(selected.name.replace(/\.gpx$/i, "").replace(/[_-]+/g, " "));
                }
              }}
            />
          </div>

          <label className="mt-4 block text-sm text-muted">
            Race name
            <input
              type="text"
              value={raceName}
              onChange={(event) => setRaceName(event.target.value)}
              placeholder="The Capitals 2026"
              className="mt-1 w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm text-ink"
            />
          </label>

          {createError && (
            <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{createError}</p>
          )}

          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={closeCreateDialog}
              className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!file || creating}
              className="rounded-xl bg-accent px-5 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {creating ? "Creating…" : "Create race"}
            </button>
          </div>
        </form>
      </dialog>
    </div>
  );
}
