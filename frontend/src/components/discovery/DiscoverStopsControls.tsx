interface DiscoverStopsControlsProps {
  active: boolean;
  loading: boolean;
  candidateCount: number;
  onToggle: () => void;
}

export default function DiscoverStopsControls({
  active,
  loading,
  candidateCount,
  onToggle,
}: DiscoverStopsControlsProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`pointer-events-auto absolute bottom-4 right-4 z-[1000] rounded-2xl px-4 py-2.5 text-sm font-semibold shadow-card transition ${
        active
          ? "bg-blue-600 text-white hover:bg-blue-700"
          : "border border-line/70 bg-card/95 text-ink hover:bg-canvas"
      }`}
    >
      {loading ? "Searching…" : active ? `✓ ${candidateCount} found` : "🔍 Discover Better Stops"}
    </button>
  );
}
