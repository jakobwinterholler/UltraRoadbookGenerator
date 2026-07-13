import type { RoadbookResult } from "../api";
import RouteWorkspace from "../components/route-workspace/RouteWorkspace";

interface RoutePageProps {
  result: RoadbookResult;
  onViewFullBriefing: () => void;
}

export default function RoutePage({ result, onViewFullBriefing }: RoutePageProps) {
  return <RouteWorkspace result={result} onViewFullBriefing={onViewFullBriefing} />;
}
