type CompanionTab = "map" | "resupply" | "account";

interface BottomNavProps {
  active: CompanionTab;
  onChange: (tab: CompanionTab) => void;
}

function NavIcon({ tab, active }: { tab: CompanionTab; active: boolean }) {
  const color = active ? "text-white" : "text-white/35";
  if (tab === "map") {
    return (
      <svg className={`h-5 w-5 ${color}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6z" strokeLinejoin="round" />
        <path d="M9 4v14M15 6v14" />
      </svg>
    );
  }
  if (tab === "resupply") {
    return (
      <svg className={`h-5 w-5 ${color}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
        <path d="M6 6h15l-1.5 9H7.5L6 6z" strokeLinejoin="round" />
        <path d="M6 6L5 3H2" strokeLinecap="round" />
        <circle cx="9" cy="20" r="1" fill="currentColor" />
        <circle cx="18" cy="20" r="1" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg className={`h-5 w-5 ${color}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M5 20c0-3.866 3.134-7 7-7s7 3.134 7 7" strokeLinecap="round" />
    </svg>
  );
}

export default function BottomNav({ active, onChange }: BottomNavProps) {
  const items: { id: CompanionTab; label: string }[] = [
    { id: "map", label: "Map" },
    { id: "resupply", label: "Resupply" },
    { id: "account", label: "Account" },
  ];

  return (
    <nav className="grid shrink-0 grid-cols-3 border-t border-white/10 bg-[#0a0a0a]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
      {items.map((item) => {
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={`flex flex-col items-center gap-1 py-2.5 transition ${
              isActive ? "text-white" : "text-white/40"
            }`}
          >
            <NavIcon tab={item.id} active={isActive} />
            <span className="text-[11px] font-medium">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export type { CompanionTab };
