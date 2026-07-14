import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@shared/auth/AuthProvider";
import {
  fetchCompanionVerifications,
  reviewCompanionVerification,
} from "@shared/api/verifications";
import {
  summarizeVerificationUpdates,
  verificationSummaryHeadline,
} from "@shared/race/verificationSummary";
import type { CompanionVerificationSubmission } from "@shared/types/verification";

interface CompanionVerificationReviewProps {
  raceId: string;
  onReviewed?: () => void;
}

function reviewStatusLabel(item: CompanionVerificationSubmission): string {
  if (item.reviewStatus === "accepted") {
    return "Accepted";
  }
  if (item.reviewStatus === "rejected") {
    return "Rejected";
  }
  return "Pending";
}

function reviewStatusClass(item: CompanionVerificationSubmission): string {
  if (item.reviewStatus === "accepted") {
    return "text-emerald-700";
  }
  if (item.reviewStatus === "rejected") {
    return "text-red-600";
  }
  return "text-amber-700";
}

export default function CompanionVerificationReview({
  raceId,
  onReviewed,
}: CompanionVerificationReviewProps) {
  const { session } = useAuth();
  const [pending, setPending] = useState<CompanionVerificationSubmission[]>([]);
  const [history, setHistory] = useState<CompanionVerificationSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const load = useCallback(async () => {
    if (!session?.access_token) {
      setPending([]);
      setHistory([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [pendingItems, historyItems] = await Promise.all([
        fetchCompanionVerifications(session.access_token, raceId, "pending"),
        fetchCompanionVerifications(session.access_token, raceId, "history"),
      ]);
      setPending(pendingItems);
      setHistory(historyItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load verifications.");
    } finally {
      setLoading(false);
    }
  }, [raceId, session?.access_token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleReview(id: string, action: "accept" | "reject") {
    if (!session?.access_token) {
      return;
    }
    setBusyId(id);
    try {
      await reviewCompanionVerification(session.access_token, raceId, id, action);
      await load();
      onReviewed?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed.");
    } finally {
      setBusyId(null);
    }
  }

  async function handleBulkReview(action: "accept" | "reject") {
    if (!session?.access_token || pending.length === 0) {
      return;
    }
    setBulkBusy(true);
    setError(null);
    try {
      for (const item of pending) {
        await reviewCompanionVerification(session.access_token, raceId, item.id, action);
      }
      await load();
      onReviewed?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk review failed.");
    } finally {
      setBulkBusy(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-muted">Loading verification updates…</p>;
  }

  if (pending.length === 0 && history.length === 0) {
    return null;
  }

  return (
    <section className="mb-10 rounded-2xl border border-amber-200/60 bg-amber-50/50 p-6 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-ink">Verification Updates</h2>
          <p className="mt-1 text-sm text-muted">
            {pending.length > 0
              ? `${pending.length} pending`
              : "No pending updates"}
            {history.length > 0 ? ` · ${history.length} reviewed` : ""}
          </p>
        </div>
        {pending.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => void handleBulkReview("reject")}
              className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:text-ink disabled:opacity-50"
            >
              Reject all
            </button>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => void handleBulkReview("accept")}
              className="rounded-lg bg-ink px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Accept all
            </button>
          </div>
        ) : null}
      </div>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      {pending.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {pending.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-line bg-card px-4 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-ink">{item.stopName}</p>
                  <p className="mt-1 text-xs text-muted">
                    Zone {item.zoneId}
                    {" · "}
                    {new Date(item.submittedAt).toLocaleString()}
                  </p>
                  <p className="mt-2 text-sm font-medium text-ink">
                    {verificationSummaryHeadline(item.updates)}
                  </p>
                  <ul className="mt-1 space-y-0.5 text-sm text-muted">
                    {summarizeVerificationUpdates(item.updates).slice(1).map((line) => (
                      <li key={line}>· {line}</li>
                    ))}
                  </ul>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busyId === item.id || bulkBusy}
                    onClick={() => void handleReview(item.id, "reject")}
                    className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:text-ink disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    disabled={busyId === item.id || bulkBusy}
                    onClick={() => void handleReview(item.id, "accept")}
                    className="rounded-lg bg-ink px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                  >
                    Accept
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {history.length > 0 ? (
        <div className="mt-6 border-t border-amber-200/50 pt-4">
          <button
            type="button"
            onClick={() => setShowHistory((current) => !current)}
            className="text-sm font-medium text-ink hover:text-ink/80"
          >
            {showHistory ? "Hide" : "Show"} review history ({history.length})
          </button>
          {showHistory ? (
            <ul className="mt-3 space-y-2">
              {history.map((item) => (
                <li
                  key={item.id}
                  className="rounded-lg border border-line/70 bg-card/80 px-3 py-2.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">{item.stopName}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {verificationSummaryHeadline(item.updates)}
                        {" · "}
                        {new Date(item.reviewedAt ?? item.submittedAt).toLocaleString()}
                      </p>
                    </div>
                    <span className={`text-xs font-medium ${reviewStatusClass(item)}`}>
                      {reviewStatusLabel(item)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
