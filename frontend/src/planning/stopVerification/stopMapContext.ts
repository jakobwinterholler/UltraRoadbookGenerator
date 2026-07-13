export function mapContextWindowKm(stopKm: number, detourM: number): number {
  const detourKm = detourM / 1000;
  return Math.max(0.8, Math.min(2.8, 1.0 + detourKm * 2.5 + stopKm * 0.0002));
}

export function stopMapStory(detourM: number, segmentKm: number): string {
  const parts: string[] = [];

  if (detourM <= 20) {
    parts.push("Stop sits on the race route");
  } else if (detourM <= 75) {
    parts.push(`Quick ${Math.round(detourM)} m detour — route stays close`);
  } else if (detourM <= 200) {
    parts.push(`Route leaves briefly — ${Math.round(detourM)} m detour each way`);
  } else {
    parts.push(`Significant detour — ${Math.round(detourM)} m off the race line`);
  }

  if (segmentKm >= 1.5) {
    parts.push("Route runs through this area — watch where it enters and exits");
  } else if (segmentKm >= 0.7) {
    parts.push("Route crosses this area between the In and Out markers");
  } else {
    parts.push("Route clips through quickly — compare stop position to the purple line");
  }

  return parts.join(" · ");
}

export function detourComplexityLabel(detourM: number): string {
  if (detourM <= 20) {
    return "On route";
  }
  if (detourM <= 75) {
    return "Simple detour";
  }
  if (detourM <= 200) {
    return "Moderate detour";
  }
  return "Complex detour";
}
