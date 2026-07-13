export function formatRouteKm(km: number): string {
  if (!Number.isFinite(km)) {
    return "0 km";
  }
  return `${Math.round(km)} km`;
}
