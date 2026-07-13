import type { StopAvailability } from "../planning/stopAvailability";
import { availabilityClass } from "../planning/stopAvailability";

export default function AvailabilityBadge({ availability }: { availability: StopAvailability }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${availabilityClass(availability.status)}`}
    >
      {availability.label}
    </span>
  );
}
