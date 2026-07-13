import { clamp } from "./math";
import {
  nextSceneIndex,
  previousSceneIndex,
  replayEndTime,
  sceneIndexAtTime,
  seekTimeForScene,
} from "./timeline";
import type { PlaybackState, RoutePreviewRuntime } from "./types";

export interface PlaybackControllerOptions {
  runtime: RoutePreviewRuntime;
  onTimeChange?: (timeS: number) => void;
  onPlayingChange?: (isPlaying: boolean) => void;
  onSceneChange?: (sceneIndex: number) => void;
}

export class PlaybackController {
  private runtime: RoutePreviewRuntime;
  private timeS = 0;
  private isPlaying = false;
  private replayUntilS: number | null = null;
  private rafId: number | null = null;
  private lastFrameAt: number | null = null;
  private readonly onTimeChange?: (timeS: number) => void;
  private readonly onPlayingChange?: (isPlaying: boolean) => void;
  private readonly onSceneChange?: (sceneIndex: number) => void;

  constructor(options: PlaybackControllerOptions) {
    this.runtime = options.runtime;
    this.onTimeChange = options.onTimeChange;
    this.onPlayingChange = options.onPlayingChange;
    this.onSceneChange = options.onSceneChange;
  }

  getState(): PlaybackState {
    return {
      timeS: this.timeS,
      isPlaying: this.isPlaying,
      activeSceneIndex: sceneIndexAtTime(this.runtime.timeline, this.timeS),
      replayUntilS: this.replayUntilS,
    };
  }

  setRuntime(runtime: RoutePreviewRuntime): void {
    this.runtime = runtime;
    this.timeS = clamp(this.timeS, 0, runtime.totalDurationS);
    this.emitTime();
  }

  seek(timeS: number): void {
    this.timeS = clamp(timeS, 0, this.runtime.totalDurationS);
    this.replayUntilS = null;
    this.emitTime();
  }

  jumpToScene(sceneId: string): void {
    this.seek(seekTimeForScene(this.runtime.timeline, sceneId));
  }

  jumpToSceneIndex(sceneIndex: number): void {
    const entry = this.runtime.timeline[sceneIndex];
    if (entry) {
      this.seek(entry.startS);
    }
  }

  nextScene(): void {
    const state = this.getState();
    this.jumpToSceneIndex(nextSceneIndex(state.activeSceneIndex, this.runtime.timeline.length));
  }

  previousScene(): void {
    const state = this.getState();
    this.jumpToSceneIndex(previousSceneIndex(state.activeSceneIndex));
  }

  replayCurrentScene(): void {
    const state = this.getState();
    const entry = this.runtime.timeline[state.activeSceneIndex];
    if (!entry) {
      return;
    }
    this.timeS = entry.startS;
    this.replayUntilS = replayEndTime(entry);
    this.play();
  }

  play(): void {
    if (this.isPlaying) {
      return;
    }
    this.isPlaying = true;
    this.onPlayingChange?.(true);
    this.lastFrameAt = performance.now();
    this.tick();
  }

  pause(): void {
    this.isPlaying = false;
    this.replayUntilS = null;
    this.onPlayingChange?.(false);
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  dispose(): void {
    this.pause();
  }

  private tick = (): void => {
    if (!this.isPlaying) {
      return;
    }

    const now = performance.now();
    const deltaS = this.lastFrameAt ? (now - this.lastFrameAt) / 1000 : 0;
    this.lastFrameAt = now;

    const previousSceneIndexValue = sceneIndexAtTime(this.runtime.timeline, this.timeS);
    this.timeS = clamp(this.timeS + deltaS, 0, this.runtime.totalDurationS);

    if (this.replayUntilS !== null && this.timeS >= this.replayUntilS) {
      this.timeS = this.replayUntilS;
      this.pause();
    } else if (this.timeS >= this.runtime.totalDurationS) {
      this.timeS = this.runtime.totalDurationS;
      this.pause();
    }

    const nextSceneIndexValue = sceneIndexAtTime(this.runtime.timeline, this.timeS);
    if (nextSceneIndexValue !== previousSceneIndexValue) {
      this.onSceneChange?.(nextSceneIndexValue);
    }

    this.emitTime();
    this.rafId = requestAnimationFrame(this.tick);
  };

  private emitTime(): void {
    this.onTimeChange?.(this.timeS);
    this.onSceneChange?.(sceneIndexAtTime(this.runtime.timeline, this.timeS));
  }
}
