import { useEffect, useRef, useState } from "react";

export type RaceManageAction =
  | "open"
  | "rename"
  | "duplicate"
  | "archive"
  | "unarchive"
  | "export-excel"
  | "export-gpx"
  | "delete";

interface RaceManageMenuProps {
  archived?: boolean;
  hasAnalysis?: boolean;
  onAction: (action: RaceManageAction) => void;
}

export function RaceManageMenu({ archived = false, hasAnalysis = false, onAction }: RaceManageMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function choose(action: RaceManageAction) {
    setOpen(false);
    onAction(action);
  }

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-label="Race options"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-canvas hover:text-ink"
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
          <circle cx="5" cy="12" r="1.75" />
          <circle cx="12" cy="12" r="1.75" />
          <circle cx="19" cy="12" r="1.75" />
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-20 mt-1 min-w-[11rem] overflow-hidden rounded-xl border border-line bg-card py-1 shadow-lg"
          onClick={(event) => event.stopPropagation()}
        >
          <MenuItem onClick={() => choose("open")}>Open</MenuItem>
          <MenuItem onClick={() => choose("rename")}>Rename</MenuItem>
          <MenuItem onClick={() => choose("duplicate")}>Duplicate</MenuItem>
          {archived ? (
            <MenuItem onClick={() => choose("unarchive")}>Unarchive</MenuItem>
          ) : (
            <MenuItem onClick={() => choose("archive")}>Archive</MenuItem>
          )}
          {hasAnalysis ? (
            <>
              <div className="my-1 border-t border-line/70" />
              <MenuItem onClick={() => choose("export-excel")}>Export Excel</MenuItem>
              <MenuItem onClick={() => choose("export-gpx")}>Export validation GPX</MenuItem>
            </>
          ) : null}
          <div className="my-1 border-t border-line/70" />
          <MenuItem danger onClick={() => choose("delete")}>
            Delete…
          </MenuItem>
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({
  children,
  danger = false,
  onClick,
}: {
  children: React.ReactNode;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`flex w-full px-3 py-2 text-left text-sm transition hover:bg-canvas ${
        danger ? "text-red-600" : "text-ink"
      }`}
    >
      {children}
    </button>
  );
}
