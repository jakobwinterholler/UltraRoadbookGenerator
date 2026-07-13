const DEFAULT_START_MINUTES = 6 * 60;
const DEFAULT_SPEED_KMH = 18;

export function estimateArrivalClock(totalKm: number, stopKm: number): string {
  if (totalKm <= 0 || stopKm < 0) {
    return "—";
  }
  const elapsedHours = stopKm / DEFAULT_SPEED_KMH;
  const arrivalMinutes = Math.round(DEFAULT_START_MINUTES + elapsedHours * 60) % (24 * 60);
  const hours = Math.floor(arrivalMinutes / 60);
  const minutes = arrivalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
