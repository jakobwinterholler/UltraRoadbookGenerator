import type { CompanionBundle } from "@shared/types/sync";
import GpsGpxExportPanel from "./GpsGpxExportPanel";

interface GpsGpxExportSheetProps {
  bundle: CompanionBundle;
  open: boolean;
  onClose: () => void;
}

export default function GpsGpxExportSheet({ bundle, open, onClose }: GpsGpxExportSheetProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
      <button
        type="button"
        className="absolute inset-0"
        aria-label="Close export sheet"
        onClick={onClose}
      />
      <div className="relative max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#111] p-5">
        <GpsGpxExportPanel
          bundle={bundle}
          showCancel
          onSuccess={onClose}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}
