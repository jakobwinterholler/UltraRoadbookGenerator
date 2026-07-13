import type { ClimbRow } from "../api";

export function climbDisplayName(
  climb: Pick<ClimbRow, "id" | "nickname" | "suggested_name">,
  _index: number,
): string {
  if (climb.nickname?.trim()) {
    return climb.nickname.trim();
  }
  if (climb.suggested_name?.trim()) {
    return climb.suggested_name.trim();
  }
  return "Unnamed climb";
}

export function climbNameSourceLabel(source: string | null | undefined): string | null {
  if (!source) {
    return null;
  }
  switch (source) {
    case "pass":
      return "Mountain pass";
    case "peak":
      return "Summit";
    case "saddle":
      return "Pass";
    case "road":
      return "Road name";
    case "road_ref":
      return "Road reference";
    case "locality":
      return "Nearby place";
    case "distance_marker":
      return "Route position";
    default:
      return null;
  }
}
