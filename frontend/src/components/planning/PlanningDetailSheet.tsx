import { useEffect, type ReactNode } from "react";

interface PlanningDetailSheetProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

export default function PlanningDetailSheet({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
}: PlanningDetailSheetProps) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-stretch md:justify-end">
      <button
        type="button"
        aria-label="Close detail panel"
        className="absolute inset-0 bg-ink/35 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="planning-detail-sheet-title"
        className="relative flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-line bg-card shadow-2xl md:my-0 md:h-full md:max-h-none md:rounded-none md:rounded-l-2xl md:border-l md:border-t-0"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-line/60 px-5 py-4">
          <div className="min-w-0">
            <h2 id="planning-detail-sheet-title" className="text-lg font-semibold text-ink">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg px-2 py-1 text-sm font-medium text-muted hover:bg-canvas hover:text-ink"
          >
            Close
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <footer className="shrink-0 border-t border-line/60 px-5 py-3">{footer}</footer>
        )}
      </div>
    </div>
  );
}
