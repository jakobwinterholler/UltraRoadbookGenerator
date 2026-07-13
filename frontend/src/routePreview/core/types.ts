export type RoutePreviewSceneType =
  | "title"
  | "overview"
  | "start"
  | "finish"
  | "climb"
  | "town"
  | "verified_stop"
  | "unsupported"
  | "remote"
  | "scenery"
  | "coastline"
  | "valley"
  | "gravel"
  | "highest_point";

export interface TrackPoint {
  lat: number;
  lon: number;
  km: number;
  ele_m: number;
}

export interface RoutePreviewKmRange {
  startKm: number;
  endKm: number;
}

export type RoutePreviewOverlayMode = "card" | "climb" | "breath" | "none";

export type SceneBeatRole = "intro" | "study" | "traverse" | "summary";

export interface RoutePreviewSceneBeat {
  id: string;
  role: SceneBeatRole;
  /** Local scene time 0–1 when this beat starts. */
  startT: number;
  /** Local scene time 0–1 when this beat ends. */
  endT: number;
  /** hold = camera still; drift = slow follow along route. */
  camera: "hold" | "drift";
  /** Route position 0–1 at beat start (within scene or climb span). */
  kmTFrom: number;
  /** Route position 0–1 at beat end — only used during drift. */
  kmTTo: number;
  /** One teaching line for this moment. */
  teach?: string;
}

export interface RoutePreviewScene {
  id: string;
  order: number;
  type: RoutePreviewSceneType;
  title: string;
  description: string;
  whyChosen: string;
  /** What the rider should understand after this scene. */
  learningGoal: string;
  screenTimeS: number;
  transitionAfterS: number;
  kmRange: RoutePreviewKmRange;
  priority: number;
  overlayMode?: RoutePreviewOverlayMode;
  overlay?: RoutePreviewOverlayContent;
  beats?: RoutePreviewSceneBeat[];
}

export interface RoutePreviewOverlayContent {
  eyebrow: string;
  name: string;
  statsLines: string[];
  narrative?: string;
  waterLabel?: string;
  waterValue?: string;
}

export interface RoutePreviewTimelineEntry {
  sceneId: string;
  sceneOrder: number;
  sceneType: RoutePreviewSceneType;
  title: string;
  startS: number;
  endS: number;
  transitionAfterS: number;
  kmRange: RoutePreviewKmRange;
}

export interface RoutePreviewQualityPreset {
  width: number;
  height: number;
  terrainSegments: number;
  routeTubeSegments: number;
}

export interface RoutePreviewRuntime {
  version: 2;
  raceId: string;
  raceName: string;
  routeName: string;
  distanceKm: number;
  totalDurationS: number;
  scenes: RoutePreviewScene[];
  timeline: RoutePreviewTimelineEntry[];
  /** Sparse samples along the full route — camera interpolation and overview terrain. */
  routeSamples?: TrackPoint[];
  /** Dense corridor geometry for local scene route meshes. */
  track: TrackPoint[];
  featuredClimb?: {
    id: string;
    name: string;
    startKm: number;
    endKm: number;
    lengthKm: number;
    elevationGainM: number;
    avgGradientPct: number;
    max250mPct?: number;
    max500mPct?: number;
    mentalNote?: string;
    lastVerifiedWater?: {
      poiName: string;
      km: number;
      hubName?: string;
    } | null;
  };
  meta?: {
    generatedAt: string;
    storyVersion: string;
    runtimeVersion: string;
    cameraVersion: string;
    pipelineVersion: string;
  };
  settings: {
    fps: number;
    draft: RoutePreviewQualityPreset;
    final: RoutePreviewQualityPreset;
  };
}

export interface RouteProgress {
  timeS: number;
  scene: RoutePreviewTimelineEntry;
  sceneIndex: number;
  localT: number;
  km: number;
  inClimb: boolean;
  climbT: number;
}

export interface PlaybackState {
  timeS: number;
  isPlaying: boolean;
  activeSceneIndex: number;
  replayUntilS: number | null;
}

export interface ClimbStripState {
  visible: boolean;
  opacity: number;
  distIntoKm: number;
  distRemainingKm: number;
  gainedM: number;
  remainingM: number;
  altitudeM: number;
  altitudeSub: string;
  gradientPct: number;
  gradientWindowM: number;
  markerT: number;
  lastVerifiedWater?: {
    poiName: string;
    km: number;
    hubName?: string;
  } | null;
}

export interface OverlayFrameState {
  visible: boolean;
  opacity: number;
  translateY: number;
  content: RoutePreviewOverlayContent | null;
  climbStrip: ClimbStripState | null;
  inTransition: boolean;
}
