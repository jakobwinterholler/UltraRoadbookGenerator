import { useCallback, useEffect, useRef, useState } from "react";

export function useHighlightHoverSync() {
  const [hoveredHighlightId, setHoveredHighlightIdState] = useState<string | null>(null);
  const clearTimerRef = useRef<number | null>(null);

  const setHoveredHighlightId = useCallback((highlightId: string | null) => {
    if (clearTimerRef.current !== null) {
      window.clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }

    if (highlightId) {
      setHoveredHighlightIdState(highlightId);
      return;
    }

    clearTimerRef.current = window.setTimeout(() => {
      setHoveredHighlightIdState(null);
      clearTimerRef.current = null;
    }, 60);
  }, []);

  useEffect(
    () => () => {
      if (clearTimerRef.current !== null) {
        window.clearTimeout(clearTimerRef.current);
      }
    },
    [],
  );

  return { hoveredHighlightId, setHoveredHighlightId };
}
