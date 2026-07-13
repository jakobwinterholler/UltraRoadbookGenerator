export type RoutePreviewVisualStyle = "map-2d" | "map-2d5" | "terrain-3d";

export interface VisualStyleOption {
  id: RoutePreviewVisualStyle;
  label: string;
  title: string;
  description: string;
}

export const VISUAL_STYLE_OPTIONS: VisualStyleOption[] = [
  {
    id: "map-2d",
    label: "A",
    title: "Experiment A — flat map",
    description: "Can you follow the route, spot towns, and see where it gets remote?",
  },
  {
    id: "map-2d5",
    label: "B",
    title: "Experiment B — map + relief",
    description: "Does subtle terrain help you understand valleys and climbs, or add noise?",
  },
  {
    id: "terrain-3d",
    label: "C",
    title: "Experiment C — full 3D",
    description: "Does 3D everywhere teach the race better, or distract from the route?",
  },
];

/** Questions to ask while comparing prototypes — understanding, not aesthetics. */
export const PROTOTYPE_EVAL_QUESTIONS = [
  "Where does the route go geographically?",
  "Where are towns and resupply points relative to the line?",
  "Where does the terrain get serious — climbs, remote gaps?",
  "Could I explain this section to someone after watching?",
] as const;

export const DEFAULT_VISUAL_STYLE: RoutePreviewVisualStyle = "map-2d";

export function exaggerationForStyle(style: RoutePreviewVisualStyle): number {
  switch (style) {
    case "map-2d":
      return 0;
    case "map-2d5":
      return 0.22;
    case "terrain-3d":
      return 1.35;
  }
}
