import { useEffect, useState, type ReactNode } from "react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export default function BottomSheet({ open, onClose, children }: BottomSheetProps) {
  const [visible, setVisible] = useState(open);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (open) {
      setVisible(true);
      requestAnimationFrame(() => setAnimating(true));
    } else {
      setAnimating(false);
      const timer = window.setTimeout(() => setVisible(false), 280);
      return () => window.clearTimeout(timer);
    }
  }, [open]);

  if (!visible) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        className={`absolute inset-0 bg-black/60 transition-opacity duration-280 ${
          animating ? "opacity-100" : "opacity-0"
        }`}
        aria-label="Close"
        onClick={onClose}
      />
      <div
        className={`relative max-h-[82vh] overflow-y-auto rounded-t-3xl border border-white/10 bg-[#0f0f0f] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 shadow-2xl transition-transform duration-280 ease-out ${
          animating ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ transitionDuration: "280ms" }}
      >
        <div className="mx-auto mb-4 h-1 w-10 shrink-0 rounded-full bg-white/25" aria-hidden />
        {children}
      </div>
    </div>
  );
}
