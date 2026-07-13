import { useEffect, useState } from "react";
import type { StopRejectReason } from "../../planning/stopVerification/types";
import { rejectReasonGroups } from "../../planning/stopVerification/rejectReasonPresentation";

interface StopRejectReasonSheetProps {
  stopName: string;
  poiCategory?: string | null;
  categoryKey?: string;
  onSelect: (reason: StopRejectReason, notes?: string) => void;
  onCancel: () => void;
}

export default function StopRejectReasonSheet({
  stopName,
  poiCategory,
  categoryKey,
  onSelect,
  onCancel,
}: StopRejectReasonSheetProps) {
  const [pendingOther, setPendingOther] = useState(false);
  const [notes, setNotes] = useState("");
  const groups = rejectReasonGroups(poiCategory, categoryKey);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (pendingOther) {
          setPendingOther(false);
          setNotes("");
        } else {
          onCancel();
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel, pendingOther]);

  function handleReasonClick(reason: StopRejectReason) {
    if (reason === "other") {
      setPendingOther(true);
      return;
    }
    onSelect(reason);
  }

  function handleOtherConfirm() {
    onSelect("other", notes.trim() || undefined);
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/40 p-4 backdrop-blur-[1px]"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="flex max-h-[min(90vh,640px)] w-full max-w-sm flex-col rounded-2xl border border-line bg-card shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="reject-reason-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="shrink-0 border-b border-line/60 px-4 py-3">
          <h2 id="reject-reason-title" className="text-base font-semibold text-ink">
            Reason?
          </h2>
          <p className="mt-0.5 truncate text-xs text-muted">{stopName}</p>
        </div>

        {pendingOther ? (
          <div className="px-4 py-4">
            <p className="text-sm text-ink">Other — add a note (optional)</p>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              autoFocus
              placeholder="What made this a bad stop?"
              className="mt-2 w-full resize-none rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-accent/40 focus:outline-none"
            />
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setPendingOther(false);
                  setNotes("");
                }}
                className="flex-1 rounded-lg border border-line px-3 py-2 text-sm font-medium text-muted transition hover:text-ink"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleOtherConfirm}
                className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-700"
              >
                Reject
              </button>
            </div>
          </div>
        ) : (
          <div className="overflow-y-auto px-2 py-2">
            {groups.map((group) => (
              <div key={group.id} className="mb-1 last:mb-0">
                {group.label && (
                  <p className="px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted">
                    {group.label}
                  </p>
                )}
                <div className="space-y-0.5">
                  {group.reasons.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleReasonClick(option.id)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm text-ink transition hover:bg-canvas"
                    >
                      <span
                        className="h-3.5 w-3.5 shrink-0 rounded-full border border-line"
                        aria-hidden
                      />
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
