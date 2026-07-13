interface ComingSoonPageProps {
  title: string;
  description: string;
}

export default function ComingSoonPage({ title, description }: ComingSoonPageProps) {
  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="mx-auto max-w-md rounded-2xl bg-card p-10 text-center shadow-card">
        <p className="text-sm font-semibold uppercase tracking-[0.15em] text-accent">
          Coming soon
        </p>
        <h2 className="mt-3 text-2xl font-semibold text-ink">{title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">{description}</p>
      </div>
    </div>
  );
}
