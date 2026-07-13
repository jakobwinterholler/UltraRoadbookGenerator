export type {
  CompanionBundle,
  CompanionStop,
  CompanionUnsupportedSection,
  SyncRaceSummary,
} from "@shared/types/sync";

export { isCompanionBundle } from "@shared/types/sync";

export type ResupplyTimelineEntry =
  | {
      kind: "stop";
      km: number;
      stop: import("@shared/types/sync").CompanionStop;
    }
  | {
      kind: "unsupported";
      km: number;
      section: import("@shared/types/sync").CompanionUnsupportedSection;
    };
