interface RoutePlanningInsightProps {
  icon: string;
  title: string;
  distance: string;
  elevationGain: string;
  detail?: string;
  active?: boolean;
  onClick?: () => void;
}

export default function RoutePlanningInsight({
  icon,
  title,
  distance,
  elevationGain,
  detail,
  active = false,
  onClick,
}: RoutePlanningInsightProps) {
  const className = `inline-flex max-w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition ${
    active
      ? "border-accent/50 bg-accent/[0.04] ring-1 ring-accent/25"
      : onClick
        ? "border-line/50 bg-canvas/60 hover:border-line/80 hover:bg-canvas"
        : "border-line/50 bg-canvas/60"
  }`;

  const content = (
    <>
      <span className="text-lg leading-none" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className="mt-0.5 text-lg font-semibold tabular-nums tracking-tight text-ink">{distance}</p>
        <p className="text-lg font-semibold tabular-nums tracking-tight text-ink">{elevationGain}</p>
        {detail && <p className="mt-0.5 text-sm text-muted">{detail}</p>}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}
