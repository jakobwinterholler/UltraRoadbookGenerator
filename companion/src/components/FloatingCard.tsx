interface FloatingCardProps {
  children: React.ReactNode;
  className?: string;
}

export default function FloatingCard({ children, className = "" }: FloatingCardProps) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-black/55 shadow-lg backdrop-blur-xl ${className}`}
    >
      {children}
    </div>
  );
}
