import { useEffect, useId, useRef, useState } from "react";

interface DeleteRaceDialogProps {
  open: boolean;
  raceName: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteRaceDialog({
  open,
  raceName,
  busy = false,
  onClose,
  onConfirm,
}: DeleteRaceDialogProps) {
  const [typed, setTyped] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputId = useId();
  const checkboxId = useId();

  const canDelete =
    typed.trim() === raceName.trim() && acknowledged && !busy;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      setTyped("");
      setAcknowledged(false);
      dialog.showModal();
      queueMicrotask(() => dialog.querySelector<HTMLInputElement>("input[type=text]")?.focus());
    }
    if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

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
          if (canDelete) {
            onConfirm();
          }
        }}
      >
        <h3 className="text-lg font-semibold text-ink">Delete race?</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          This permanently removes <span className="font-medium text-ink">{raceName}</span> from
          this computer and the cloud. This cannot be undone.
        </p>

        <label htmlFor={inputId} className="mt-5 block text-sm text-muted">
          Type the race name to confirm
          <input
            id={inputId}
            type="text"
            value={typed}
            autoComplete="off"
            onChange={(event) => setTyped(event.target.value)}
            placeholder={raceName}
            className="mt-1.5 w-full rounded-xl border border-line bg-white px-4 py-2.5 text-sm text-ink"
          />
        </label>

        <label
          htmlFor={checkboxId}
          className="mt-4 flex cursor-pointer items-start gap-3 text-sm text-ink"
        >
          <input
            id={checkboxId}
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-line"
          />
          <span>I understand this permanently deletes the race.</span>
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
            disabled={!canDelete}
            className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Deleting…" : "Delete race"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
