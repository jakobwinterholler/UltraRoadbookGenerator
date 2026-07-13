import type { PoiPlanningProfile } from "../api";
import PoiProfileSettings from "./PoiProfileSettings";
import UploadZone from "./UploadZone";

interface LandingViewProps {
  file: File | null;
  isDragging: boolean;
  error: string | null;
  poiProfile: PoiPlanningProfile;
  onPoiProfileChange: (profile: PoiPlanningProfile) => void;
  onDragEnter: () => void;
  onDragLeave: () => void;
  onDrop: (file: File) => void;
  onSelectFile: (file: File) => void;
  onGenerate: () => void;
}

export default function LandingView({
  file,
  isDragging,
  error,
  poiProfile,
  onPoiProfileChange,
  onDragEnter,
  onDragLeave,
  onDrop,
  onSelectFile,
  onGenerate,
}: LandingViewProps) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 text-center lg:py-24">
      <h2 className="text-4xl font-bold tracking-tight text-ink md:text-5xl">
        Ultra Roadbook Generator
      </h2>
      <p className="mt-4 text-lg text-muted">Analyze. Plan. Ride.</p>

      <div className="mt-12 text-left">
        <UploadZone
          file={file}
          isDragging={isDragging}
          onDragEnter={onDragEnter}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onSelectFile={onSelectFile}
        />
      </div>

      <details className="mt-6 text-left">
        <summary className="cursor-pointer text-sm font-semibold text-accent">
          Advanced · POI search profile
        </summary>
        <div className="mt-4">
          <PoiProfileSettings profile={poiProfile} onChange={onPoiProfileChange} />
        </div>
      </details>

      <button
        type="button"
        onClick={onGenerate}
        disabled={!file}
        className="mt-8 w-full rounded-2xl bg-accent px-6 py-4 text-base font-semibold text-white transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Generate Roadbook
      </button>

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}
    </div>
  );
}
