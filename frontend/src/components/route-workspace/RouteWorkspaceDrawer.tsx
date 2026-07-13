import type { ReactNode } from "react";

interface RouteWorkspaceDrawerProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export default function RouteWorkspaceDrawer({
  open,
  title,
  onClose,
  children,
}: RouteWorkspaceDrawerProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="absolute inset-x-0 top-full z-30 mt-2">
      <div className="rounded-xl border border-line/80 bg-card p-4 shadow-soft">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium text-muted hover:text-ink"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
