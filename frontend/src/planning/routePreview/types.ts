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

export interface RoutePreviewKmRange {
  startKm: number;
  endKm: number;
}

export interface RoutePreviewScene {
  id: string;
  order: number;
  type: RoutePreviewSceneType;
  title: string;
  description: string;
  whyChosen: string;
  screenTimeS: number;
  transitionAfterS: number;
  kmRange: RoutePreviewKmRange;
  priority: number;
}

export interface RoutePreviewDocument {
  version: 1;
  raceName: string;
  routeName: string;
  distanceKm: number;
  elevationGainM: number;
  targetDurationS: number;
  estimatedDurationS: number;
  sceneCount: number;
  generatedAt: string;
  scenes: RoutePreviewScene[];
}

export interface RoutePreviewCandidate {
  id: string;
  type: RoutePreviewSceneType;
  title: string;
  description: string;
  whyChosen: string;
  startKm: number;
  endKm: number;
  focusKm: number;
  priority: number;
  editorialScore: number;
}
