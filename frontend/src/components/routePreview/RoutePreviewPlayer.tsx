import { formatPlaybackTime } from "../../routePreview/core/math";

interface RoutePreviewPlayerProps {
  isPlaying: boolean;
  timeS: number;
  totalDurationS: number;
  onPlay: () => void;
  onPause: () => void;
  onSeek: (timeS: number) => void;
  onFullscreen: () => void;
}

export default function RoutePreviewPlayer({
  isPlaying,
  timeS,
  totalDurationS,
  onPlay,
  onPause,
  onSeek,
  onFullscreen,
}: RoutePreviewPlayerProps) {
  return (
    <div className="border-t border-white/10 bg-[#0a0a0a] px-4 py-3 md:px-5 md:py-4">
      <input
        type="range"
        min={0}
        max={Math.max(0.001, totalDurationS)}
        step={0.05}
        value={timeS}
        onChange={(event) => onSeek(Number(event.target.value))}
        className="mb-3 w-full accent-white"
        aria-label="Timeline"
      />

      <div className="flex items-center gap-3">
        {isPlaying ? (
          <button
            type="button"
            onClick={onPause}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-base text-black transition hover:bg-white/90"
            aria-label="Pause"
          >
            ⏸
          </button>
        ) : (
          <button
            type="button"
            onClick={onPlay}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-base text-black transition hover:bg-white/90"
            aria-label="Play"
          >
            ▶
          </button>
        )}

        <p className="min-w-0 flex-1 text-sm tabular-nums text-white/70">
          {formatPlaybackTime(timeS)} / {formatPlaybackTime(totalDurationS)}
        </p>

        <button
          type="button"
          onClick={onFullscreen}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/20 text-sm text-white/80 transition hover:bg-white/10"
          aria-label="Fullscreen"
        >
          ⛶
        </button>
      </div>
    </div>
  );
}
