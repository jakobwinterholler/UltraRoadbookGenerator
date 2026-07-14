import { useEffect, useId, useRef, useState } from "react";

interface RenameRaceDialogProps {
  open: boolean;
  currentName: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (name: string) => void;
}

export function RenameRaceDialog({
  open,
  currentName,
  busy = false,
  onClose,
  onConfirm,
}: RenameRaceDialogProps) {
  const [name, setName] = useState(currentName);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      setName(currentName);
      dialog.showModal();
      queueMicrotask(() => dialog.querySelector<HTMLInputElement>("input")?.select());
    }
    if (!open && dialog.open) {
      dialog.close();
    }
  }, [currentName, open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    function handleCancel(event: Event) {
      event.preventDefault();
      onClose();
    }
    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [onClose]);

  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && trimmed !== currentName.trim() && !busy;

  return (
    <dialog
      ref={dialogRef}
      className="w-full max-w-md rounded-2xl border border-line bg-card p-0 shadow-xl backdrop:bg-ink/40"
      onClose={onClose}
    >
      <form
        method="dialog"
        className="p-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSave) {
            onConfirm(trimmed);
          }
        }}
      >
        <h3 className="text-lg font-semibold text-ink">Rename race</h3>
        <label htmlFor={inputId} className="mt-4 block text-sm text-muted">
          Race name
          <input
            id={inputId}
            type="text"
            value={name}
            autoComplete="off"
            onChange={(event) => setName(event.target.value)}
            className="mt-1.5 w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm text-ink"
          />
        </label>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-ink"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
