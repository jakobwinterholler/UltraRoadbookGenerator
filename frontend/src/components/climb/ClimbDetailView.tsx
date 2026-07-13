import { useMemo } from "react";
import type { ClimbRow, PoiRow, ResupplyZone, RouteVisualization } from "../../api";
import { useClimbDetail } from "../../planning/useClimbDetail";
import ClimbHeroProfile, { profileMarkersForClimb } from "./ClimbHeroProfile";
import ClimbLocalMap from "./ClimbLocalMap";
import ClimbPlanningInsights from "./ClimbPlanningInsights";
import ClimbStoryHeader from "./ClimbStoryHeader";
import ClimbTechnicalDetails from "./ClimbTechnicalDetails";
import RouteContextMap from "./RouteContextMap";

interface ClimbDetailViewProps {
  climb: ClimbRow;
  route: RouteVisualization;
  pois: PoiRow[];
  zones: ResupplyZone[];
  totalKm: number;
  onClose?: () => void;
}

function StoryDivider() {
  return <hr className="border-line/60" />;
}

export default function ClimbDetailView({
  climb,
  route,
  pois,
  zones,
  totalKm,
  onClose,
}: ClimbDetailViewProps) {
  const { analyzed, roadbook, profilePoints } = useClimbDetail(climb, route, pois, zones);

  const profileMarkers = useMemo(
    () => profileMarkersForClimb(climb, profilePoints, roadbook.onClimbWater, roadbook.onClimbFood),
    [climb, profilePoints, roadbook.onClimbFood, roadbook.onClimbWater],
  );

  return (
    <article className="mx-auto w-full max-w-2xl">
      {onClose && (
        <div className="mb-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="text-sm font-medium text-accent transition hover:text-accent/80"
          >
            Back to route →
          </button>
        </div>
      )}

      <div className="space-y-8">
        <ClimbStoryHeader climb={climb} analyzed={analyzed} />

        <ClimbHeroProfile
          climb={climb}
          climbId={climb.id}
          points={profilePoints}
          steepSections={roadbook.steepSections}
          markers={profileMarkers}
        />

        <StoryDivider />

        <ClimbPlanningInsights roadbook={roadbook} />

        <StoryDivider />

        <ClimbTechnicalDetails climb={climb} />

        <StoryDivider />

        <section>
          <h3 className="mb-4 text-sm font-medium text-ink">Route overview</h3>
          <RouteContextMap route={route} climb={climb} totalKm={totalKm} />
        </section>

        <StoryDivider />

        <ClimbLocalMap route={route} climb={climb} pois={pois} />
      </div>
    </article>
  );
}
