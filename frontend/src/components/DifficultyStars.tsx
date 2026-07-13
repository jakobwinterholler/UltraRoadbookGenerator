interface DifficultyStarsProps {
  stars: number;
  label?: string;
  score?: number;
  className?: string;
  starClassName?: string;
}

export default function DifficultyStars({
  stars,
  label,
  score,
  className = "",
  starClassName = "text-amber-500",
}: DifficultyStarsProps) {
  return (
    <div className={className}>
      <p className={`text-sm tracking-wider ${starClassName}`} aria-label={`${stars} out of 5 stars`}>
        {"★".repeat(stars)}
        <span className="text-line">{"☆".repeat(5 - stars)}</span>
      </p>
      {(label || score !== undefined) && (
        <p className="mt-0.5 text-xs text-muted">
          {label}
          {label && score !== undefined ? " · " : ""}
          {score !== undefined ? `Score ${score}` : ""}
        </p>
      )}
    </div>
  );
}
