import { useState } from "react";
import type { CompanionVerificationServices } from "@shared/types/verification";

export interface QuickTagSelection {
  services: CompanionVerificationServices;
  permanentlyClosed?: boolean;
  temporarilyClosed?: boolean;
  openingHours?: string | null;
  rejectReason?: string;
  notes?: string | null;
}

interface VerificationQuickTagsProps {
  onDone: (selection: QuickTagSelection) => void;
  onSkip: () => void;
}

const TAGS = [
  { key: "hasWater", label: "Water available" },
  { key: "hasFood", label: "Food available" },
  { key: "hasFuel", label: "Fuel available" },
  { key: "hasToilet", label: "Toilet" },
  { key: "open247", label: "24/7" },
  { key: "closed", label: "Closed" },
  { key: "permanentlyClosed", label: "Permanently closed" },
  { key: "construction", label: "Construction" },
  { key: "differentLocation", label: "Different location" },
] as const;

type TagKey = (typeof TAGS)[number]["key"];

export default function VerificationQuickTags({ onDone, onSkip }: VerificationQuickTagsProps) {
  const [active, setActive] = useState<Set<TagKey>>(new Set());
  const [note, setNote] = useState("");

  function toggle(key: TagKey) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function buildSelection(): QuickTagSelection {
    const services: CompanionVerificationServices = {
      hasWater: active.has("hasWater") || undefined,
      hasFood: active.has("hasFood") || undefined,
      hasFuel: active.has("hasFuel") || undefined,
      hasToilet: active.has("hasToilet") || undefined,
    };
    return {
      services,
      permanentlyClosed: active.has("permanentlyClosed") || undefined,
      temporarilyClosed: active.has("closed") || undefined,
      openingHours: active.has("open247") ? "24/7" : undefined,
      rejectReason: active.has("construction")
        ? "construction"
        : active.has("differentLocation")
          ? "different_location"
          : active.has("permanentlyClosed")
            ? "permanently_closed"
            : active.has("closed")
              ? "closed"
              : undefined,
      notes: note.trim() || null,
    };
  }

  return (
    <div className="verification-quick-tags">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-orange-300">
        Quick tags
      </p>
      <p className="mt-1 text-sm text-white/55">Optional — tap any that apply, then done.</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {TAGS.map((tag) => (
          <button
            key={tag.key}
            type="button"
            onClick={() => toggle(tag.key)}
            className={`verification-tag-btn ${active.has(tag.key) ? "verification-tag-btn--active" : ""}`}
          >
            {tag.label}
          </button>
        ))}
      </div>
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Optional note"
        rows={2}
        className="mt-4 w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-orange-400/50"
      />
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onSkip}
          className="flex-1 rounded-xl border border-white/15 px-4 py-3 text-sm font-medium text-white/70"
        >
          Skip
        </button>
        <button
          type="button"
          onClick={() => onDone(buildSelection())}
          className="flex-1 rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white"
        >
          Done
        </button>
      </div>
    </div>
  );
}
