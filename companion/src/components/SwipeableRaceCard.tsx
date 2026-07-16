import { useCallback, useRef, useState, type ReactNode } from "react";

const DELETE_WIDTH = 88;
const SWIPE_THRESHOLD = 48;
const LONG_PRESS_MS = 500;

interface SwipeableRaceCardProps {
  children: ReactNode;
  disabled?: boolean;
  onDelete: () => void;
}

export default function SwipeableRaceCard({
  children,
  disabled = false,
  onDelete,
}: SwipeableRaceCardProps) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startXRef = useRef(0);
  const startOffsetRef = useRef(0);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const snapOpen = useCallback(() => {
    setOffset(-DELETE_WIDTH);
  }, []);

  const snapClosed = useCallback(() => {
    setOffset(0);
  }, []);

  const handleTouchStart = useCallback(
    (event: React.TouchEvent) => {
      if (disabled) {
        return;
      }
      longPressTriggeredRef.current = false;
      startXRef.current = event.touches[0].clientX;
      startOffsetRef.current = offset;
      setDragging(true);
      clearLongPress();
      longPressTimerRef.current = window.setTimeout(() => {
        longPressTriggeredRef.current = true;
        onDelete();
      }, LONG_PRESS_MS);
    },
    [clearLongPress, disabled, offset, onDelete],
  );

  const handleTouchMove = useCallback(
    (event: React.TouchEvent) => {
      if (disabled || !dragging) {
        return;
      }
      const delta = event.touches[0].clientX - startXRef.current;
      if (Math.abs(delta) > 8) {
        clearLongPress();
      }
      const next = Math.min(0, Math.max(-DELETE_WIDTH, startOffsetRef.current + delta));
      setOffset(next);
    },
    [clearLongPress, disabled, dragging],
  );

  const handleTouchEnd = useCallback(() => {
    clearLongPress();
    setDragging(false);
    if (longPressTriggeredRef.current) {
      snapClosed();
      return;
    }
    if (offset <= -SWIPE_THRESHOLD) {
      snapOpen();
      return;
    }
    snapClosed();
  }, [clearLongPress, offset, snapClosed, snapOpen]);

  return (
    <div className="swipe-race-card relative overflow-hidden rounded-2xl">
      <div
        className="swipe-race-card__actions absolute inset-y-0 right-0 flex w-[88px] items-center justify-center bg-red-500/90"
        aria-hidden={offset === 0}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={onDelete}
          aria-label="Delete race"
          className="flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 text-xs font-semibold text-white"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Delete
        </button>
      </div>

      <div
        className={`swipe-race-card__content relative ${dragging ? "" : "transition-transform duration-300 ease-out"}`}
        style={{ transform: `translateX(${offset}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onContextMenu={(event) => {
          if (disabled) {
            return;
          }
          event.preventDefault();
          onDelete();
        }}
      >
        {children}
      </div>
    </div>
  );
}
