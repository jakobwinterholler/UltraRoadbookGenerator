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
      className={`pointer-events-auto min-h-[44px] rounded-2xl px-4 py-2.5 text-sm font-semibold shadow-lg backdrop-blur-xl transition ${
        active
          ? "bg-sky-500 text-white ring-1 ring-sky-400/40"
          : "border border-white/12 bg-black/55 text-white/90 hover:bg-white/8"
      }`}
    >
      {loading ? "Searching…" : active ? `✓ ${candidateCount} found` : "🔍 Discover Better Stops"}
    </button>
  );
}
