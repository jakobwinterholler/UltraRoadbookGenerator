import type { CompanionBundle, CompanionStop } from "@shared/types/sync";
import {
  sortVerificationQueue,
  type SortVerificationOptions,
} from "@shared/race/sortVerificationQueue";

export function stopsNeedingVerification(bundle: CompanionBundle): CompanionStop[] {
  return bundle.stops.filter(
    (stop) =>
      stop.verificationStatus === "unverified" || stop.verificationStatus === "needs_review",
  );
}

export function sortedVerificationQueue(
  bundle: CompanionBundle,
  options: SortVerificationOptions,
): CompanionStop[] {
  return sortVerificationQueue(stopsNeedingVerification(bundle), options);
}
